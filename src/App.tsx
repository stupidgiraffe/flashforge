import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import type { CSSProperties, PointerEventHandler, WheelEventHandler } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Printer, DownloadSimple, UploadSimple, Exam, Image as ImageIcon, Trash, ArrowLeft, DotsThreeVertical, Copy, Sparkle, Stack, CloudArrowUp, CloudArrowDown, LinkSimple, MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast, Toaster } from 'sonner'
import type { FlashCardSet, FlashCard } from '@/lib/types'
import { DEFAULT_PRINT_SETTINGS, DEFAULT_TEST_SETTINGS } from '@/lib/types'
import { loadSets, saveSet, deleteSet, generateUniqueId, compressImage, exportSetToJSON, importSetFromJSON, exportAllSetsToJSON, importAllSetsFromJSON, duplicateSet, getStorageStats } from '@/lib/storage'
import { FlashCardDisplay } from '@/components/FlashCardDisplay'
import { StarterPackBrowser } from '@/components/StarterPackBrowser'
import { generateTestQuestions } from '@/lib/test-utils'
import { calculatePrintLayout, paginateCardsFixedLength, calculateBackPagePositions } from '@/lib/print-utils'
import { createStarterSet } from '@/lib/starter-sets'

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
const MAX_IMAGE_OFFSET = 180
const MIN_IMAGE_SCALE = 0.6
const MAX_IMAGE_SCALE = 2
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

function clampImageOffset(base: number, delta: number): number {
  return Math.max(-MAX_IMAGE_OFFSET, Math.min(MAX_IMAGE_OFFSET, base + delta))
}

