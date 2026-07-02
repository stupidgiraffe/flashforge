import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Printer, DownloadSimple, UploadSimple, Exam, Image as ImageIcon, Trash, ArrowLeft, DotsThreeVertical, Copy, Sparkle, Stack, CloudArrowUp, CloudArrowDown, LinkSimple, MagnifyingGlass, X, Gear, CheckCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast, Toaster } from 'sonner'
import type { FlashCardSet, FlashCard, ImageCandidate, ImagePlacement } from '@/lib/types'
import { DEFAULT_PRINT_SETTINGS, DEFAULT_TEST_SETTINGS } from '@/lib/types'
import { loadSets, saveSet, deleteSet, generateUniqueId, compressImage, exportSetToJSON, importSetFromJSON, exportAllSetsToJSON, importAllSetsFromJSON, duplicateSet, getStorageStats } from '@/lib/storage'
import { FlashCardDisplay } from '@/components/FlashCardDisplay'
import { ImagePlacementEditor } from '@/components/ImagePlacementEditor'
import { generateTestQuestions } from '@/lib/test-utils'
import { calculatePrintLayout, paginateCardsFixedLength, calculateBackPagePositions } from '@/lib/print-utils'
import { applyRevisionPatches, getPatchChanges, validateRevisionPatches } from '@/lib/flashcard-revision'
import type { RevisionPatchOperation, RevisionScope } from '@/lib/flashcard-revision'
import { explainAiAgentError, formatAiAgentError } from '@/lib/ai-agent-errors'
import { buildImageSearchIntent, getImageAgentOutcome, getImageReviewCandidateUpdates, getStoredImageCandidates } from '@/lib/image-agent'
import { DEFAULT_IMAGE_PLACEMENT, getCardSideImage, imageAssetFromCandidate } from '@/lib/image-placement'

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void
          }
        }
      }
    }
  }
}

const DesignPanel = lazy(() => import('@/components/DesignPanel').then((module) => ({ default: module.DesignPanel })))
const TestConfigDialog = lazy(() => import('@/components/TestConfigDialog').then((module) => ({ default: module.TestConfigDialog })))
const TestDisplay = lazy(() => import('@/components/TestDisplay').then((module) => ({ default: module.TestDisplay })))
const AnswerKey = lazy(() => import('@/components/TestDisplay').then((module) => ({ default: module.AnswerKey })))
const TOKEN_REFRESH_BUFFER_MS = 60_000

interface GoogleConfig {
  clientId: string
  apiKey: string
  searchEngineId: string
}

function sortSetsByRecent(items: FlashCardSet[]): FlashCardSet[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt)
}

function getDefaultBackupName() {
  return `flashforge-backup-${new Date().toISOString().slice(0, 10)}`
}

function validateBackupFileBaseName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Filename cannot be empty'
  if (trimmed.length > 80) return 'Filename is too long (max 80 characters)'
  if (/[<>:"/\\|?*\x00-\x1F]/.test(trimmed)) return 'Filename contains invalid characters'
  return null
}

function normalizeBackupDownloadName(baseName: string): string {
  return baseName.toLowerCase().endsWith('.json') ? baseName : `${baseName}.json`
}

function promptForBackupFilename(message: string, defaultName: string): string | null {
  const userInput = window.prompt(message, defaultName)
  if (userInput === null) return null
  const error = validateBackupFileBaseName(userInput)
  if (error) {
    toast.error(error)
    return null
  }
  return userInput
}

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gsi="true"]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services script')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleGsi = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'))
    document.head.appendChild(script)
  })
}

function LazySectionFallback({ label }: { label: string }) {
  return (
    <Card className="shadow-md">
      <CardContent className="py-12 text-center text-muted-foreground">
        Loading {label}...
      </CardContent>
    </Card>
  )
}

