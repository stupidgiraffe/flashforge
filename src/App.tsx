import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Printer, DownloadSimple, UploadSimple, Exam, Image as ImageIcon, Trash, ArrowLeft, DotsThreeVertical, Copy, Sparkle, Stack } from '@phosphor-icons/react'
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

const DesignPanel = lazy(() => import('@/components/DesignPanel').then((module) => ({ default: module.DesignPanel })))
const TestConfigDialog = lazy(() => import('@/components/TestConfigDialog').then((module) => ({ default: module.TestConfigDialog })))
const TestDisplay = lazy(() => import('@/components/TestDisplay').then((module) => ({ default: module.TestDisplay })))
const AnswerKey = lazy(() => import('@/components/TestDisplay').then((module) => ({ default: module.AnswerKey })))

function sortSetsByRecent(items: FlashCardSet[]): FlashCardSet[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt)
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
    const json = exportAllSetsToJSON(sets)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flashforge-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Backup downloaded!')
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Toaster position="bottom-right" />
      
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50 no-print shadow-sm">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              FlashForge
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Create beautiful printable flashcards & tests</p>
          </div>
          
          <div className="flex gap-3">
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
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
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
                              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-8 w-8 p-0"
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
}

function SetEditor({ set, onBack, onUpdate, onDuplicate }: SetEditorProps) {
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [generatedTest, setGeneratedTest] = useState<ReturnType<typeof generateTestQuestions> | null>(null)
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
          updateCard(cardId, { frontImageUrl: compressed, frontImageScale: 1 })
        } else if (side === 'back') {
          updateCard(cardId, { backImageUrl: compressed, backImageScale: 1 })
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
      updateCard(cardId, { frontImageUrl: undefined, frontImageScale: 1 })
    } else if (side === 'back') {
      updateCard(cardId, { backImageUrl: undefined, backImageScale: 1 })
    } else {
      updateCard(cardId, { imageUrl: undefined, imagePosition: 'front', imageScale: 1 })
    }
    toast.success('Image removed')
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
      <div className="flex items-center justify-between no-print">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-3">
            <ArrowLeft className="mr-2" weight="bold" />
            Back to Sets
          </Button>
          <h2 className="text-3xl font-bold">{set.title}</h2>
          {set.subtitle && <p className="text-muted-foreground mt-1">{set.subtitle}</p>}
        </div>
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

      <div className="flex items-center gap-3 mb-6 no-print">
        <Button variant="outline" onClick={() => setShowTestDialog(true)} disabled={set.cards.length === 0} className="shadow-sm">
          <Exam className="mr-2" weight="bold" />
          Generate Test
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
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          {generatedTest && <TabsTrigger value="test">Test</TabsTrigger>}
        </TabsList>

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
                      <Input
                        value={card.frontText}
                        onChange={(e) => updateCard(card.id, { frontText: e.target.value })}
                        placeholder="Enter text for front of card"
                        className="text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Back Text</Label>
                      <Input
                        value={card.backText}
                        onChange={(e) => updateCard(card.id, { backText: e.target.value })}
                        placeholder="Enter text for back of card"
                        className="text-base"
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
                            <div className="relative group rounded-lg overflow-hidden border-2 border-border bg-muted/20">
                              <img 
                                src={card.frontImageUrl} 
                                alt="Front" 
                                className="w-full h-48 object-contain bg-white"
                                style={{ transform: `scale(${card.frontImageScale ?? 1})`, transformOrigin: 'center center' }}
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => fileInputRefs.current[`${card.id}-front`]?.click()}
                                >
                                  <ImageIcon className="mr-2" weight="bold" />
                                  Change
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Front image zoom</span>
                                <span>{Math.round((card.frontImageScale ?? 1) * 100)}%</span>
                              </div>
                              <Slider
                                value={[card.frontImageScale ?? 1]}
                                onValueChange={([value]) => updateCard(card.id, { frontImageScale: value })}
                                min={0.6}
                                max={1.8}
                                step={0.05}
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileInputRefs.current[`${card.id}-front`]?.click()}
                            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                          >
                            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" weight="duotone" />
                            <p className="text-sm font-medium text-foreground mb-1">Add front image</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
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
                            <div className="relative group rounded-lg overflow-hidden border-2 border-border bg-muted/20">
                              <img 
                                src={card.backImageUrl} 
                                alt="Back" 
                                className="w-full h-48 object-contain bg-white"
                                style={{ transform: `scale(${card.backImageScale ?? 1})`, transformOrigin: 'center center' }}
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => fileInputRefs.current[`${card.id}-back`]?.click()}
                                >
                                  <ImageIcon className="mr-2" weight="bold" />
                                  Change
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Back image zoom</span>
                                <span>{Math.round((card.backImageScale ?? 1) * 100)}%</span>
                              </div>
                              <Slider
                                value={[card.backImageScale ?? 1]}
                                onValueChange={([value]) => updateCard(card.id, { backImageScale: value })}
                                min={0.6}
                                max={1.8}
                                step={0.05}
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileInputRefs.current[`${card.id}-back`]?.click()}
                            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                          >
                            <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" weight="duotone" />
                            <p className="text-sm font-medium text-foreground mb-1">Add back image</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
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
            <CardContent className="overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-blue-50 rounded-b-xl p-6">
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
                      className="avoid-break"
                      style={{
                        width: set.printSettings.paperSize === 'a4'
                          ? (set.printSettings.orientation === 'landscape' ? '297mm' : '210mm')
                          : (set.printSettings.orientation === 'landscape' ? '11in' : '8.5in'),
                        height: set.printSettings.paperSize === 'a4'
                          ? (set.printSettings.orientation === 'landscape' ? '210mm' : '297mm')
                          : (set.printSettings.orientation === 'landscape' ? '8.5in' : '11in'),
                        padding: `${layout.marginTop}px ${layout.marginRight}px ${layout.marginBottom}px ${layout.marginLeft}px`,
                        transform: `translate(${set.printSettings.horizontalOffset}px, ${set.printSettings.verticalOffset}px)`,
                        transformOrigin: 'top left',
                        pageBreakAfter: 'always',
                        breakAfter: 'page',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }}
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
                        className="avoid-break"
                        style={{
                          width: set.printSettings.paperSize === 'a4'
                            ? (set.printSettings.orientation === 'landscape' ? '297mm' : '210mm')
                            : (set.printSettings.orientation === 'landscape' ? '11in' : '8.5in'),
                          height: set.printSettings.paperSize === 'a4'
                            ? (set.printSettings.orientation === 'landscape' ? '210mm' : '297mm')
                            : (set.printSettings.orientation === 'landscape' ? '8.5in' : '11in'),
                          padding: `${layout.marginTop}px ${layout.marginRight}px ${layout.marginBottom}px ${layout.marginLeft}px`,
                          transform: `translate(${set.printSettings.horizontalOffset}px, ${set.printSettings.verticalOffset}px)`,
                          transformOrigin: 'top left',
                          pageBreakAfter: isLastPage ? 'auto' : 'always',
                          breakAfter: isLastPage ? 'auto' : 'page',
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                        }}
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