function clampImageScale(scale: number): number {
  return Math.max(MIN_IMAGE_SCALE, Math.min(MAX_IMAGE_SCALE, scale))
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

  function handleCreateStarterSet(templateId: string) {
    const starter = createStarterSet(templateId)
    if (!starter) {
      toast.error('Starter pack not found')
      return
    }

    saveSet(starter)
    setSets((prev) => sortSetsByRecent([starter, ...prev]))
    setCurrentSet(starter)
    toast.success(`Created "${starter.title}"`)
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
                    <p className="text-muted-foreground mb-6 text-center">Create a blank set or start from a polished teaching pack.</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button onClick={() => setCreateDialogOpen(true)} size="lg" className="shadow-md">
                        <Plus className="mr-2" weight="bold" />
                        Create Blank Set
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <StarterPackBrowser onUseTemplate={handleCreateStarterSet} />
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
                <StarterPackBrowser onUseTemplate={handleCreateStarterSet} />
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

interface ImageSearchResult {
  title: string
  link: string
  thumbnailLink?: string
}

type ImageAgentTargetSide = 'front' | 'back' | 'both'
type FlashcardAgentMode = 'create' | 'enhance'

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

interface ImageCropEditorProps {
  imageUrl: string
  alt: string
  scale: number
  offsetX: number
  offsetY: number
  onChange: (updates: { offsetX?: number; offsetY?: number; scale?: number }) => void
}

function ImageCropEditor({ imageUrl, alt, scale, offsetX, offsetY, onChange }: ImageCropEditorProps) {
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchRef = useRef<{
    startDistance: number
    startScale: number
    startOffsetX: number
    startOffsetY: number
    midpointX: number
    midpointY: number
    centerX: number
    centerY: number
  } | null>(null)

  const getPointerPair = () => {
    const [first, second] = Array.from(activePointersRef.current.values())
    if (!first || !second) return null
    return { first, second }
  }

  const initializePinch = (target: HTMLDivElement) => {
    const pair = getPointerPair()
    if (!pair) return
    const rect = target.getBoundingClientRect()
    const dx = pair.second.x - pair.first.x
    const dy = pair.second.y - pair.first.y
    const distance = Math.hypot(dx, dy)
    if (distance <= 0) return

    pinchRef.current = {
      startDistance: distance,
      startScale: scale,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
      midpointX: (pair.first.x + pair.second.x) / 2 - rect.left,
      midpointY: (pair.first.y + pair.second.y) / 2 - rect.top,
      centerX: rect.width / 2,
      centerY: rect.height / 2,
    }
  }

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: offsetX,
      baseY: offsetY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (activePointersRef.current.size >= 2) {
      dragRef.current = null
      initializePinch(event.currentTarget)
    }
  }

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }

    if (activePointersRef.current.size >= 2) {
      if (!pinchRef.current) {
        initializePinch(event.currentTarget)
      }
      const pinchState = pinchRef.current
      const pair = getPointerPair()
      if (pinchState && pair) {
        const dx = pair.second.x - pair.first.x
        const dy = pair.second.y - pair.first.y
        const distance = Math.hypot(dx, dy)
        if (distance > 0) {
          const nextScale = clampImageScale(pinchState.startScale * (distance / pinchState.startDistance))
          const ratio = nextScale / pinchState.startScale
          const relativeX = pinchState.midpointX - pinchState.centerX - pinchState.startOffsetX
          const relativeY = pinchState.midpointY - pinchState.centerY - pinchState.startOffsetY
          const nextOffsetX = clampImageOffset(pinchState.startOffsetX, (1 - ratio) * relativeX)
          const nextOffsetY = clampImageOffset(pinchState.startOffsetY, (1 - ratio) * relativeY)
          onChange({ scale: nextScale, offsetX: nextOffsetX, offsetY: nextOffsetY })
        }
      }
      return
    }

    const dragState = dragRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) return
    const nextX = clampImageOffset(dragState.baseX, event.clientX - dragState.startX)
    const nextY = clampImageOffset(dragState.baseY, event.clientY - dragState.startY)
    onChange({ offsetX: nextX, offsetY: nextY })
  }

  const handlePointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    activePointersRef.current.delete(event.pointerId)
    if (activePointersRef.current.size < 2) {
      pinchRef.current = null
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  const handleWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()

    const rect = event.currentTarget.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const midpointX = event.clientX - rect.left
    const midpointY = event.clientY - rect.top
    const nextScale = clampImageScale(scale * Math.exp(-event.deltaY * 0.002))
    const ratio = nextScale / scale
    const relativeX = midpointX - centerX - offsetX
    const relativeY = midpointY - centerY - offsetY
    const nextOffsetX = clampImageOffset(offsetX, (1 - ratio) * relativeX)
    const nextOffsetY = clampImageOffset(offsetY, (1 - ratio) * relativeY)
    onChange({ scale: nextScale, offsetX: nextOffsetX, offsetY: nextOffsetY })
  }

  return (
    <div className="space-y-3">
      <div
        className="relative rounded-lg overflow-hidden border-2 border-border bg-muted/20 h-48 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover select-none"
          draggable={false}
          style={{
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Crop / zoom</span>
          <span>{Math.round(scale * 100)}%</span>
        </div>
        <Slider
          value={[scale]}
          onValueChange={([value]) => onChange({ scale: value })}
          min={MIN_IMAGE_SCALE}
          max={MAX_IMAGE_SCALE}
          step={0.05}
        />
        <p className="text-xs text-muted-foreground">Drag image to reposition. Pinch (touch/trackpad) or Ctrl/Cmd + wheel to zoom and crop tighter.</p>
      </div>
    </div>
  )
}

function SetEditor({ set, onBack, onUpdate, onDuplicate, googleImageApiKey, googleImageSearchCx, onOpenGoogleSettings }: SetEditorProps) {
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [generatedTest, setGeneratedTest] = useState<ReturnType<typeof generateTestQuestions> | null>(null)
  const [imageSearchOpen, setImageSearchOpen] = useState(false)
  const [imageSearchCardId, setImageSearchCardId] = useState<string | null>(null)
  const [imageSearchSide, setImageSearchSide] = useState<'front' | 'back'>('front')
  const [imageSearchQuery, setImageSearchQuery] = useState('')
  const [imageSearchResults, setImageSearchResults] = useState<ImageSearchResult[]>([])
  const [imageSearchLoading, setImageSearchLoading] = useState(false)
  const [imageAgentOpen, setImageAgentOpen] = useState(false)
  const [flashcardAgentMode, setFlashcardAgentMode] = useState<FlashcardAgentMode>('enhance')
  const [flashcardAgentInstructions, setFlashcardAgentInstructions] = useState('Create a complete funny, classroom-safe ESL deck. Use short front text, useful back text, and specific real web image search queries for each side.')
  const [flashcardAgentCount, setFlashcardAgentCount] = useState('120')
  const [flashcardAgentAiKey, setFlashcardAgentAiKey] = useState('')
  const [flashcardAgentBaseUrl, setFlashcardAgentBaseUrl] = useState('https://api.openai.com/v1')
  const [flashcardAgentModel, setFlashcardAgentModel] = useState('')
  const [flashcardAgentGenerateText, setFlashcardAgentGenerateText] = useState(true)
  const [imageAgentSide, setImageAgentSide] = useState<ImageAgentTargetSide>('both')
  const [imageAgentQueryTemplate, setImageAgentQueryTemplate] = useState('{front} funny character clear image')
  const [imageAgentEmbed, setImageAgentEmbed] = useState(false)
  const [imageAgentOverwrite, setImageAgentOverwrite] = useState(false)
  const [imageAgentAcceptedRisk, setImageAgentAcceptedRisk] = useState(false)
  const [imageAgentLoading, setImageAgentLoading] = useState(false)
  const [imageAgentLog, setImageAgentLog] = useState<string[]>([])
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [previewContainerWidth, setPreviewContainerWidth] = useState(0)
  const previewObserverRef = useRef<ResizeObserver | null>(null)

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
          updateCard(cardId, { frontImageUrl: compressed, frontImageScale: 1, frontImageOffsetX: 0, frontImageOffsetY: 0 })
        } else if (side === 'back') {
          updateCard(cardId, { backImageUrl: compressed, backImageScale: 1, backImageOffsetX: 0, backImageOffsetY: 0 })
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
      updateCard(cardId, { frontImageUrl: undefined, frontImageScale: 1, frontImageOffsetX: 0, frontImageOffsetY: 0 })
    } else if (side === 'back') {
      updateCard(cardId, { backImageUrl: undefined, backImageScale: 1, backImageOffsetX: 0, backImageOffsetY: 0 })
    } else {
      updateCard(cardId, { imageUrl: undefined, imagePosition: 'front', imageScale: 1 })
    }
    toast.success('Image removed')
  }

  function openWebImageSearch(cardId: string, side: 'front' | 'back') {
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
      const response = await fetch('/api/image-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: imageSearchQuery.trim(),
          googleApiKey: googleImageApiKey.trim(),
          googleCx: googleImageSearchCx.trim(),
          provider: 'auto',
          limit: 10,
        }),
      })
      if (!response.ok) {
        if (googleImageApiKey.trim() && googleImageSearchCx.trim()) {
          const fallback = await fetch(`https://www.googleapis.com/customsearch/v1?searchType=image&num=10&q=${encodeURIComponent(imageSearchQuery.trim())}&key=${encodeURIComponent(googleImageApiKey.trim())}&cx=${encodeURIComponent(googleImageSearchCx.trim())}`)
          if (!fallback.ok) throw new Error('Image search failed')
          const data = await fallback.json() as { items?: Array<{ title?: string; link?: string; image?: { thumbnailLink?: string } }> }
          const results = (data.items ?? [])
            .filter((item): item is { title?: string; link: string; image?: { thumbnailLink?: string } } => Boolean(item.link))
            .map((item) => ({ title: item.title ?? 'Image result', link: item.link, thumbnailLink: item.image?.thumbnailLink }))
          setImageSearchResults(results)
          if (results.length === 0) toast.message('No images found for this keyword')
          return
        }
        const errorBody = await response.json().catch(() => ({ error: 'Image search failed' })) as { error?: string }
        throw new Error(errorBody.error || 'Image search failed')
      }
      const data = await response.json() as { results?: ImageSearchResult[] }
      const results = data.results ?? []
      setImageSearchResults(results)
      if (results.length === 0) toast.message('No images found for this keyword')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to search images')
    } finally {
      setImageSearchLoading(false)
    }
  }

  function handleSelectWebImage(url: string) {
    if (!imageSearchCardId) return
    if (imageSearchSide === 'front') {
      updateCard(imageSearchCardId, { frontImageUrl: url, frontImageScale: 1, frontImageOffsetX: 0, frontImageOffsetY: 0 })
    } else {
      updateCard(imageSearchCardId, { backImageUrl: url, backImageScale: 1, backImageOffsetX: 0, backImageOffsetY: 0 })
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

  async function searchImagesClientSide(cards: ImageAgentCardRequest[]): Promise<ImageAgentResult[]> {
    const results: ImageAgentResult[] = []
    for (const card of cards) {
      try {
        const response = await fetch(`https://www.googleapis.com/customsearch/v1?searchType=image&safe=active&num=1&q=${encodeURIComponent(card.query)}&key=${encodeURIComponent(googleImageApiKey.trim())}&cx=${encodeURIComponent(googleImageSearchCx.trim())}`)
        if (!response.ok) throw new Error(response.status === 429 ? 'rate limited' : 'search failed')
        const data = await response.json() as { items?: Array<{ title?: string; link?: string; image?: { thumbnailLink?: string; contextLink?: string } }> }
        const item = data.items?.find((entry) => entry.link)
        results.push(item?.link
          ? { cardId: card.id, query: card.query, title: item.title, imageUrl: item.link, thumbnailLink: item.image?.thumbnailLink, sourcePage: item.image?.contextLink }
          : { cardId: card.id, query: card.query, error: 'No image found' })
      } catch (error) {
        results.push({ cardId: card.id, query: card.query, error: error instanceof Error ? error.message : 'Search failed' })
      }
    }
    return results
  }

  async function runImageAgent() {
    if (!imageAgentAcceptedRisk) {
      toast.error('Please accept the image-use responsibility notice first')
      return
    }

    const needsAi = flashcardAgentMode === 'create' || flashcardAgentGenerateText
    if (needsAi && (!flashcardAgentAiKey.trim() || !flashcardAgentModel.trim())) {
      toast.error('Enter your BYOK AI API key and model first, or turn off text generation for image-only enhancement')
      return
    }

    try {
      setImageAgentLoading(true)
      setImageAgentLog([needsAi ? 'Asking the BYOK AI to create flashcard content...' : 'Searching web images for existing cards...'])

      if (needsAi) {
        const requestedCount = Math.max(1, Math.min(Number(flashcardAgentCount || 120), 150))
        const batchSize = flashcardAgentMode === 'create' ? 20 : requestedCount
        const batchTotal = flashcardAgentMode === 'create' ? Math.ceil(requestedCount / batchSize) : 1
        const generatedCards: FlashcardAgentGeneratedCard[] = []

        for (let batchIndex = 0; batchIndex < batchTotal; batchIndex += 1) {
          const batchCount = flashcardAgentMode === 'create' ? Math.min(batchSize, requestedCount - generatedCards.length) : requestedCount
          setImageAgentLog((prev) => [...prev, `Batch ${batchIndex + 1}/${batchTotal}: generating ${batchCount} card${batchCount === 1 ? '' : 's'}...`])
          const response = await fetch('/api/flashcard-agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: flashcardAgentMode,
              title: set.title,
              instructions: `${flashcardAgentInstructions}
${flashcardAgentMode === 'create' ? `This is batch ${batchIndex + 1} of ${batchTotal}. Avoid duplicating these existing/generated cards.` : ''}`,
              count: batchCount,
              existingCards: [...set.cards, ...generatedCards],
              aiApiKey: flashcardAgentAiKey.trim(),
              aiBaseUrl: flashcardAgentBaseUrl.trim(),
              aiModel: flashcardAgentModel.trim(),
              includeImages: true,
              imageSide: imageAgentSide,
              imageProvider: 'auto',
              googleApiKey: googleImageApiKey.trim(),
              googleCx: googleImageSearchCx.trim(),
              embedImages: imageAgentEmbed,
            }),
          })
          const data = await response.json().catch(() => ({ error: 'Flashcard Agent failed' })) as { cards?: FlashcardAgentGeneratedCard[]; error?: string }
          if (!response.ok) throw new Error(data.error || 'Flashcard Agent failed')
          generatedCards.push(...(data.cards ?? []))
        }

        if (generatedCards.length === 0) throw new Error('Flashcard Agent returned no cards')

        updateSet(prev => {
          if (flashcardAgentMode === 'create') {
            return {
              ...prev,
              cards: [...prev.cards, ...generatedCards.map((card) => ({
                id: card.id,
                frontText: card.frontText,
                backText: card.backText,
                frontImageUrl: card.frontImageUrl,
                backImageUrl: card.backImageUrl,
                imagePosition: 'front' as const,
                frontImageScale: 1,
                backImageScale: 1,
                frontImageOffsetX: 0,
                frontImageOffsetY: 0,
                backImageOffsetX: 0,
                backImageOffsetY: 0,
                imageScale: 1,
              }))],
            }
          }
          const byId = new Map(generatedCards.map((card) => [card.id, card]))
          return {
            ...prev,
            cards: prev.cards.map((card) => {
              const generated = byId.get(card.id)
              if (!generated) return card
              return {
                ...card,
                frontText: generated.frontText || card.frontText,
                backText: generated.backText || card.backText,
                frontImageUrl: generated.frontImageUrl || card.frontImageUrl,
                backImageUrl: generated.backImageUrl || card.backImageUrl,
                frontImageScale: 1,
                backImageScale: 1,
                frontImageOffsetX: 0,
                frontImageOffsetY: 0,
                backImageOffsetX: 0,
                backImageOffsetY: 0,
              }
            }),
          }
        })

        const imageNotes = generatedCards.flatMap((card) => card.imageSources ?? [])
        setImageAgentLog([
          `✓ Generated ${generatedCards.length} flashcard${generatedCards.length === 1 ? '' : 's'} across ${batchTotal} batch${batchTotal === 1 ? '' : 'es'}.`,
          ...imageNotes.slice(0, 120).map((source) => source.error ? `✕ ${source.side}: ${source.query}: ${source.error}` : `✓ ${source.side}: ${source.query || source.title || source.url}${source.embedded ? ' (embedded)' : ''}`),
        ])
        toast.success(`Flashcard Agent generated ${generatedCards.length} card${generatedCards.length === 1 ? '' : 's'}`)
        return
      }

      const targetCards = set.cards.filter(cardNeedsAgentImage)
      if (targetCards.length === 0) {
        toast.message('No cards need images with the current settings')
        return
      }
      const cards = targetCards.map((card): ImageAgentCardRequest => ({
        id: card.id,
        frontText: card.frontText,
        backText: card.backText,
        query: buildImageAgentQuery(card, imageAgentSide),
      }))
      const response = await fetch('/api/image-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleApiKey: googleImageApiKey.trim(),
          googleCx: googleImageSearchCx.trim(),
          provider: 'auto',
          cards,
          embedImages: imageAgentEmbed,
        }),
      })
      const data = await response.json().catch(() => ({ results: [], error: 'Flashcard Agent failed' })) as { results?: ImageAgentResult[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'Flashcard Agent failed')
      const results = data.results ?? []
      const resultByCard = new Map(results.filter((result) => result.dataUrl || result.imageUrl).map((result) => [result.cardId, result]))
      updateSet(prev => ({
        ...prev,
        cards: prev.cards.map((card) => {
          const result = resultByCard.get(card.id)
          const imageUrl = result?.dataUrl || result?.imageUrl
          if (!imageUrl) return card
          const updates: Partial<FlashCard> = {}
          if (imageAgentSide === 'front' || imageAgentSide === 'both') {
            updates.frontImageUrl = imageUrl
            updates.frontImageScale = 1
            updates.frontImageOffsetX = 0
            updates.frontImageOffsetY = 0
          }
          if (imageAgentSide === 'back' || imageAgentSide === 'both') {
            updates.backImageUrl = imageUrl
            updates.backImageScale = 1
            updates.backImageOffsetX = 0
            updates.backImageOffsetY = 0
          }
          return { ...card, ...updates }
        }),
      }))
      const applied = resultByCard.size
      const failed = results.length - applied
      setImageAgentLog(results.map((result) => result.error ? `✕ ${result.query}: ${result.error}` : `✓ ${result.query}: ${result.title || result.imageUrl}${result.embedded ? ' (embedded)' : ''}`))
      toast.success(`Flashcard Agent applied ${applied} image${applied === 1 ? '' : 's'}${failed > 0 ? `; ${failed} failed` : ''}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Flashcard Agent failed')
    } finally {
      setImageAgentLoading(false)
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
        <Button variant="outline" onClick={() => setImageAgentOpen(true)} disabled={set.cards.length === 0} className="shadow-sm">
          <Sparkle className="mr-2" weight="bold" />
          Flashcard Agent
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
            set.cards.map((card, index) => (
              <Card key={card.id} className="shadow-md border-2 hover:border-primary/30 transition-colors">
                <CardHeader className="bg-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold">Card {index + 1}</CardTitle>
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
                          {card.frontImageUrl && (
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

                        {card.frontImageUrl ? (
                          <div className="space-y-3">
                            <ImageCropEditor
                              imageUrl={card.frontImageUrl}
                              alt="Front"
                              scale={card.frontImageScale ?? 1}
                              offsetX={card.frontImageOffsetX ?? 0}
                              offsetY={card.frontImageOffsetY ?? 0}
                              onChange={({ offsetX, offsetY, scale }) => updateCard(card.id, {
                                ...(typeof offsetX === 'number' ? { frontImageOffsetX: offsetX } : {}),
                                ...(typeof offsetY === 'number' ? { frontImageOffsetY: offsetY } : {}),
                                ...(typeof scale === 'number' ? { frontImageScale: scale } : {}),
                              })}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => fileInputRefs.current[`${card.id}-front`]?.click()}
                              >
                                <ImageIcon className="mr-2" weight="bold" />
                                Change
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openWebImageSearch(card.id, 'front')}
                              >
                                <MagnifyingGlass className="mr-2" weight="bold" />
                                Search Web Images
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
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
                              Search Web Images
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
                          {card.backImageUrl && (
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

                        {card.backImageUrl ? (
                          <div className="space-y-3">
                            <ImageCropEditor
                              imageUrl={card.backImageUrl}
                              alt="Back"
                              scale={card.backImageScale ?? 1}
                              offsetX={card.backImageOffsetX ?? 0}
                              offsetY={card.backImageOffsetY ?? 0}
                              onChange={({ offsetX, offsetY, scale }) => updateCard(card.id, {
                                ...(typeof offsetX === 'number' ? { backImageOffsetX: offsetX } : {}),
                                ...(typeof offsetY === 'number' ? { backImageOffsetY: offsetY } : {}),
                                ...(typeof scale === 'number' ? { backImageScale: scale } : {}),
                              })}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => fileInputRefs.current[`${card.id}-back`]?.click()}
                              >
                                <ImageIcon className="mr-2" weight="bold" />
                                Change
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openWebImageSearch(card.id, 'back')}
                              >
                                <MagnifyingGlass className="mr-2" weight="bold" />
                                Search Web Images
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
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
                              Search Web Images
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
            ))
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

      <Dialog open={imageAgentOpen} onOpenChange={setImageAgentOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Flashcard Agent</DialogTitle>
            <DialogDescription>
              Create full decks with BYOK AI: front text, back text, front/back image ideas, and real web images.
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
                <Select value={flashcardAgentMode} onValueChange={(value) => setFlashcardAgentMode(value as FlashcardAgentMode)}>
                  <SelectTrigger id="flashcard-agent-mode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enhance">Enhance current cards</SelectItem>
                    <SelectItem value="create">Create new cards</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="flashcard-agent-count">Deck size / new cards</Label>
                <Input id="flashcard-agent-count" type="number" min="1" max="150" value={flashcardAgentCount} onChange={(event) => setFlashcardAgentCount(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="flashcard-agent-instructions">Agent instructions</Label>
              <Textarea id="flashcard-agent-instructions" value={flashcardAgentInstructions} onChange={(event) => setFlashcardAgentInstructions(event.target.value)} rows={3} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="flashcard-agent-model">AI model</Label>
                <Input id="flashcard-agent-model" value={flashcardAgentModel} onChange={(event) => setFlashcardAgentModel(event.target.value)} placeholder="your-provider-model" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="flashcard-agent-base-url">OpenAI-compatible base URL</Label>
                <Input id="flashcard-agent-base-url" value={flashcardAgentBaseUrl} onChange={(event) => setFlashcardAgentBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="flashcard-agent-ai-key">BYOK AI API key</Label>
                <Input id="flashcard-agent-ai-key" type="password" value={flashcardAgentAiKey} onChange={(event) => setFlashcardAgentAiKey(event.target.value)} placeholder="Required for full-deck AI generation; only sent to your chosen provider when you run the agent" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="image-agent-side">Apply images to</Label>
                <Select value={imageAgentSide} onValueChange={(value) => setImageAgentSide(value as ImageAgentTargetSide)}>
                  <SelectTrigger id="image-agent-side">
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
                    <input type="checkbox" checked={flashcardAgentGenerateText} onChange={(event) => setFlashcardAgentGenerateText(event.target.checked)} />
                    Let AI create/rewrite front and back text
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={imageAgentOverwrite} onChange={(event) => setImageAgentOverwrite(event.target.checked)} />
                    Overwrite existing images
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={imageAgentEmbed} onChange={(event) => setImageAgentEmbed(event.target.checked)} />
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
              />
              <p className="text-xs text-muted-foreground">
                Variables: {'{front}'}, {'{back}'}, {'{text}'}, {'{title}'}, {'{side}'}. Example: {'{front} funny character Japanese students recognize'}.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenGoogleSettings()}>
                Search Settings
              </Button>
              <Button onClick={runImageAgent} disabled={imageAgentLoading || !imageAgentAcceptedRisk}>
                <Sparkle className="mr-2" weight="bold" />
                {imageAgentLoading ? 'Working...' : 'Run Flashcard Agent'}
              </Button>
            </div>

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
            <DialogDescription>Find a real web image and insert it directly into your flashcard. Uses FlashForge web search first; Google Custom Search is optional.</DialogDescription>
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
            </div>

            {imageSearchResults.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {imageSearchResults.map((result) => (
                  <button
                    key={result.link}
                    className="text-left border rounded-lg overflow-hidden hover:border-primary transition-colors"
                    onClick={() => handleSelectWebImage(result.link)}
                    type="button"
                  >
                    <img
                      src={result.thumbnailLink || result.link}
                      alt={result.title}
                      className="w-full h-28 object-cover bg-muted"
                    />
                    <div className="p-2 text-xs line-clamp-2">{result.title}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No results yet. Search by keyword to load image options.</p>
            )}
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