function App() {
  const [sets, setSets] = useState<FlashCardSet[]>([])
  const [currentSet, setCurrentSet] = useState<FlashCardSet | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newSetTitle, setNewSetTitle] = useState('')
  const [googleConfig, setGoogleConfig] = useState<GoogleConfig>({ clientId: '', apiKey: '', searchEngineId: '' })
  const [googleBackupDialogOpen, setGoogleBackupDialogOpen] = useState(false)
  const [googleDriveFiles, setGoogleDriveFiles] = useState<Array<{ id: string; name: string; modifiedTime?: string }>>([])
  const [selectedDriveFileId, setSelectedDriveFileId] = useState('')
  const [googleAccessToken, setGoogleAccessToken] = useState('')
  const [googleTokenExpiresAt, setGoogleTokenExpiresAt] = useState(0)
  const [googleBusy, setGoogleBusy] = useState(false)
  const importSetInputRef = useRef<HTMLInputElement | null>(null)
  const importBackupInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const loaded = loadSets()
    setSets(sortSetsByRecent(loaded))
  }, [])

  function handleCreateSet() {
    if (!newSetTitle.trim()) {
      toast.error('Please enter a set title')
      return
    }

    const newSet: FlashCardSet = {
      id: generateUniqueId(),
      title: newSetTitle,
      cards: [],
      cardType: 'single-sided',
      printSettings: DEFAULT_PRINT_SETTINGS,
      testSettings: DEFAULT_TEST_SETTINGS,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    saveSet(newSet)
    setSets((prev) => sortSetsByRecent([newSet, ...prev]))
    setCurrentSet(newSet)
    setNewSetTitle('')
    setCreateDialogOpen(false)
    toast.success('Set created!')
  }

  function handleDeleteSet(id: string) {
    deleteSet(id)
    setSets((prev) => sortSetsByRecent(prev.filter(s => s.id !== id)))
    if (currentSet?.id === id) {
      setCurrentSet(null)
    }
    toast.success('Set deleted')
  }

  function handleDuplicateSet(source: FlashCardSet) {
    const copy = duplicateSet(source)
    saveSet(copy)
    setSets((prev) => sortSetsByRecent([copy, ...prev]))
    toast.success(`Duplicated "${source.title}"`)
  }

  function handleImportSet(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string
        const imported = importSetFromJSON(json)
        saveSet(imported)
        setSets((prev) => sortSetsByRecent([imported, ...prev]))
        toast.success(`Imported "${imported.title}"`)
      } catch {
        toast.error('Failed to import set. Make sure it is a valid FlashForge JSON file.')
      }
    }
    reader.readAsText(file)
  }

  function handleImportBackup(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string
        const imported = importAllSetsFromJSON(json)
        imported.forEach((s) => saveSet(s))
        setSets((prev) => sortSetsByRecent([...imported, ...prev]))
        toast.success(`Imported ${imported.length} set${imported.length !== 1 ? 's' : ''} from backup`)
      } catch {
        toast.error('Failed to import backup. Make sure it is a valid FlashForge backup file.')
      }
    }
    reader.readAsText(file)
  }

  function handleExportBackup() {
    if (sets.length === 0) {
      toast.error('No sets to export')
      return
    }
    const defaultName = getDefaultBackupName()
    const userInput = promptForBackupFilename('Choose a backup filename', defaultName)
    if (!userInput) return

    const json = exportAllSetsToJSON(sets)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = normalizeBackupDownloadName(userInput)
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup downloaded!')
  }

  const getGoogleAccessToken = useCallback(async (interactive: boolean) => {
    if (!googleConfig.clientId.trim()) {
      throw new Error('Set a Google OAuth client ID first')
    }

    const now = Date.now()
    if (googleAccessToken && googleTokenExpiresAt > now + TOKEN_REFRESH_BUFFER_MS) {
      return googleAccessToken
    }

    await loadGoogleIdentityScript()
    const oauth = window.google?.accounts?.oauth2
    if (!oauth?.initTokenClient) {
      throw new Error('Google OAuth client failed to initialize')
    }

    return await new Promise<string>((resolve, reject) => {
      const tokenClient = oauth.initTokenClient({
        client_id: googleConfig.clientId.trim(),
        scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file',
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error || 'Google authentication failed'))
            return
          }
          const expiresAt = Date.now() + (response.expires_in ?? 3600) * 1000
          setGoogleAccessToken(response.access_token)
          setGoogleTokenExpiresAt(expiresAt)
          resolve(response.access_token)
        },
      })
      if (interactive) {
        tokenClient.requestAccessToken({ prompt: 'consent' })
      } else {
        tokenClient.requestAccessToken()
      }
    })
  }, [googleAccessToken, googleConfig.clientId, googleTokenExpiresAt])

  const fetchGoogleDriveBackups = useCallback(async () => {
    const token = await getGoogleAccessToken(false).catch(async () => getGoogleAccessToken(true))
    const response = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=30&fields=files(id,name,modifiedTime)&q=mimeType%3D%22application%2Fjson%22', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) {
      throw new Error('Unable to load Google Drive backups')
    }

    const data = await response.json() as { files?: Array<{ id: string; name: string; modifiedTime?: string }> }
    const files = (data.files ?? []).sort((a, b) => (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''))
    setGoogleDriveFiles(files)
    if (files.length > 0) {
      setSelectedDriveFileId(files[0].id)
    }
  }, [getGoogleAccessToken])

  async function handleConnectGoogleDrive() {
    try {
      setGoogleBusy(true)
      await getGoogleAccessToken(true)
      toast.success('Google Drive connected')
      await fetchGoogleDriveBackups()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to connect Google Drive')
    } finally {
      setGoogleBusy(false)
    }
  }

  async function handleUploadBackupToGoogleDrive() {
    if (sets.length === 0) {
      toast.error('No sets to back up')
      return
    }

    const defaultName = getDefaultBackupName()
    const userInput = promptForBackupFilename('Choose a backup filename for Google Drive', defaultName)
    if (!userInput) return

    try {
      setGoogleBusy(true)
      const token = await getGoogleAccessToken(false).catch(async () => getGoogleAccessToken(true))
      const filename = normalizeBackupDownloadName(userInput)
      const json = exportAllSetsToJSON(sets)
      const boundary = `flashforge-${Date.now()}`
      const metadata = {
        name: filename,
        mimeType: 'application/json',
        parents: ['appDataFolder'],
      }
      const body = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        json,
        `--${boundary}--`,
        '',
      ].join('\r\n')

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      })

      if (!response.ok) {
        throw new Error('Google Drive upload failed')
      }

      toast.success(`Backup saved to Google Drive as "${filename}"`)
      await fetchGoogleDriveBackups()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save backup to Google Drive')
    } finally {
      setGoogleBusy(false)
    }
  }

  async function handleRestoreFromGoogleDrive() {
    if (!selectedDriveFileId) {
      toast.error('Select a backup file first')
      return
    }

    try {
      setGoogleBusy(true)
      const token = await getGoogleAccessToken(false).catch(async () => getGoogleAccessToken(true))
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(selectedDriveFileId)}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        throw new Error('Failed to download selected Google Drive backup')
      }

      const json = await response.text()
      const imported = importAllSetsFromJSON(json)
      imported.forEach((s) => saveSet(s))
      setSets((prev) => sortSetsByRecent([...imported, ...prev]))
      toast.success(`Imported ${imported.length} set${imported.length !== 1 ? 's' : ''} from Google Drive`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore from Google Drive')
    } finally {
      setGoogleBusy(false)
    }
  }

  function handlePrint() {
    if (currentSet && currentSet.cards.length === 0) {
      toast.error('Add some cards before printing!')
      return
    }
    window.print()
  }

  const handleUpdateSet = useCallback((updated: FlashCardSet) => {
    saveSet(updated)
    setSets(prev => sortSetsByRecent(prev.map(s => s.id === updated.id ? updated : s)))
    setCurrentSet(updated)
  }, [])

  const storageStats = getStorageStats()

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-background via-background to-muted">
      <Toaster position="bottom-right" />
      
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 no-print shadow-sm">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              FlashForge
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Create beautiful printable flashcards & tests</p>
          </div>
          
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {!currentSet && (
              <>
                <input
                  ref={importSetInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleImportSet(file)
                      e.target.value = ''
                    }
                  }}
                />
                <input
                  ref={importBackupInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      handleImportBackup(file)
                      e.target.value = ''
                    }
                  }}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="shadow-md">
                      <DownloadSimple className="mr-2" weight="bold" />
                      Backup
                    </Button>
                  </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleExportBackup}>
                        <DownloadSimple className="mr-2 w-4 h-4" weight="bold" />
                        Download All Sets
                      </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => importBackupInputRef.current?.click()}>
                      <UploadSimple className="mr-2 w-4 h-4" weight="bold" />
                      Restore from Backup
                    </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => importSetInputRef.current?.click()}>
                        <UploadSimple className="mr-2 w-4 h-4" weight="bold" />
                        Import a Set
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setGoogleBackupDialogOpen(true)}>
                        <LinkSimple className="mr-2 w-4 h-4" weight="bold" />
                        Google Drive Backups
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-md">
                  <Plus className="mr-2" weight="bold" />
                  New Set
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Flashcard Set</DialogTitle>
                  <DialogDescription>
                    Give your flashcard set a name to get started
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Set Title</Label>
                    <Input
                      id="title"
                      placeholder="e.g., Spanish Vocabulary Unit 1"
                      value={newSetTitle}
                      onChange={(e) => setNewSetTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateSet()
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSet}>Create Set</Button>
                </div>
              </DialogContent>
            </Dialog>

            {currentSet && (
              <Button variant="outline" onClick={handlePrint} className="shadow-md">
                <Printer className="mr-2" weight="bold" />
                Print
              </Button>
            )}
            <Dialog open={googleBackupDialogOpen} onOpenChange={setGoogleBackupDialogOpen}>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Google Integrations</DialogTitle>
                  <DialogDescription>
                    Connect Google Drive for cloud backups and optionally configure Google Custom Search credentials. Image search also has a non-Google web fallback.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="google-client-id">Google OAuth Client ID</Label>
                    <Input
                      id="google-client-id"
                      value={googleConfig.clientId}
                      onChange={(e) => setGoogleConfig((prev) => ({ ...prev, clientId: e.target.value }))}
                      placeholder="12345-abc.apps.googleusercontent.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="google-api-key">Google API Key</Label>
                    <Input
                      id="google-api-key"
                      value={googleConfig.apiKey}
                      onChange={(e) => setGoogleConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="Optional: improves image search"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="google-cx">Google Custom Search Engine ID (cx)</Label>
                    <Input
                      id="google-cx"
                      value={googleConfig.searchEngineId}
                      onChange={(e) => setGoogleConfig((prev) => ({ ...prev, searchEngineId: e.target.value }))}
                      placeholder="Optional: improves image search"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleConnectGoogleDrive} disabled={googleBusy}>
                      <LinkSimple className="mr-2" weight="bold" />
                      Connect Google Drive
                    </Button>
                    <Button variant="outline" onClick={handleUploadBackupToGoogleDrive} disabled={googleBusy}>
                      <CloudArrowUp className="mr-2" weight="bold" />
                      Save Backup to Drive
                    </Button>
                    <Button variant="outline" onClick={fetchGoogleDriveBackups} disabled={googleBusy}>
                      Refresh Backup List
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="drive-backup-file">Restore from Google Drive</Label>
                    {googleDriveFiles.length > 0 ? (
                      <Select value={selectedDriveFileId} onValueChange={setSelectedDriveFileId}>
                        <SelectTrigger id="drive-backup-file">
                          <SelectValue placeholder="Select backup file" />
                        </SelectTrigger>
                        <SelectContent>
                          {googleDriveFiles.map((file) => (
                            <SelectItem key={file.id} value={file.id}>
                              {file.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground">No Google Drive backups found yet.</p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleRestoreFromGoogleDrive} disabled={!selectedDriveFileId || googleBusy}>
                      <CloudArrowDown className="mr-2" weight="bold" />
                      Restore Selected Backup
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:px-6 sm:py-10">
        {!currentSet ? (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold mb-3">Your Flashcard Sets</h2>
              <p className="text-muted-foreground text-lg">Select a set to edit or create a new one to get started</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-sm">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Stack className="h-6 w-6" weight="bold" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sets</p>
                    <p className="text-2xl font-bold">{storageStats.setCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Copy className="h-6 w-6" weight="bold" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cards</p>
                    <p className="text-2xl font-bold">{storageStats.cardCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkle className="h-6 w-6" weight="fill" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Local storage used</p>
                    <p className="text-2xl font-bold">{storageStats.kilobytesUsed} KB</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {sets.length === 0 ? (
              <div className="space-y-6">
                <Card className="max-w-md mx-auto shadow-lg border-2">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                      <Plus className="w-10 h-10 text-primary" weight="bold" />
                    </div>
                    <p className="text-xl font-semibold text-foreground mb-2">No flashcard sets yet</p>
                    <p className="text-muted-foreground mb-6 text-center">Create a blank set to get started.</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button onClick={() => setCreateDialogOpen(true)} size="lg" className="shadow-md">
                        <Plus className="mr-2" weight="bold" />
                        Create Blank Set
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sets.map((set) => (
                  <Card
                    key={set.id}
                    className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 group"
                    onClick={() => setCurrentSet(set)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-xl truncate">{set.title}</CardTitle>
                          {set.subtitle && (
                            <CardDescription className="text-sm mt-1 truncate">{set.subtitle}</CardDescription>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-11 w-11 shrink-0 p-0 opacity-100 transition-opacity sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DotsThreeVertical className="w-4 h-4" weight="bold" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDuplicateSet(set)
                              }}
                            >
                              <Copy className="mr-2 w-4 h-4" weight="bold" />
                              Duplicate Set
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSet(set.id)
                              }}
                            >
                              <Trash className="mr-2 w-4 h-4" weight="bold" />
                              Delete Set
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 font-medium text-xs">
                          {set.cards.length} card{set.cards.length !== 1 ? 's' : ''}
                        </span>
                        {set.className && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 font-medium text-xs">
                            {set.className}
                          </span>
                        )}
                        {set.cardType === 'double-sided' && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 text-accent-foreground px-2.5 py-0.5 font-medium text-xs">
                            Double-sided
                          </span>
                        )}
                      </div>
                      {set.cards.length > 0 && (
                        <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground line-clamp-2">
                          {set.cards.slice(0, 2).map(c => c.frontText).filter(text => text && text.trim()).join(' · ') || 'No text content yet'}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <SetEditor
            set={currentSet}
            onBack={() => setCurrentSet(null)}
            onUpdate={handleUpdateSet}
            onDuplicate={() => handleDuplicateSet(currentSet)}
            googleImageApiKey={googleConfig.apiKey}
            googleImageSearchCx={googleConfig.searchEngineId}
            onOpenGoogleSettings={() => setGoogleBackupDialogOpen(true)}
          />
        )}
      </main>
    </div>
  )
}

interface SetEditorProps {
  set: FlashCardSet
  onBack: () => void
  onUpdate: (set: FlashCardSet) => void
  onDuplicate: () => void
  googleImageApiKey: string
  googleImageSearchCx: string
  onOpenGoogleSettings: () => void
}

interface ImageSearchWarning {
  error?: string
  code?: string
  provider?: string
  query?: string
  hint?: string
}

type ImageAgentTargetSide = 'front' | 'back' | 'both'
type FlashcardAgentMode = 'create' | 'enhance' | 'revise'

interface ImageAgentCardRequest {
  id: string
  frontText: string
  backText: string
  query: string
}

interface ImageAgentResult {
  cardId: string
  query: string
  title?: string
  imageUrl?: string
  dataUrl?: string
  thumbnailLink?: string
  sourcePage?: string
  embedded?: boolean
  error?: string
}

interface FlashcardAgentGeneratedCard extends Partial<FlashCard> {
  id: string
  frontText: string
  backText: string
  frontImageQuery?: string
  backImageQuery?: string
  imageSources?: Array<{ side: string; query?: string; title?: string; url?: string; provider?: string; error?: string; embedded?: boolean }>
}

interface AiAgentErrorBody {
  error?: string
  code?: string
  hint?: string
  details?: string
}

interface AiAgentRequestError extends Error {
  code?: string
  hint?: string
  details?: string
  status?: number
}

function createAiAgentRequestError(response: Response, data: AiAgentErrorBody, fallback: string): AiAgentRequestError {
  const message = response.status === 404 && !data.error
    ? 'Local AI API route is not running at /api/flashcard-agent.'
    : data.error || `${fallback} (${response.status})`
  const error = new Error(message) as AiAgentRequestError
  error.code = data.code
  error.hint = data.hint
  error.details = data.details
  error.status = response.status
  return error
}



function SetEditor({ set, onBack, onUpdate, onDuplicate, googleImageApiKey, googleImageSearchCx, onOpenGoogleSettings }: SetEditorProps) {
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [generatedTest, setGeneratedTest] = useState<ReturnType<typeof generateTestQuestions> | null>(null)
  const [imageSearchOpen, setImageSearchOpen] = useState(false)
  const [imageSearchCardId, setImageSearchCardId] = useState<string | null>(null)
  const [imageSearchSide, setImageSearchSide] = useState<'front' | 'back'>('front')
  const [imageSearchQuery, setImageSearchQuery] = useState('')
  const [imageSearchResults, setImageSearchResults] = useState<ImageCandidate[]>([])
  const [imageSearchLoading, setImageSearchLoading] = useState(false)
  const [imageAgentOpen, setImageAgentOpen] = useState(false)
  const [flashcardAgentMode, setFlashcardAgentMode] = useState<FlashcardAgentMode>('enhance')
  const [flashcardAgentInstructions, setFlashcardAgentInstructions] = useState('Create a complete funny, classroom-safe ESL deck. Use short front text, useful back text, and specific real web image search queries for each side.')
  const [flashcardAgentCount, setFlashcardAgentCount] = useState('24')
  const [flashcardAgentAiKey, setFlashcardAgentAiKey] = useState(() => localStorage.getItem('flashforge_byok_key') ?? '')
  const [flashcardAgentBaseUrl, setFlashcardAgentBaseUrl] = useState(() => localStorage.getItem('flashforge_byok_base_url') ?? 'https://api.openai.com/v1')
  const [flashcardAgentModel, setFlashcardAgentModel] = useState(() => localStorage.getItem('flashforge_byok_model') ?? '')
  const [flashcardAgentGenerateText, setFlashcardAgentGenerateText] = useState(true)
  const [selectedRevisionCardIds, setSelectedRevisionCardIds] = useState<string[]>([])
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false)
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [revisionPreview, setRevisionPreview] = useState<RevisionPatchOperation[] | null>(null)
  const [revisionLoading, setRevisionLoading] = useState(false)
  const [revisionError, setRevisionError] = useState<string | null>(null)
  const [revisionScope, setRevisionScope] = useState<RevisionScope>('both')
  const [aiConnectionTestLoading, setAiConnectionTestLoading] = useState(false)
  const [imageAgentSide, setImageAgentSide] = useState<ImageAgentTargetSide>('both')
  const [imageAgentQueryTemplate, setImageAgentQueryTemplate] = useState('{front} funny character clear image')
  const [imageAgentEmbed, setImageAgentEmbed] = useState(true)
  const [imageAgentOverwrite, setImageAgentOverwrite] = useState(false)
  const [imageAgentAcceptedRisk, setImageAgentAcceptedRisk] = useState(false)
  const [imageAgentLoading, setImageAgentLoading] = useState(false)
  const [imageAgentLog, setImageAgentLog] = useState<string[]>([])
  const [imageAgentProgress, setImageAgentProgress] = useState<{ phase: 'text' | 'images'; done: number; total: number } | null>(null)
  const [imageAgentSummary, setImageAgentSummary] = useState<string | null>(null)
  const [imageAgentSummaryTone, setImageAgentSummaryTone] = useState<'success' | 'warning' | 'error'>('success')
  const imageAgentCancelRef = useRef<(() => void) | null>(null)
  // Image search provider settings (persisted)
  const [imageBraveKey, setImageBraveKey] = useState(() => localStorage.getItem('flashforge_brave_key') ?? '')
  const [imagePixabayKey, setImagePixabayKey] = useState(() => localStorage.getItem('flashforge_pixabay_key') ?? '')
  const [imagePexelsKey, setImagePexelsKey] = useState(() => localStorage.getItem('flashforge_pexels_key') ?? '')
  const [imageGoogleKey, setImageGoogleKey] = useState(() => localStorage.getItem('flashforge_google_image_key') ?? '')
  const [imageGoogleCx, setImageGoogleCx] = useState(() => localStorage.getItem('flashforge_google_cx') ?? '')
  const [imageProvider, setImageProvider] = useState(() => localStorage.getItem('flashforge_image_provider') ?? 'auto')
  const [imageSearchSettingsOpen, setImageSearchSettingsOpen] = useState(false)
  const [serverSearchConfig, setServerSearchConfig] = useState<Record<string, boolean> | null>(null)
  const [imageSearchTestLoading, setImageSearchTestLoading] = useState(false)
  const [imageSearchTestResult, setImageSearchTestResult] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [previewContainerWidth, setPreviewContainerWidth] = useState(0)
  const previewObserverRef = useRef<ResizeObserver | null>(null)

  useEffect(() => { localStorage.setItem('flashforge_byok_key', flashcardAgentAiKey) }, [flashcardAgentAiKey])
  useEffect(() => { localStorage.setItem('flashforge_byok_base_url', flashcardAgentBaseUrl) }, [flashcardAgentBaseUrl])
  useEffect(() => { localStorage.setItem('flashforge_byok_model', flashcardAgentModel) }, [flashcardAgentModel])
  useEffect(() => { localStorage.setItem('flashforge_brave_key', imageBraveKey) }, [imageBraveKey])
  useEffect(() => { localStorage.setItem('flashforge_pixabay_key', imagePixabayKey) }, [imagePixabayKey])
  useEffect(() => { localStorage.setItem('flashforge_pexels_key', imagePexelsKey) }, [imagePexelsKey])
  useEffect(() => { localStorage.setItem('flashforge_google_image_key', imageGoogleKey) }, [imageGoogleKey])
  useEffect(() => { localStorage.setItem('flashforge_google_cx', imageGoogleCx) }, [imageGoogleCx])
  useEffect(() => { localStorage.setItem('flashforge_image_provider', imageProvider) }, [imageProvider])

  // Fetch server-side provider config when the Image Search Settings dialog opens
  useEffect(() => {
    if (!imageSearchSettingsOpen || serverSearchConfig !== null) return
    fetch('/api/search-config')
      .then((r) => r.ok ? r.json() : null)
      .then((data: Record<string, boolean> | null) => { if (data) setServerSearchConfig(data) })
      .catch(() => { /* ignore — server config unavailable */ })
  }, [imageSearchSettingsOpen, serverSearchConfig])

  const previewContainerRef = (el: HTMLDivElement | null) => {
    if (previewObserverRef.current) {
      previewObserverRef.current.disconnect()
      previewObserverRef.current = null
    }
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setPreviewContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    previewObserverRef.current = ro
  }

  useEffect(() => {
    return () => {
      if (previewObserverRef.current) {
        previewObserverRef.current.disconnect()
        previewObserverRef.current = null
      }
    }
  }, [])

  const updateSet = useCallback(
    (recipe: Partial<FlashCardSet> | ((prev: FlashCardSet) => FlashCardSet)) => {
      if (typeof recipe === 'function') {
        onUpdate(recipe(set))
      } else {
        onUpdate({ ...set, ...recipe })
      }
    },
    [set, onUpdate]
  )

  function addCard() {
    const newCard: FlashCard = {
      id: `card-${Date.now()}`,
      frontText: '',
      backText: '',
      imagePosition: 'front',
      frontImageScale: 1,
      backImageScale: 1,
      frontImageOffsetX: 0,
      frontImageOffsetY: 0,
      backImageOffsetX: 0,
      backImageOffsetY: 0,
      imageScale: 1,
    }
    updateSet(prev => ({
      ...prev,
      cards: [...prev.cards, newCard],
    }))
  }

  function updateCard(id: string, updates: Partial<FlashCard>) {
    updateSet(prev => ({
      ...prev,
      cards: prev.cards.map(c => c.id === id ? { ...c, ...updates } : c),
    }))
  }

  function deleteCard(id: string) {
    updateSet(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== id),
    }))
    setSelectedRevisionCardIds((prev) => prev.filter((cardId) => cardId !== id))
  }

  function toggleRevisionSelection(id: string, checked: boolean) {
    setSelectedRevisionCardIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((cardId) => cardId !== id)
    })
    setRevisionPreview(null)
    setRevisionError(null)
  }

  function selectAllRevisionCards() {
    setSelectedRevisionCardIds(set.cards.map((card) => card.id))
    setRevisionPreview(null)
    setRevisionError(null)
  }

  function clearRevisionSelection() {
    setSelectedRevisionCardIds([])
    setRevisionPreview(null)
    setRevisionError(null)
  }

  function openRevisionDialog(target: 'selected' | 'all' = 'selected') {
    const targetIds = target === 'all' ? set.cards.map((card) => card.id) : selectedRevisionCardIds
    if (targetIds.length === 0) {
      toast.error('Select one or more cards to revise')
      return
    }
    setSelectedRevisionCardIds(targetIds)
    setFlashcardAgentMode('revise')
    setRevisionDialogOpen(true)
    setRevisionError(null)
  }

  async function testAiConnection() {
    if (aiConnectionTestLoading || imageAgentLoading || revisionLoading) return
    if (!flashcardAgentAiKey.trim() || !flashcardAgentModel.trim()) {
      const explanation = explainAiAgentError(
        !flashcardAgentAiKey.trim() ? 'Missing BYOK AI API key' : 'Missing AI model name',
        !flashcardAgentAiKey.trim() ? 'MISSING_API_KEY' : 'MISSING_MODEL',
      )
      toast.error(explanation.title, { description: explanation.action })
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    try {
      setAiConnectionTestLoading(true)
      const response = await fetch('/api/flashcard-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          mode: 'create',
          title: 'FlashForge AI connection test',
          instructions: 'Return exactly one very simple classroom-safe flashcard. Use short text.',
          count: 1,
          aiApiKey: flashcardAgentAiKey.trim(),
          aiBaseUrl: flashcardAgentBaseUrl.trim(),
          aiModel: flashcardAgentModel.trim(),
        }),
      })
      clearTimeout(timer)
      const data = await response.json().catch(() => ({ error: 'AI connection test failed' })) as { cards?: FlashcardAgentGeneratedCard[] } & AiAgentErrorBody
      if (!response.ok) throw createAiAgentRequestError(response, data, 'AI connection test failed')
      if (!Array.isArray(data.cards) || data.cards.length === 0) throw new Error('AI connection test returned no usable cards')
      toast.success('AI connection works', { description: 'Key, model, base URL, and JSON response are compatible.' })
    } catch (error) {
      const msg = (error as Error).name === 'AbortError'
        ? 'AI connection test timed out'
        : error instanceof Error ? error.message : 'AI connection test failed'
      const requestError = error as AiAgentRequestError
      const explanation = explainAiAgentError(msg, requestError.code, requestError.hint)
      toast.error(explanation.title, { description: explanation.action })
    } finally {
      clearTimeout(timer)
      setAiConnectionTestLoading(false)
    }
  }

  async function runRevisionAgent() {
    if (revisionLoading) return
    const selectedCards = set.cards.filter((card) => selectedRevisionCardIds.includes(card.id))
    if (selectedCards.length === 0) {
      toast.error('Select one or more cards to revise')
      return
    }
    if (!revisionFeedback.trim()) {
      toast.error('Enter revision feedback first')
      return
    }
    if (!flashcardAgentAiKey.trim() || !flashcardAgentModel.trim()) {
      toast.error('Enter your BYOK AI API key and model first')
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 55_000)
    try {
      setRevisionLoading(true)
      setRevisionError(null)
      const response = await fetch('/api/flashcard-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          mode: 'revise',
          title: set.title,
          instructions: revisionFeedback,
          revisionScope,
          existingCards: selectedCards.map((card) => ({
            id: card.id,
            frontText: card.frontText,
            backText: card.backText,
            frontImageUrl: card.frontImage?.originalUrl || card.frontImageUrl,
            backImageUrl: card.backImage?.originalUrl || card.backImageUrl,
          })),
          aiApiKey: flashcardAgentAiKey.trim(),
          aiBaseUrl: flashcardAgentBaseUrl.trim(),
          aiModel: flashcardAgentModel.trim(),
        }),
      })
      clearTimeout(timer)
      const data = await response.json().catch(() => ({ error: 'Flashcard revision failed' })) as {
        patches?: RevisionPatchOperation[]
      } & AiAgentErrorBody
      if (!response.ok) {
        throw createAiAgentRequestError(response, data, 'Flashcard revision failed')
      }

      const selectedIds = new Set(selectedCards.map((card) => card.id))
      const { validPatches, rejected } = validateRevisionPatches(data.patches ?? [], selectedIds, revisionScope)
      if (validPatches.length === 0) throw new Error('AI returned no valid changes for the selected cards and scope')
      setRevisionPreview(validPatches)
      if (rejected.length > 0) {
        setRevisionError(`Ignored ${rejected.length} invalid or out-of-scope operation${rejected.length === 1 ? '' : 's'}.`)
      }
      toast.success('Revision preview ready')
    } catch (error) {
      const msg = (error as Error).name === 'AbortError'
        ? 'Revision timed out - try fewer cards or shorter feedback'
        : error instanceof Error ? error.message : 'Flashcard revision failed'
      const requestError = error as AiAgentRequestError
      const explanation = explainAiAgentError(msg, requestError.code, requestError.hint)
      setRevisionError(`${explanation.title}: ${explanation.detail} ${explanation.action}`)
      toast.error(explanation.title, { description: explanation.action })
    } finally {
      clearTimeout(timer)
      setRevisionLoading(false)
    }
  }

  async function applyRevisionPreview() {
    if (!revisionPreview || revisionLoading) return
    const preview = revisionPreview
    const selectedIds = new Set(selectedRevisionCardIds)
    let workingCards = applyRevisionPatches(set.cards, preview, selectedIds)
    const imagePatches = preview.filter((patch) => patch.field === 'frontImageQuery' || patch.field === 'backImageQuery')

    try {
      setRevisionLoading(true)
      let imagesApplied = 0
      let imagesNeedReview = 0
      let imagesFailed = 0
      for (const patch of imagePatches) {
        const card = workingCards.find((item) => item.id === patch.cardId)
        if (!card) continue
        const side = patch.field === 'frontImageQuery' ? 'front' : 'back'
        const intent = buildImageSearchIntent({
          side,
          frontText: card.frontText,
          backText: card.backText,
          aiQuery: patch.value,
        })
        const result = await fetchImageForQuery(intent, new AbortController().signal)
        if (!result.ok) {
          if (result.code === 'low_confidence_image' && result.candidates?.length) {
            imagesNeedReview += 1
            workingCards = workingCards.map((item) => item.id === patch.cardId
              ? { ...item, ...getImageReviewCandidateUpdates(side, result.candidates!) }
              : item)
          } else {
            imagesFailed += 1
          }
          continue
        }
        imagesApplied += 1
        workingCards = workingCards.map((item) => item.id !== patch.cardId
          ? item
          : {
              ...item,
              ...(side === 'front'
                ? {
                    frontImageUrl: result.imageUrl,
                    frontImage: { ...imageAssetFromCandidate(result.candidate, result.imageUrl), candidates: result.candidates },
                    frontImageCandidates: undefined,
                    frontImagePlacement: DEFAULT_IMAGE_PLACEMENT,
                  }
                : {
                    backImageUrl: result.imageUrl,
                    backImage: { ...imageAssetFromCandidate(result.candidate, result.imageUrl), candidates: result.candidates },
                    backImageCandidates: undefined,
                    backImagePlacement: DEFAULT_IMAGE_PLACEMENT,
                  }),
            })
      }

      updateSet((prev) => ({ ...prev, cards: workingCards }))
      setRevisionPreview(null)
      setRevisionDialogOpen(false)
      if (imagesNeedReview > 0) {
        toast.message('Revision applied; image options need review', {
          description: `${imagesApplied} replaced · ${imagesNeedReview} saved for manual review · ${imagesFailed} failed`,
        })
      } else if (imagesFailed > 0) {
        toast.message('Revision applied with image search failures', {
          description: `${imagesApplied} replaced · ${imagesFailed} failed and remained unchanged`,
        })
      } else {
        toast.success('Revision applied')
      }
    } finally {
      setRevisionLoading(false)
    }
  }

  async function handleImageUpload(cardId: string, file: File, side: 'front' | 'back' | 'both') {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const dataUrl = e.target?.result as string
        const compressed = await compressImage(dataUrl)
        if (side === 'front') {
          updateCard(cardId, {
            frontImageUrl: compressed,
            frontImage: { url: compressed, originalUrl: compressed, title: file.name, provider: 'upload' },
            frontImageCandidates: undefined,
            frontImagePlacement: DEFAULT_IMAGE_PLACEMENT,
          })
        } else if (side === 'back') {
          updateCard(cardId, {
            backImageUrl: compressed,
            backImage: { url: compressed, originalUrl: compressed, title: file.name, provider: 'upload' },
            backImageCandidates: undefined,
            backImagePlacement: DEFAULT_IMAGE_PLACEMENT,
          })
        } else {
          updateCard(cardId, { imageUrl: compressed, imagePosition: 'both', imageScale: 1 })
        }
        toast.success('Image uploaded!')
      } catch (error) {
        console.error('Image upload error:', error)
        toast.error('Failed to upload image')
      }
    }
    reader.readAsDataURL(file)
  }

  function removeImage(cardId: string, side: 'front' | 'back' | 'both') {
    if (side === 'front') {
      updateCard(cardId, { frontImageUrl: undefined, frontImage: undefined, frontImagePlacement: undefined })
    } else if (side === 'back') {
      updateCard(cardId, { backImageUrl: undefined, backImage: undefined, backImagePlacement: undefined })
    } else {
      updateCard(cardId, { imageUrl: undefined, imagePosition: 'front', imageScale: 1 })
    }
    toast.success('Image removed')
  }

  function openWebImageSearch(cardId: string, side: 'front' | 'back') {
    const card = set.cards.find((item) => item.id === cardId)
    if (card) {
      const intent = buildImageSearchIntent({
        side,
        frontText: card.frontText,
        backText: card.backText,
      })
      setImageSearchQuery(intent.query)
      setImageSearchResults(getStoredImageCandidates(card, side))
    }
    setImageSearchCardId(cardId)
    setImageSearchSide(side)
    setImageSearchOpen(true)
  }

  async function runWebImageSearch() {
    if (!imageSearchQuery.trim()) {
      toast.error('Enter a keyword to search')
      return
    }

    try {
      setImageSearchLoading(true)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)
      try {
        const response = await fetch('/api/image-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            query: imageSearchQuery.trim(),
            intent: { query: imageSearchQuery.trim(), concepts: [imageSearchQuery.trim()], style: 'neutral' },
            braveApiKey: imageBraveKey.trim(),
            pixabayApiKey: imagePixabayKey.trim(),
            pexelsApiKey: imagePexelsKey.trim(),
            googleApiKey: imageGoogleKey.trim() || googleImageApiKey.trim(),
            googleCx: imageGoogleCx.trim() || googleImageSearchCx.trim(),
            provider: imageProvider,
            limit: 10,
          }),
        })
        clearTimeout(timer)
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Image search failed' })) as { error?: string }
          toast.message(err.error || "Couldn't find images — try a different keyword or configure a provider in Image Search Settings")
          return
        }
        const data = await response.json() as { results?: ImageCandidate[] }
        const results = data.results ?? []
        setImageSearchResults(results)
        if (results.length === 0) toast.message('No images found — try a different keyword or configure a provider in Image Search Settings')
      } catch (error) {
        clearTimeout(timer)
        if ((error as Error).name === 'AbortError') {
          toast.error('Image search timed out — try a different keyword')
        } else {
          toast.error(error instanceof Error ? error.message : 'Failed to search images')
        }
      }
    } finally {
      setImageSearchLoading(false)
    }
  }

  function handleSelectWebImage(candidate: ImageCandidate) {
    if (!imageSearchCardId) return
    const asset = {
      ...imageAssetFromCandidate(candidate),
      candidates: imageSearchResults,
    }
    if (imageSearchSide === 'front') {
      updateCard(imageSearchCardId, {
        frontImageUrl: candidate.url,
        frontImage: asset,
        frontImageCandidates: undefined,
        frontImagePlacement: DEFAULT_IMAGE_PLACEMENT,
      })
    } else {
      updateCard(imageSearchCardId, {
        backImageUrl: candidate.url,
        backImage: asset,
        backImageCandidates: undefined,
        backImagePlacement: DEFAULT_IMAGE_PLACEMENT,
      })
    }
    setImageSearchOpen(false)
    setImageSearchResults([])
    toast.success('Image inserted')
  }


  function buildImageAgentQuery(card: FlashCard, side: ImageAgentTargetSide): string {
    const front = card.frontText.trim()
    const back = card.backText.trim()
    const primary = side === 'back' ? back || front : front || back
    const query = imageAgentQueryTemplate
      .split('{front}').join(front)
      .split('{back}').join(back)
      .split('{title}').join(set.title)
      .split('{side}').join(side)
      .split('{text}').join(primary)
      .replace(/\s+/g, ' ')
      .trim()
    return query || `${primary} ${set.title} clear classroom image`.trim()
  }

  function cardNeedsAgentImage(card: FlashCard): boolean {
    if (imageAgentOverwrite) return true
    if (imageAgentSide === 'front') return !card.frontImageUrl
    if (imageAgentSide === 'back') return !card.backImageUrl
    return !card.frontImageUrl || !card.backImageUrl
  }

  function openFlashcardAgent() {
    if (set.cards.length === 0) setFlashcardAgentMode('create')
    else if (flashcardAgentMode === 'revise') setFlashcardAgentMode('enhance')
    setImageAgentOpen(true)
  }

  function getImageSearchKeys() {
    return {
      braveApiKey: imageBraveKey.trim(),
      pixabayApiKey: imagePixabayKey.trim(),
      pexelsApiKey: imagePexelsKey.trim(),
      // fall back to the legacy Google fields from the Google Integrations dialog
      googleApiKey: imageGoogleKey.trim() || googleImageApiKey.trim(),
      googleCx: imageGoogleCx.trim() || googleImageSearchCx.trim(),
    }
  }

  async function testImageSearchProvider() {
    const query = 'giraffe'
    setImageSearchTestLoading(true)
    setImageSearchTestResult(null)
    try {
      const response = await fetch('/api/image-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          ...getImageSearchKeys(),
          provider: imageProvider,
          limit: 1,
          embedImage: true,
        }),
      })
      const data = await response.json().catch(() => ({ error: 'Image search test failed' })) as {
        results?: Array<{ title?: string; link?: string; provider?: string }>
        embedded?: boolean
        warning?: ImageSearchWarning
        error?: string
        code?: string
        provider?: string
        hint?: string
      }
      if (!response.ok) {
        const providerLabel = data.provider ? `${data.provider}: ` : ''
        setImageSearchTestResult(`Failed (${data.code || response.status}): ${providerLabel}${data.error || 'Image search failed'}${data.hint ? ` ${data.hint}` : ''}`)
        return
      }
      const first = data.results?.[0]
      const domain = first?.link ? new URL(first.link).hostname : 'no image URL'
      const providerLabel = first?.provider || data.provider || imageProvider
      const embedNote = data.embedded ? 'embedded' : data.warning?.code === 'image_embed_failed' ? 'remote URL fallback' : 'remote URL'
      setImageSearchTestResult(`OK: ${providerLabel} returned ${data.results?.length ?? 0} result for "${query}" (${first?.title || 'untitled'} from ${domain}; ${embedNote}).`)
    } catch (error) {
      setImageSearchTestResult(error instanceof Error ? `Failed: ${error.message}` : 'Failed: Image search test could not run')
    } finally {
      setImageSearchTestLoading(false)
    }
  }

  async function fetchImageForQuery(
    intent: ReturnType<typeof buildImageSearchIntent>,
    signal: AbortSignal,
  ): Promise<
    | { ok: true; imageUrl: string; embedded: boolean; candidate: ImageCandidate; candidates: ImageCandidate[]; warning?: ImageSearchWarning }
    | { ok: false; error: string; code?: string; provider?: string; hint?: string; candidates?: ImageCandidate[] }
  > {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25_000)
    const combined = AbortSignal.any ? AbortSignal.any([signal, controller.signal]) : signal
    try {
      const response = await fetch('/api/image-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: combined,
        body: JSON.stringify({
          query: intent.query,
          intent,
          ...getImageSearchKeys(),
          provider: imageProvider,
          limit: 8,
          embedImage: imageAgentEmbed,
        }),
      })
      clearTimeout(timeoutId)
      const data = await response.json().catch(() => ({ error: 'Image search failed' })) as {
        results?: ImageCandidate[]
        dataUrl?: string
        embedded?: boolean
        warning?: ImageSearchWarning
        error?: string
        code?: string
        provider?: string
        hint?: string
      }
      if (!response.ok) {
        return {
          ok: false,
          error: data.error || `Image search failed (${response.status})`,
          code: data.code,
          provider: data.provider,
          hint: data.hint,
        }
      }
      const candidate = data.results?.[0]
      if (!candidate) {
        return { ok: false, error: 'Provider returned 0 image results', code: 'provider_zero_results' }
      }
      if (candidate.needsReview || data.warning?.code === 'low_confidence_image') {
        return {
          ok: false,
          error: 'Best image match needs review',
          code: 'low_confidence_image',
          provider: candidate.provider,
          hint: 'No image was applied. Review the saved alternatives from Search again / Change image.',
          candidates: data.results ?? [candidate],
        }
      }

      let imageUrl = data.dataUrl || candidate.url
      let embedded = Boolean(data.embedded)
      if (imageUrl.startsWith('data:') && !imageUrl.startsWith('data:image/gif')) {
        try {
          imageUrl = await compressImage(imageUrl, 1000, 0.75)
          embedded = true
        } catch { /* keep original */ }
      }
      return {
        ok: true,
        imageUrl,
        embedded,
        candidate,
        candidates: data.results ?? [candidate],
        warning: data.warning,
      }
    } catch {
      clearTimeout(timeoutId)
      if (signal.aborted) return { ok: false, error: 'Image search cancelled', code: 'image_cancelled' }
      return { ok: false, error: 'Local image search API is unavailable or timed out', code: 'image_route_unavailable' }
    }
  }

  async function runImageAgent() {
    if (imageAgentLoading) return
    if (!imageAgentAcceptedRisk) {
      toast.error('Please accept the image-use responsibility notice first')
      return
    }

    const needsAi = flashcardAgentMode === 'create' || (flashcardAgentMode === 'enhance' && flashcardAgentGenerateText)
    if (needsAi && (!flashcardAgentAiKey.trim() || !flashcardAgentModel.trim())) {
      toast.error('Enter your BYOK AI API key and model first, or turn off text generation for image-only enhancement')
      return
    }

    const abortController = new AbortController()
    imageAgentCancelRef.current = () => abortController.abort()

    // Authoritative in-memory working copy of the deck cards.
    // Using a local array avoids the stale-closure bug where Phase 2 updateSet
    // calls would overwrite Phase 1 cards because `set` was frozen at run start.
    let workingCards: FlashCard[] = [...set.cards]
    let hasNewContent = false

    function persistWorkingState() {
      onUpdate({ ...set, cards: workingCards })
    }

    try {
      setImageAgentLoading(true)
      setImageAgentSummary(null)
      setImageAgentSummaryTone('success')
      setImageAgentLog([])
      setImageAgentProgress(null)

      // ── Phase 1: Text generation (batched) ──────────────────────────────
      const generatedCards: FlashcardAgentGeneratedCard[] = []

      if (needsAi) {
        const requestedCount = Math.max(1, Math.min(Number(flashcardAgentCount || 24), 60))
        const batchSize = 20
        const minimumBatches = flashcardAgentMode === 'create' ? Math.ceil(requestedCount / batchSize) : 1
        const maxTextAttempts = flashcardAgentMode === 'create' ? minimumBatches + 3 : 1

        setImageAgentProgress({ phase: 'text', done: 0, total: maxTextAttempts })
        setImageAgentLog([`Generating text for ${requestedCount} card${requestedCount === 1 ? '' : 's'} (${minimumBatches} batch${minimumBatches === 1 ? '' : 'es'} minimum)...`])

        for (let batchIndex = 0; batchIndex < maxTextAttempts; batchIndex += 1) {
          if (abortController.signal.aborted) break
          if (flashcardAgentMode === 'create' && generatedCards.length >= requestedCount) break
          const batchCount = flashcardAgentMode === 'create' ? Math.min(batchSize, requestedCount - generatedCards.length) : requestedCount
          setImageAgentLog((prev) => [...prev, `Batch ${batchIndex + 1}/${maxTextAttempts}: generating ${batchCount} card${batchCount === 1 ? '' : 's'}...`])

          const batchController = new AbortController()
          imageAgentCancelRef.current = () => {
            abortController.abort()
            batchController.abort()
          }
          const batchTimer = setTimeout(() => batchController.abort(), 55_000)
          try {
            const batchSignal = AbortSignal.any ? AbortSignal.any([abortController.signal, batchController.signal]) : batchController.signal
            const response = await fetch('/api/flashcard-agent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: batchSignal,
              body: JSON.stringify({
                mode: flashcardAgentMode,
                title: set.title,
                instructions: flashcardAgentInstructions,
                count: batchCount,
                existingFronts: [...set.cards, ...generatedCards].map((c) => c.frontText).filter(Boolean).slice(0, 60),
                existingCards: flashcardAgentMode === 'enhance'
                  ? set.cards.map((card) => ({
                    id: card.id,
                    frontText: card.frontText,
                    backText: card.backText,
                    frontImageUrl: card.frontImageUrl,
                    backImageUrl: card.backImageUrl,
                  }))
                  : undefined,
                aiApiKey: flashcardAgentAiKey.trim(),
                aiBaseUrl: flashcardAgentBaseUrl.trim(),
                aiModel: flashcardAgentModel.trim(),
              }),
            })
            clearTimeout(batchTimer)
            const data = await response.json().catch(() => ({ error: 'Flashcard Agent failed' })) as { cards?: FlashcardAgentGeneratedCard[] } & AiAgentErrorBody
            if (!response.ok) {
              throw createAiAgentRequestError(response, data, 'Flashcard Agent failed')
            }
            const returnedCards = data.cards ?? []
            const usableCards = flashcardAgentMode === 'create'
              ? returnedCards.slice(0, Math.max(0, requestedCount - generatedCards.length))
              : returnedCards
            generatedCards.push(...usableCards)
            setImageAgentProgress({ phase: 'text', done: batchIndex + 1, total: maxTextAttempts })
            if (flashcardAgentMode === 'create' && usableCards.length === 0) break
          } catch (error) {
            clearTimeout(batchTimer)
            if ((error as Error).name === 'AbortError') {
              if (abortController.signal.aborted) throw new Error('Flashcard Agent cancelled')
              throw new Error('Text generation timed out — try a smaller deck or faster model')
            }
            throw error
          } finally {
            imageAgentCancelRef.current = () => abortController.abort()
          }
        }

        if (abortController.signal.aborted) throw new Error('Flashcard Agent cancelled')
        if (generatedCards.length === 0) throw new Error('Flashcard Agent returned no cards')
        if (flashcardAgentMode === 'create' && generatedCards.length < requestedCount) {
          setImageAgentSummaryTone('warning')
          setImageAgentLog((prev) => [...prev, `⚠ Generated ${generatedCards.length} of ${requestedCount}; the model returned fewer usable cards after retries.`])
        }

        setImageAgentLog((prev) => [...prev, `✓ Generated ${generatedCards.length} card${generatedCards.length === 1 ? '' : 's'} — now searching for images...`])

        // Build the working copy from Phase 1 results
        if (flashcardAgentMode === 'create') {
          workingCards = [
            ...set.cards,
            ...generatedCards.map((card) => ({
              id: card.id,
              frontText: card.frontText,
              backText: card.backText,
              imagePosition: 'front' as const,
              frontImageScale: 1,
              backImageScale: 1,
              frontImageOffsetX: 0,
              frontImageOffsetY: 0,
              backImageOffsetX: 0,
              backImageOffsetY: 0,
              imageScale: 1,
            })),
          ]
        } else {
          const byId = new Map(generatedCards.map((c) => [c.id, c]))
          workingCards = set.cards.map((card) => {
            const gen = byId.get(card.id)
            if (!gen) return card
            return { ...card, frontText: gen.frontText || card.frontText, backText: gen.backText || card.backText }
          })
        }

        hasNewContent = true
        // Persist text-only cards immediately so the user sees progress
        persistWorkingState()
      }

      // ── Phase 2: Image search (client-orchestrated, bounded concurrency) ─
      interface ImageTask { cardId: string; side: 'front' | 'back'; intent: ReturnType<typeof buildImageSearchIntent> }
      const imageTasks: ImageTask[] = []

      if (needsAi) {
        // Build tasks from generated cards
        for (const card of generatedCards) {
          if (abortController.signal.aborted) break
          if (imageAgentSide === 'front' || imageAgentSide === 'both') {
            const intent = buildImageSearchIntent({
              side: 'front',
              frontText: card.frontText,
              backText: card.backText,
              aiQuery: card.frontImageQuery,
            })
            if (intent.query) imageTasks.push({ cardId: card.id, side: 'front', intent })
          }
          if (imageAgentSide === 'back' || imageAgentSide === 'both') {
            const intent = buildImageSearchIntent({
              side: 'back',
              frontText: card.frontText,
              backText: card.backText,
              aiQuery: card.backImageQuery,
            })
            if (intent.query) imageTasks.push({ cardId: card.id, side: 'back', intent })
          }
        }
      } else {
        // Image-only mode: get tasks from existing cards that need images
        const targetCards = set.cards.filter(cardNeedsAgentImage)
        if (targetCards.length === 0) {
          toast.message('No cards need images with the current settings')
          return
        }
        for (const card of targetCards) {
          if (imageAgentSide === 'front' || imageAgentSide === 'both') {
            if (!card.frontImageUrl || imageAgentOverwrite) {
              imageTasks.push({
                cardId: card.id,
                side: 'front',
                intent: buildImageSearchIntent({
                  side: 'front',
                  frontText: card.frontText,
                  backText: card.backText,
                  aiQuery: buildImageAgentQuery(card, 'front'),
                }),
              })
            }
          }
          if (imageAgentSide === 'back' || imageAgentSide === 'both') {
            if (!card.backImageUrl || imageAgentOverwrite) {
              imageTasks.push({
                cardId: card.id,
                side: 'back',
                intent: buildImageSearchIntent({
                  side: 'back',
                  frontText: card.frontText,
                  backText: card.backText,
                  aiQuery: buildImageAgentQuery(card, 'back'),
                }),
              })
            }
          }
        }
      }

      if (imageTasks.length > 0) {
        setImageAgentProgress({ phase: 'images', done: 0, total: imageTasks.length })

        const IMAGE_CONCURRENCY = 4
        let imagesDone = 0
        let imagesApplied = 0
        let imagesNeedReview = 0
        let imagesFailed = 0
        const imageFailureReasons = new Map<string, number>()

        async function processImageTask(task: ImageTask) {
          if (abortController.signal.aborted) return
          const result = await fetchImageForQuery(task.intent, abortController.signal)
          imagesDone++
          if (result.ok) {
            imagesApplied++
            // Update workingCards directly — no stale-closure risk
            const cardIndex = workingCards.findIndex((c) => c.id === task.cardId)
            if (cardIndex >= 0) {
              const card = workingCards[cardIndex]
              workingCards[cardIndex] = {
                ...card,
                ...(task.side === 'front'
                  ? {
                      frontImageUrl: result.imageUrl,
                      frontImage: { ...imageAssetFromCandidate(result.candidate, result.imageUrl), candidates: result.candidates },
                      frontImageCandidates: undefined,
                      frontImagePlacement: DEFAULT_IMAGE_PLACEMENT,
                    }
                  : {
                      backImageUrl: result.imageUrl,
                      backImage: { ...imageAssetFromCandidate(result.candidate, result.imageUrl), candidates: result.candidates },
                      backImageCandidates: undefined,
                      backImagePlacement: DEFAULT_IMAGE_PLACEMENT,
                    }),
              }
            }
            const warning = result.warning?.code === 'image_embed_failed'
              ? ' — found image; embed failed, using remote URL'
              : ''
            setImageAgentLog((prev) => [...prev, `✓ ${task.side}: ${task.intent.query}${result.embedded ? ' (embedded)' : ''}${warning}`])
          } else if (!abortController.signal.aborted && result.code === 'low_confidence_image' && result.candidates?.length) {
            imagesNeedReview++
            const cardIndex = workingCards.findIndex((card) => card.id === task.cardId)
            if (cardIndex >= 0) {
              workingCards[cardIndex] = {
                ...workingCards[cardIndex],
                ...getImageReviewCandidateUpdates(task.side, result.candidates),
              }
            }
            setImageAgentLog((prev) => [
              ...prev,
              `⚠ ${task.side}: ${task.intent.query} — needs review; saved ${result.candidates!.length} candidate${result.candidates!.length === 1 ? '' : 's'} for manual choice`,
            ])
          } else if (!abortController.signal.aborted) {
            imagesFailed++
            const reason = result.provider
              ? `${result.provider}: ${result.error}`
              : result.error
            imageFailureReasons.set(reason, (imageFailureReasons.get(reason) ?? 0) + 1)
            const hint = result.hint ? ` ${result.hint}` : ''
            setImageAgentLog((prev) => [...prev, `✕ ${task.side}: ${task.intent.query} — ${reason}.${hint}`])
          }
          setImageAgentProgress({ phase: 'images', done: imagesDone, total: imageTasks.length })
          // Persist periodically so partial results are not lost on error/cancel
          hasNewContent = true
          persistWorkingState()
        }

        // Bounded concurrency worker pool
        let taskIndex = 0
        async function worker() {
          while (taskIndex < imageTasks.length && !abortController.signal.aborted) {
            const i = taskIndex++
            if (i < imageTasks.length) await processImageTask(imageTasks[i])
          }
        }
        await Promise.allSettled(Array.from({ length: IMAGE_CONCURRENCY }, () => worker()))

        // Final persist to ensure all results are saved
        persistWorkingState()

        const wasCancelled = abortController.signal.aborted
        const imageOutcome = imagesNeedReview > 0 && imagesApplied + imagesFailed < imageTasks.length
          ? 'partial'
          : getImageAgentOutcome(imageTasks.length, imagesApplied)
        const topReasons = [...imageFailureReasons.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([reason, count]) => `${reason}${count > 1 ? ` (${count})` : ''}`)
          .join('; ')
        const logSummary = wasCancelled
          ? `Cancelled — saved ${imagesApplied} image${imagesApplied === 1 ? '' : 's'}`
          : imageOutcome === 'failed'
            ? `✕ Image step failed: 0 images found, ${imagesFailed} failed${topReasons ? ` — ${topReasons}` : ''}`
            : imageOutcome === 'partial'
              ? `⚠ Image review needed: ${imagesApplied} applied, ${imagesNeedReview} need review, ${imagesFailed} failed${topReasons ? ` — ${topReasons}` : ''}`
              : `✓ Done: ${imagesApplied} image${imagesApplied === 1 ? '' : 's'} found`
        setImageAgentLog((prev) => [logSummary, ...prev])
        if (wasCancelled) {
          setImageAgentSummaryTone(imagesApplied > 0 ? 'warning' : 'error')
          toast.message(`Cancelled — kept ${imagesApplied} image${imagesApplied === 1 ? '' : 's'}`)
        } else if (imageOutcome === 'failed') {
          setImageAgentSummaryTone('error')
          const summary = needsAi
            ? `Created ${generatedCards.length} text card${generatedCards.length === 1 ? '' : 's'} · image step failed`
            : `Image step failed · 0 of ${imageTasks.length} images applied`
          toast.error('Image step failed', { description: topReasons || 'No images were applied. Text cards were kept.' })
          setImageAgentSummary(summary)
        } else if (imageOutcome === 'partial') {
          setImageAgentSummaryTone('warning')
          toast.message('Image options need review', {
            description: `${imagesApplied} applied · ${imagesNeedReview} saved for review · ${imagesFailed} failed`,
          })
          setImageAgentSummary(needsAi
            ? `Created ${generatedCards.length} card${generatedCards.length === 1 ? '' : 's'} · ${imagesApplied} images applied · ${imagesNeedReview} need review · ${imagesFailed} failed`
            : `${imagesApplied} images applied · ${imagesNeedReview} need review · ${imagesFailed} failed`)
        } else {
          setImageAgentSummaryTone('success')
          toast.success(needsAi
            ? `Agent created ${generatedCards.length} card${generatedCards.length === 1 ? '' : 's'} with ${imagesApplied} image${imagesApplied === 1 ? '' : 's'}`
            : `Applied ${imagesApplied} image${imagesApplied === 1 ? '' : 's'}`)
          setImageAgentSummary(needsAi
            ? `Created ${generatedCards.length} card${generatedCards.length === 1 ? '' : 's'} · ${imagesApplied} image${imagesApplied === 1 ? '' : 's'} found`
            : `${imagesApplied} image${imagesApplied === 1 ? '' : 's'} applied`)
        }
      } else if (needsAi) {
        persistWorkingState()
        setImageAgentSummaryTone('success')
        toast.success(`Agent created ${generatedCards.length} card${generatedCards.length === 1 ? '' : 's'}`)
        setImageAgentSummary(`Created ${generatedCards.length} card${generatedCards.length === 1 ? '' : 's'}`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Flashcard Agent failed'
      if (msg === 'Flashcard Agent cancelled') {
        setImageAgentLog((prev) => ['Cancelled before new cards were created', ...prev])
        toast.message('Flashcard Agent cancelled')
      } else {
        const requestError = error as AiAgentRequestError
        const explanation = explainAiAgentError(msg, requestError.code, requestError.hint)
        setImageAgentLog((prev) => [`✕ ${formatAiAgentError(msg, requestError.code, requestError.hint)}`, ...prev])
        toast.error(explanation.title, { description: explanation.action })
      }
      // Preserve any partial progress already accumulated
      if (hasNewContent) persistWorkingState()
    } finally {
      setImageAgentLoading(false)
      setImageAgentProgress(null)
      imageAgentCancelRef.current = null
    }
  }

  function handleResetFormatting() {
    const confirmed = window.confirm('Reset all formatting options to default values?')
    if (!confirmed) return
    updateSet(prev => ({
      ...prev,
      printSettings: { ...DEFAULT_PRINT_SETTINGS },
    }))
    toast.success('Formatting reset to defaults')
  }

  function handleGenerateTest() {
    if (set.cards.length === 0) {
      toast.error('Add some cards first!')
      return
    }
    const questions = generateTestQuestions(set.cards, set.testSettings)
    setGeneratedTest(questions)
    toast.success('Test generated!')
  }

  function handleTestSettingsChange(newSettings: typeof set.testSettings) {
    updateSet(prev => ({
      ...prev,
      testSettings: newSettings,
    }))
  }

  function handleExportSet() {
    const json = exportSetToJSON(set)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${set.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Set exported!')
  }

  const layout = calculatePrintLayout(
    set.printSettings.cardsPerPage,
    set.printSettings.paperSize,
    set.printSettings.orientation
  )
  const pages = paginateCardsFixedLength(set.cards, set.printSettings.cardsPerPage)
  const selectedRevisionCards = set.cards.filter((card) => selectedRevisionCardIds.includes(card.id))

  return (
      <div className="space-y-8">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-3">
            <ArrowLeft className="mr-2" weight="bold" />
            Back to Sets
          </Button>
          <h2 className="text-3xl font-bold">{set.title}</h2>
          {set.subtitle && <p className="text-muted-foreground mt-1">{set.subtitle}</p>}
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <Button variant="outline" onClick={handleExportSet} className="shadow-md">
            <DownloadSimple className="mr-2" weight="bold" />
            Export Set
          </Button>
          <Button variant="outline" onClick={onDuplicate} className="shadow-md">
            <Copy className="mr-2" weight="bold" />
            Duplicate Set
          </Button>
          <Button onClick={addCard} size="lg" className="shadow-md">
            <Plus className="mr-2" weight="bold" />
            Add Card
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 no-print">
        <Button variant="outline" onClick={() => setShowTestDialog(true)} disabled={set.cards.length === 0} className="shadow-sm">
          <Exam className="mr-2" weight="bold" />
          Generate Test
        </Button>
        <Button variant="outline" onClick={openFlashcardAgent} className="shadow-sm">
          <Sparkle className="mr-2" weight="bold" />
          AI Flashcard Agent
        </Button>
      </div>

      <Suspense fallback={null}>
        <TestConfigDialog
          open={showTestDialog}
          onOpenChange={setShowTestDialog}
          settings={set.testSettings}
          onSettingsChange={handleTestSettingsChange}
          onGenerate={handleGenerateTest}
          maxQuestions={set.cards.length}
        />
      </Suspense>

      <Tabs defaultValue="editor" className="no-print">
        <div className="overflow-x-auto pb-1">
          <TabsList className={`grid w-full max-w-2xl min-w-[18rem] ${generatedTest ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          {generatedTest && <TabsTrigger value="test">Test</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="editor" className="space-y-6 mt-6">
          <Card className="shadow-md border-2">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-xl font-bold">Set Details</CardTitle>
              <CardDescription>Edit the set metadata that appears in the library and exports.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 pt-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Title</Label>
                <Input
                  value={set.title}
                  onChange={(e) => updateSet(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Grade 2 Introductions"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">Subtitle</Label>
                <Input
                  value={set.subtitle ?? ''}
                  onChange={(e) => updateSet(prev => ({ ...prev, subtitle: e.target.value || undefined }))}
                  placeholder="Optional context for the set"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">Class name</Label>
                <Input
                  value={set.className ?? ''}
                  onChange={(e) => updateSet(prev => ({ ...prev, className: e.target.value || undefined }))}
                  placeholder="e.g., Grade 3, Homeroom A"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-base font-semibold">Teacher notes</Label>
                <Textarea
                  value={set.notes ?? ''}
                  onChange={(e) => updateSet(prev => ({ ...prev, notes: e.target.value || undefined }))}
                  placeholder="Private notes, sequence ideas, or usage reminders"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {set.cards.length === 0 ? (
            <Card className="shadow-lg">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Plus className="w-10 h-10 text-primary" weight="bold" />
                </div>
                <p className="text-xl font-semibold text-foreground mb-2">No cards yet</p>
                <p className="text-muted-foreground mb-6">Add your first card to get started</p>
                <Button onClick={addCard} size="lg" className="shadow-md">
                  <Plus className="mr-2" weight="bold" />
                  Add Your First Card
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-2 shadow-sm">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">AI revision</p>
                    <p className="text-sm text-muted-foreground">{selectedRevisionCardIds.length} of {set.cards.length} selected</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={selectAllRevisionCards}>
                      Select all
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearRevisionSelection} disabled={selectedRevisionCardIds.length === 0}>
                      Clear selection
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openRevisionDialog('all')}>
                      <Sparkle className="mr-2" weight="bold" />
                      Revise all with AI
                    </Button>
                    <Button size="sm" onClick={() => openRevisionDialog('selected')} disabled={selectedRevisionCardIds.length === 0}>
                      <Sparkle className="mr-2" weight="bold" />
                      Revise selected with AI
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {set.cards.map((card, index) => (
              <Card key={card.id} className="shadow-md border-2 hover:border-primary/30 transition-colors">
                <CardHeader className="bg-muted/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedRevisionCardIds.includes(card.id)}
                        onChange={(event) => toggleRevisionSelection(card.id, event.target.checked)}
                      />
                      <CardTitle className="text-xl font-bold">Card {index + 1}</CardTitle>
                    </label>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteCard(card.id)}
                    >
                      <Trash className="mr-2" weight="bold" />
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Front Text</Label>
                      <Textarea
                        value={card.frontText}
                        onChange={(e) => updateCard(card.id, { frontText: e.target.value })}
                        placeholder="Enter text for front of card"
                        className="min-h-24 text-base"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Back Text</Label>
                      <Textarea
                        value={card.backText}
                        onChange={(e) => updateCard(card.id, { backText: e.target.value })}
                        placeholder="Enter text for back of card"
                        className="min-h-24 text-base"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Front Image</Label>
                          {(card.frontImage?.url || card.frontImageUrl) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeImage(card.id, 'front')}
                            >
                              <Trash className="mr-1" size={14} weight="bold" />
                              Remove
                            </Button>
                          )}
                        </div>

                        {(card.frontImage?.url || card.frontImageUrl) ? (
                          <div className="space-y-3">
                            <ImagePlacementEditor
                              imageUrl={card.frontImage?.url || card.frontImageUrl!}
                              alt="Front"
                              placement={getCardSideImage(card, 'front').placement}
                              onChange={(frontImagePlacement) => updateCard(card.id, { frontImagePlacement })}
                            />
                            {card.frontImageCandidates?.length ? (
                              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status" aria-live="polite">
                                {card.frontImageCandidates.length} replacement option{card.frontImageCandidates.length === 1 ? '' : 's'} need review. The current image was kept.
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => fileInputRefs.current[`${card.id}-front`]?.click()}
                              >
                                <ImageIcon className="mr-2" weight="bold" />
                                Upload change
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openWebImageSearch(card.id, 'front')}
                              >
                                <MagnifyingGlass className="mr-2" weight="bold" />
                                {card.frontImageCandidates?.length ? 'Review image options' : 'Search again'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {card.frontImageCandidates?.length ? (
                              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status" aria-live="polite">
                                {card.frontImageCandidates.length} image option{card.frontImageCandidates.length === 1 ? '' : 's'} need review. No image was applied.
                              </div>
                            ) : null}
                            <div
                              onClick={() => fileInputRefs.current[`${card.id}-front`]?.click()}
                              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                            >
                              <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" weight="duotone" />
                              <p className="text-sm font-medium text-foreground mb-1">Add front image</p>
                              <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                            </div>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => openWebImageSearch(card.id, 'front')}
                            >
                              <MagnifyingGlass className="mr-2" weight="bold" />
                              {card.frontImageCandidates?.length ? 'Review image options' : 'Search Web Images'}
                            </Button>
                          </div>
                        )}

                        <input
                          ref={(el) => {
                            fileInputRefs.current[`${card.id}-front`] = el
                          }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleImageUpload(card.id, file, 'front')
                            }
                          }}
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Back Image</Label>
                          {(card.backImage?.url || card.backImageUrl) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeImage(card.id, 'back')}
                            >
                              <Trash className="mr-1" size={14} weight="bold" />
                              Remove
                            </Button>
                          )}
                        </div>

                        {(card.backImage?.url || card.backImageUrl) ? (
                          <div className="space-y-3">
                            <ImagePlacementEditor
                              imageUrl={card.backImage?.url || card.backImageUrl!}
                              alt="Back"
                              placement={getCardSideImage(card, 'back').placement}
                              onChange={(backImagePlacement) => updateCard(card.id, { backImagePlacement })}
                            />
                            {card.backImageCandidates?.length ? (
                              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status" aria-live="polite">
                                {card.backImageCandidates.length} replacement option{card.backImageCandidates.length === 1 ? '' : 's'} need review. The current image was kept.
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => fileInputRefs.current[`${card.id}-back`]?.click()}
                              >
                                <ImageIcon className="mr-2" weight="bold" />
                                Upload change
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openWebImageSearch(card.id, 'back')}
                              >
                                <MagnifyingGlass className="mr-2" weight="bold" />
                                {card.backImageCandidates?.length ? 'Review image options' : 'Search again'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {card.backImageCandidates?.length ? (
                              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status" aria-live="polite">
                                {card.backImageCandidates.length} image option{card.backImageCandidates.length === 1 ? '' : 's'} need review. No image was applied.
                              </div>
                            ) : null}
                            <div
                              onClick={() => fileInputRefs.current[`${card.id}-back`]?.click()}
                              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                            >
                              <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" weight="duotone" />
                              <p className="text-sm font-medium text-foreground mb-1">Add back image</p>
                              <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                            </div>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => openWebImageSearch(card.id, 'back')}
                            >
                              <MagnifyingGlass className="mr-2" weight="bold" />
                              {card.backImageCandidates?.length ? 'Review image options' : 'Search Web Images'}
                            </Button>
                          </div>
                        )}

                        <input
                          ref={(el) => {
                            fileInputRefs.current[`${card.id}-back`] = el
                          }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleImageUpload(card.id, file, 'back')
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="design" className="space-y-6 mt-6">
          <Suspense fallback={<LazySectionFallback label="design controls" />}>
            <DesignPanel
              settings={set.printSettings}
              cardType={set.cardType}
              onUpdate={(updates) => {
                updateSet(prev => ({
                  ...prev,
                  printSettings: { ...prev.printSettings, ...updates },
                }))
              }}
              onUpdateCardType={(cardType) => {
                updateSet(prev => ({ ...prev, cardType }))
              }}
              onResetToDefaults={handleResetFormatting}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Print Preview</CardTitle>
              <CardDescription className="text-base">
                {pages.length} page{pages.length !== 1 ? 's' : ''}
                {set.cardType === 'double-sided' && set.printSettings.duplexMode !== 'manual'
                  ? ` front + ${pages.length} back`
                  : ''}
                {' · '}{set.cards.length} card{set.cards.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto overflow-y-hidden rounded-b-xl bg-gradient-to-br from-slate-200 via-slate-100 to-blue-50 p-4 sm:p-6">
              <div ref={previewContainerRef} className="space-y-8 flex flex-col items-center">
                {pages.map((pageCards, pageIndex) => {
                  const isDoubleSidedPreview =
                    set.cardType === 'double-sided' &&
                    set.printSettings.duplexMode &&
                    set.printSettings.duplexMode !== 'manual'

                  const backPageCardsPreview = isDoubleSidedPreview
                    ? (() => {
                        const duplexMode = set.printSettings.duplexMode as 'long-edge' | 'short-edge'
                        const backPositions = calculateBackPagePositions(
                          set.printSettings.cardsPerPage,
                          duplexMode,
                          set.printSettings.orientation,
                        )
                        return backPositions.map((pos) => pageCards[pos])
                      })()
                    : null

                  const naturalWidth = layout.pageWidth * 0.5
                  const naturalHeight = layout.pageHeight * 0.5
                  const previewScale = previewContainerWidth > 0
                    ? Math.min(1, previewContainerWidth / naturalWidth)
                    : 1

                  const previewPageShadow = 'bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_32px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)]'

                  const innerPageStyle = {
                    padding: `${layout.marginTop * 0.5}px ${layout.marginRight * 0.5}px ${layout.marginBottom * 0.5}px ${layout.marginLeft * 0.5}px`,
                    width: `${naturalWidth}px`,
                    height: `${naturalHeight}px`,
                    boxSizing: 'border-box' as const,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                  }

                  const scaledWrapperStyle = {
                    width: `${naturalWidth * previewScale}px`,
                    height: `${naturalHeight * previewScale}px`,
                    overflow: 'hidden' as const,
                    flexShrink: 0,
                  }

                  return (
                    <div key={pageIndex} className="flex flex-col items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                        Page {pageIndex + 1} — Front
                      </div>
                      <div style={scaledWrapperStyle}>
                        <div
                          className={previewPageShadow}
                          style={innerPageStyle}
                        >
                          <div
                            className="grid w-full h-full"
                            style={{
                              gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
                              gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                              gap: `${layout.gapY * 0.5}px ${layout.gapX * 0.5}px`,
                            }}
                          >
                            {pageCards.map((card, cardIndex) => (
                              <FlashCardDisplay
                                key={card?.id ?? `empty-front-${pageIndex}-${cardIndex}`}
                                card={card}
                                settings={set.printSettings}
                                cardWidth={layout.cardWidth * 0.5}
                                cardHeight={layout.cardHeight * 0.5}
                                cardNumber={card ? pageIndex * set.printSettings.cardsPerPage + cardIndex + 1 : undefined}
                                showSetTitle={set.title}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {isDoubleSidedPreview && backPageCardsPreview && (
                        <>
                          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mt-4">
                            Page {pageIndex + 1} — Back
                          </div>
                          <div style={scaledWrapperStyle}>
                            <div
                              className={previewPageShadow}
                              style={innerPageStyle}
                            >
                              <div
                                className="grid w-full h-full"
                                style={{
                                  gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
                                  gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                                  gap: `${layout.gapY * 0.5}px ${layout.gapX * 0.5}px`,
                                }}
                              >
                                {backPageCardsPreview.map((card, cardIndex) => (
                                  <FlashCardDisplay
                                    key={card?.id ? `back-${card.id}` : `empty-back-${pageIndex}-${cardIndex}`}
                                    card={card}
                                    settings={set.printSettings}
                                    cardWidth={layout.cardWidth * 0.5}
                                    cardHeight={layout.cardHeight * 0.5}
                                    side="back"
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {generatedTest && (
          <TabsContent value="test" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">Test Preview</CardTitle>
                <CardDescription className="text-base">
                  {generatedTest.length} question{generatedTest.length !== 1 ? 's' : ''}
                  {set.testSettings.includeAnswerKey && ' · Includes answer key'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="border-2 rounded-xl overflow-hidden shadow-md">
                    <Suspense fallback={<LazySectionFallback label="test preview" />}>
                      <TestDisplay
                        questions={generatedTest}
                        settings={set.testSettings}
                        showAnswers={false}
                      />
                    </Suspense>
                  </div>
                  
                  {set.testSettings.includeAnswerKey && (
                    <div className="border-2 rounded-xl overflow-hidden shadow-md">
                      <Suspense fallback={<LazySectionFallback label="answer key" />}>
                        <AnswerKey
                          questions={generatedTest}
                          settings={set.testSettings}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={revisionDialogOpen} onOpenChange={(open) => {
        if (revisionLoading && !open) return
        setRevisionDialogOpen(open)
      }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Revise current deck with AI</DialogTitle>
            <DialogDescription>
              Review the proposed changes before applying them to the selected cards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">{selectedRevisionCards.length} selected card{selectedRevisionCards.length === 1 ? '' : 's'}</p>
              <p className="text-muted-foreground">Unselected cards will not be changed.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="revision-feedback">Revision feedback</Label>
              <Textarea
                id="revision-feedback"
                value={revisionFeedback}
                onChange={(event) => setRevisionFeedback(event.target.value)}
                rows={4}
                placeholder="Replace irrelevant images and use wider framing. Make answers shorter. Revise only the selected cards."
                disabled={revisionLoading}
              />
            </div>

            <div className="space-y-2">
              <Label>Revision scope</Label>
              <div className="inline-flex flex-wrap gap-1 rounded-md border p-1" role="group" aria-label="Revision scope">
                {([
                  ['text', 'Text only'],
                  ['images', 'Images only'],
                  ['both', 'Text and images'],
                ] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={revisionScope === value ? 'default' : 'ghost'}
                    aria-pressed={revisionScope === value}
                    disabled={revisionLoading}
                    onClick={() => {
                      setRevisionScope(value)
                      setRevisionPreview(null)
                      setRevisionError(null)
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="revision-agent-model">AI model</Label>
                <Input id="revision-agent-model" value={flashcardAgentModel} onChange={(event) => setFlashcardAgentModel(event.target.value)} placeholder="your-provider-model" disabled={revisionLoading} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="revision-agent-base-url">OpenAI-compatible base URL</Label>
                <Input id="revision-agent-base-url" value={flashcardAgentBaseUrl} onChange={(event) => setFlashcardAgentBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" disabled={revisionLoading} />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="revision-agent-ai-key">BYOK AI API key</Label>
                <Input id="revision-agent-ai-key" type="password" value={flashcardAgentAiKey} onChange={(event) => setFlashcardAgentAiKey(event.target.value)} placeholder="Only sent to your chosen provider when you run revision" disabled={revisionLoading} />
              </div>
            </div>

            {revisionError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {revisionError}
              </div>
            )}

            {revisionPreview && (
              <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border p-3">
                {selectedRevisionCards.map((original) => {
                  const changes = getPatchChanges(original, revisionPreview)
                  if (changes.length === 0) return null
                  return (
                    <div key={original.id} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="font-semibold">Card {set.cards.findIndex((item) => item.id === original.id) + 1}</p>
                        <p className="text-xs text-muted-foreground">{changes.length} change{changes.length === 1 ? '' : 's'}</p>
                      </div>
                      {changes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No changes returned for this card.</p>
                      ) : (
                        <div className="space-y-3">
                          {changes.map((change) => (
                            <div key={`${original.id}-${change.field}`} className="grid gap-2 text-sm sm:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                  {change.field === 'frontText' ? 'Front before'
                                    : change.field === 'backText' ? 'Back before'
                                      : change.field === 'frontImageQuery' ? 'Front image query'
                                        : 'Back image query'}
                                </p>
                                <p className="rounded bg-muted p-2">{change.before || 'No existing value'}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                  {change.field === 'frontText' ? 'Front after'
                                    : change.field === 'backText' ? 'Back after'
                                      : 'Suggested query'}
                                </p>
                                <p className="rounded bg-primary/10 p-2">{change.after}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={testAiConnection} disabled={aiConnectionTestLoading || revisionLoading}>
                <Sparkle className="mr-2" weight="bold" />
                {aiConnectionTestLoading ? 'Testing...' : 'Test AI connection'}
              </Button>
              <Button variant="outline" onClick={() => setRevisionDialogOpen(false)} disabled={revisionLoading}>
                Cancel
              </Button>
              <Button variant="outline" onClick={runRevisionAgent} disabled={revisionLoading}>
                <Sparkle className="mr-2" weight="bold" />
                {revisionLoading ? 'Revising...' : revisionPreview ? 'Rerun revision' : 'Preview revision'}
              </Button>
              <Button onClick={applyRevisionPreview} disabled={!revisionPreview || revisionLoading}>
                <CheckCircle className="mr-2" weight="bold" />
                Apply revision
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={imageAgentOpen} onOpenChange={(open) => {
        if (imageAgentLoading && !open) return
        setImageAgentOpen(open)
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Flashcard Agent (BYOK)</DialogTitle>
            <DialogDescription>
              Create full decks with your own AI key: front text, back text, front/back image ideas, and real web images.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              FlashForge can help find and attach images, but you choose what to use. You assume responsibility for copyright, likeness, classroom appropriateness, and any other image-use risks.
            </div>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={imageAgentAcceptedRisk}
                onChange={(event) => setImageAgentAcceptedRisk(event.target.checked)}
              />
              <span>I understand that I am responsible for the images I choose to search for, insert, print, share, or publish.</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="flashcard-agent-mode">Agent mode</Label>
                <Select value={flashcardAgentMode} onValueChange={(value) => {
                  if (!imageAgentLoading) setFlashcardAgentMode(value as FlashcardAgentMode)
                }}>
                  <SelectTrigger id="flashcard-agent-mode" disabled={imageAgentLoading}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enhance">Enhance current cards</SelectItem>
                    <SelectItem value="create">Create new cards</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="flashcard-agent-count">Deck size / new cards</Label>
                <Input id="flashcard-agent-count" type="number" min="1" max="60" value={flashcardAgentCount} onChange={(event) => setFlashcardAgentCount(event.target.value)} disabled={imageAgentLoading} />
                <p className="text-xs text-muted-foreground">Default 24. Max 60 per run (larger = slower).</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="flashcard-agent-instructions">Agent instructions</Label>
              <Textarea id="flashcard-agent-instructions" value={flashcardAgentInstructions} onChange={(event) => setFlashcardAgentInstructions(event.target.value)} rows={3} disabled={imageAgentLoading} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="flashcard-agent-model">AI model</Label>
                <Input id="flashcard-agent-model" value={flashcardAgentModel} onChange={(event) => setFlashcardAgentModel(event.target.value)} placeholder="your-provider-model" disabled={imageAgentLoading} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="flashcard-agent-base-url">OpenAI-compatible base URL</Label>
                <Input id="flashcard-agent-base-url" value={flashcardAgentBaseUrl} onChange={(event) => setFlashcardAgentBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" disabled={imageAgentLoading} />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="flashcard-agent-ai-key">BYOK AI API key</Label>
                <Input id="flashcard-agent-ai-key" type="password" value={flashcardAgentAiKey} onChange={(event) => setFlashcardAgentAiKey(event.target.value)} placeholder="Required for full-deck AI generation; only sent to your chosen provider when you run the agent" disabled={imageAgentLoading} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="image-agent-side">Apply images to</Label>
                <Select value={imageAgentSide} onValueChange={(value) => {
                  if (!imageAgentLoading) setImageAgentSide(value as ImageAgentTargetSide)
                }}>
                  <SelectTrigger id="image-agent-side" disabled={imageAgentLoading}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="front">Front only</SelectItem>
                    <SelectItem value="back">Back only</SelectItem>
                    <SelectItem value="both">Front and back</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2 rounded-md border p-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={flashcardAgentGenerateText} disabled={imageAgentLoading} onChange={(event) => setFlashcardAgentGenerateText(event.target.checked)} />
                    Let AI create/rewrite front and back text
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={imageAgentOverwrite} disabled={imageAgentLoading} onChange={(event) => setImageAgentOverwrite(event.target.checked)} />
                    Overwrite existing images
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={imageAgentEmbed} disabled={imageAgentLoading} onChange={(event) => setImageAgentEmbed(event.target.checked)} />
                    Download/embed images when possible
                  </label>
                  <p className="text-xs text-muted-foreground">Agent-added images start centered with the existing crop controls set to neutral zoom/offset; you can still fine-tune each card manually.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image-agent-query">Search query template</Label>
              <Input
                id="image-agent-query"
                value={imageAgentQueryTemplate}
                onChange={(event) => setImageAgentQueryTemplate(event.target.value)}
                placeholder="{front} funny character clear image"
                disabled={imageAgentLoading}
              />
              <p className="text-xs text-muted-foreground">
                Variables: {'{front}'}, {'{back}'}, {'{text}'}, {'{title}'}, {'{side}'}. Example: {'{front} funny character Japanese students recognize'}.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={testAiConnection} disabled={aiConnectionTestLoading || imageAgentLoading}>
                <Sparkle className="mr-2" weight="bold" />
                {aiConnectionTestLoading ? 'Testing...' : 'Test AI connection'}
              </Button>
              <Button variant="outline" onClick={() => setImageSearchSettingsOpen(true)}>
                <Gear className="mr-2" weight="bold" />
                Image Search Settings
              </Button>
              {imageAgentLoading ? (
                <Button variant="outline" onClick={() => imageAgentCancelRef.current?.()}>
                  <X className="mr-2" weight="bold" />
                  Cancel
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setImageAgentOpen(false)}>
                  Done
                </Button>
              )}
              <Button onClick={runImageAgent} disabled={imageAgentLoading || !imageAgentAcceptedRisk}>
                <Sparkle className="mr-2" weight="bold" />
                {imageAgentLoading ? 'Working...' : 'Run Flashcard Agent'}
              </Button>
            </div>

            {imageAgentProgress && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{imageAgentProgress.phase === 'text' ? 'Generating text…' : 'Searching images…'}</span>
                  <span>{imageAgentProgress.done}/{imageAgentProgress.total}</span>
                </div>
                <Progress value={imageAgentProgress.total > 0 ? (imageAgentProgress.done / imageAgentProgress.total) * 100 : 0} className="h-2" />
              </div>
            )}

            {imageAgentSummary && !imageAgentLoading && (
              <p className={
                imageAgentSummaryTone === 'error'
                  ? 'text-sm font-medium text-red-700 dark:text-red-400'
                  : imageAgentSummaryTone === 'warning'
                    ? 'text-sm font-medium text-amber-700 dark:text-amber-400'
                    : 'text-sm font-medium text-green-700 dark:text-green-400'
              }>{imageAgentSummary}</p>
            )}

            {imageAgentLog.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
                {imageAgentLog.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={imageSearchOpen} onOpenChange={setImageSearchOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Search Web Images</DialogTitle>
            <DialogDescription>Find a real web image and insert it directly into your flashcard. Configure providers in Image Search Settings — Openverse works with no key.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={imageSearchQuery}
                onChange={(e) => setImageSearchQuery(e.target.value)}
                placeholder="Search for an image..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    runWebImageSearch()
                  }
                }}
              />
              <Button onClick={runWebImageSearch} disabled={imageSearchLoading} className="sm:w-auto">
                <MagnifyingGlass className="mr-2" weight="bold" />
                Search
              </Button>
              <Button variant="outline" onClick={() => setImageSearchSettingsOpen(true)} className="sm:w-auto">
                <Gear className="mr-2" weight="bold" />
                Settings
              </Button>
            </div>

            {imageSearchResults.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {imageSearchResults.map((result) => (
                  <button
                    key={result.id}
                    className="text-left border rounded-lg overflow-hidden hover:border-primary transition-colors"
                    onClick={() => handleSelectWebImage(result)}
                    type="button"
                  >
                    <img
                      src={result.thumbnailUrl || result.url}
                      alt={result.title}
                      className="w-full h-28 object-cover bg-muted"
                    />
                    <div className="space-y-1 p-2 text-xs">
                      <p className="line-clamp-2">{result.title}</p>
                      <p className={result.needsReview ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                        {result.needsReview ? 'Needs review' : `${result.confidence} confidence`} · {result.provider}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No results yet. Search by keyword to load image options. If results are empty, configure a provider in Image Search Settings (Openverse works without any key).</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={imageSearchSettingsOpen} onOpenChange={setImageSearchSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Image Search Settings</DialogTitle>
            <DialogDescription>
              Configure image search providers. <strong>Openverse works with no key.</strong> Auto mode tries all configured providers in order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="image-provider-select">Provider</Label>
              <Select value={imageProvider} onValueChange={setImageProvider}>
                <SelectTrigger id="image-provider-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (tries all configured providers)</SelectItem>
                  <SelectItem value="brave">Brave Image Search</SelectItem>
                  <SelectItem value="pixabay">Pixabay</SelectItem>
                  <SelectItem value="pexels">Pexels</SelectItem>
                  <SelectItem value="google">Google Custom Search</SelectItem>
                  <SelectItem value="openverse">Openverse (no key needed)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Auto priority: Google → Brave → Pixabay → Pexels → Openverse. Openverse always available as keyless fallback.</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">API Keys (stored locally, never shared)</p>
              <div className="space-y-2">
                <Label htmlFor="img-brave-key" className="flex items-center justify-between">
                  <span>Brave Search API token</span>
                  {serverSearchConfig?.brave && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle weight="fill" />Server configured</span>}
                </Label>
                <Input id="img-brave-key" type="password" value={imageBraveKey} onChange={(e) => setImageBraveKey(e.target.value)} placeholder={serverSearchConfig?.brave ? 'Configured on server — override here (optional)' : 'X-Subscription-Token from Brave API'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="img-pixabay-key" className="flex items-center justify-between">
                  <span>Pixabay API key</span>
                  {serverSearchConfig?.pixabay && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle weight="fill" />Server configured</span>}
                </Label>
                <Input id="img-pixabay-key" type="password" value={imagePixabayKey} onChange={(e) => setImagePixabayKey(e.target.value)} placeholder={serverSearchConfig?.pixabay ? 'Configured on server — override here (optional)' : 'Pixabay API key (free at pixabay.com/api/docs)'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="img-pexels-key" className="flex items-center justify-between">
                  <span>Pexels API key</span>
                  {serverSearchConfig?.pexels && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle weight="fill" />Server configured</span>}
                </Label>
                <Input id="img-pexels-key" type="password" value={imagePexelsKey} onChange={(e) => setImagePexelsKey(e.target.value)} placeholder={serverSearchConfig?.pexels ? 'Configured on server — override here (optional)' : 'Pexels API key (free at pexels.com/api)'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="img-google-key" className="flex items-center justify-between">
                  <span>Google API key</span>
                  {serverSearchConfig?.google && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle weight="fill" />Server configured</span>}
                </Label>
                <Input id="img-google-key" type="password" value={imageGoogleKey} onChange={(e) => setImageGoogleKey(e.target.value)} placeholder={serverSearchConfig?.google ? 'Configured on server — override here (optional)' : 'Google API key for Custom Search'} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="img-google-cx">Google Custom Search Engine ID (cx)</Label>
                <Input id="img-google-cx" value={imageGoogleCx} onChange={(e) => setImageGoogleCx(e.target.value)} placeholder="Your Google Custom Search cx" />
              </div>
              {serverSearchConfig && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                  <strong>Server status:</strong> {Object.entries(serverSearchConfig).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'} configured via environment.
                  {serverSearchConfig.openverse && <span> Openverse is always available.</span>}
                </div>
              )}
              <div className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Provider test</p>
                    <p className="text-xs text-muted-foreground">Runs "giraffe" through the selected provider/Auto path without showing keys.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={testImageSearchProvider} disabled={imageSearchTestLoading}>
                    <MagnifyingGlass className="mr-2" weight="bold" />
                    {imageSearchTestLoading ? 'Testing...' : 'Test image search'}
                  </Button>
                </div>
                {imageSearchTestResult && (
                  <p className={`mt-3 text-xs ${imageSearchTestResult.startsWith('OK:') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                    {imageSearchTestResult}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setImageSearchSettingsOpen(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {createPortal(
        <div className="print-only">
          {generatedTest ? (
            <>
              <div className="page-break-after">
                <Suspense fallback={null}>
                  <TestDisplay
                    questions={generatedTest}
                    settings={set.testSettings}
                    showAnswers={false}
                  />
                </Suspense>
              </div>

              {set.testSettings.includeAnswerKey && (
                <div>
                  <Suspense fallback={null}>
                    <AnswerKey
                      questions={generatedTest}
                      settings={set.testSettings}
                    />
                  </Suspense>
                </div>
              )}
            </>
          ) : (
            <>
              {pages.map((pageCards, pageIndex) => {
                const isLastPage = pageIndex === pages.length - 1
                const isDoubleSided =
                  set.cardType === 'double-sided' &&
                  set.printSettings.duplexMode &&
                  set.printSettings.duplexMode !== 'manual'

                const backPageCards = isDoubleSided
                  ? (() => {
                      const duplexMode = set.printSettings.duplexMode as 'long-edge' | 'short-edge'
                      const backPositions = calculateBackPagePositions(
                        set.printSettings.cardsPerPage,
                        duplexMode,
                        set.printSettings.orientation,
                      )
                      return backPositions.map((pos) => pageCards[pos])
                    })()
                  : null

                return (
                  <div key={pageIndex}>
                    <div
                      className="avoid-break print-page"
                      style={{
                        width: set.printSettings.paperSize === 'a4'
                          ? (set.printSettings.orientation === 'landscape' ? '297mm' : '210mm')
                          : (set.printSettings.orientation === 'landscape' ? '11in' : '8.5in'),
                          height: set.printSettings.paperSize === 'a4'
                            ? (set.printSettings.orientation === 'landscape' ? '210mm' : '297mm')
                            : (set.printSettings.orientation === 'landscape' ? '8.5in' : '11in'),
                        padding: `${layout.marginTop}px ${layout.marginRight}px ${layout.marginBottom}px ${layout.marginLeft}px`,
                        pageBreakAfter: 'always',
                        breakAfter: 'page',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        ['--print-offset-x' as string]: `${set.printSettings.horizontalOffset}px`,
                        ['--print-offset-y' as string]: `${set.printSettings.verticalOffset}px`,
                      } as CSSProperties}
                    >
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                          gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                          gap: `${layout.gapY}px ${layout.gapX}px`,
                          width: '100%',
                          height: '100%',
                        }}
                      >
                        {pageCards.map((card, cardIndex) => (
                          <FlashCardDisplay
                            key={card?.id ?? `print-empty-front-${pageIndex}-${cardIndex}`}
                            card={card}
                            settings={set.printSettings}
                            cardWidth={layout.cardWidth}
                            cardHeight={layout.cardHeight}
                            cardNumber={card ? pageIndex * set.printSettings.cardsPerPage + cardIndex + 1 : undefined}
                            showSetTitle={set.title}
                            printMode={true}
                          />
                        ))}
                      </div>
                    </div>

                    {isDoubleSided && backPageCards && (
                      <div
                        className="avoid-break print-page print-back-page"
                        style={{
                          width: set.printSettings.paperSize === 'a4'
                            ? (set.printSettings.orientation === 'landscape' ? '297mm' : '210mm')
                            : (set.printSettings.orientation === 'landscape' ? '11in' : '8.5in'),
                          height: set.printSettings.paperSize === 'a4'
                            ? (set.printSettings.orientation === 'landscape' ? '210mm' : '297mm')
                            : (set.printSettings.orientation === 'landscape' ? '8.5in' : '11in'),
                          padding: `${layout.marginTop}px ${layout.marginRight}px ${layout.marginBottom}px ${layout.marginLeft}px`,
                          pageBreakAfter: isLastPage ? 'auto' : 'always',
                          breakAfter: isLastPage ? 'auto' : 'page',
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          ['--print-offset-x' as string]: `${set.printSettings.horizontalOffset}px`,
                          ['--print-offset-y' as string]: `${set.printSettings.verticalOffset}px`,
                          ['--back-page-offset-x' as string]: `${set.printSettings.backPageOffsetX}mm`,
                          ['--back-page-offset-y' as string]: `${set.printSettings.backPageOffsetY}mm`,
                        } as CSSProperties}
                      >
                        <div
                          className="grid"
                          style={{
                            gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                            gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                            gap: `${layout.gapY}px ${layout.gapX}px`,
                            width: '100%',
                            height: '100%',
                          }}
                        >
                          {backPageCards.map((card, cardIndex) => (
                            <FlashCardDisplay
                              key={card?.id ? `back-${card.id}` : `print-empty-back-${pageIndex}-${cardIndex}`}
                              card={card}
                              settings={set.printSettings}
                              cardWidth={layout.cardWidth}
                              cardHeight={layout.cardHeight}
                              side="back"
                              printMode={true}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}

export default App
