import { useState, useEffect, useRef } from 'react'
import { Plus, Printer, DownloadSimple, Exam, Image as ImageIcon, Trash, ArrowLeft } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast, Toaster } from 'sonner'
import type { FlashCardSet, FlashCard } from '@/lib/types'
import { DEFAULT_PRINT_SETTINGS, DEFAULT_TEST_SETTINGS } from '@/lib/types'
import { loadSets, saveSet, deleteSet, generateUniqueId, compressImage } from '@/lib/storage'
import { FlashCardDisplay } from '@/components/FlashCardDisplay'
import { TestDisplay, AnswerKey } from '@/components/TestDisplay'
import { TestConfigDialog } from '@/components/TestConfigDialog'
import { generateTestQuestions } from '@/lib/test-utils'
import { calculatePrintLayout, paginateCards } from '@/lib/print-utils'

function App() {
  const [sets, setSets] = useState<FlashCardSet[]>([])
  const [currentSet, setCurrentSet] = useState<FlashCardSet | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newSetTitle, setNewSetTitle] = useState('')

  useEffect(() => {
    const loaded = loadSets()
    setSets(loaded)
    
    if (loaded.length === 0) {
      createDemoSet()
    }
  }, [])

  function createDemoSet() {
    const demoSet: FlashCardSet = {
      id: generateUniqueId(),
      title: 'Sample Vocabulary Set',
      subtitle: 'Common English Words',
      className: 'Grade 3',
      cards: [
        {
          id: '1',
          frontText: 'Apple',
          backText: 'A round fruit',
          imagePosition: 'front',
        },
        {
          id: '2',
          frontText: 'Book',
          backText: 'Pages bound together',
          imagePosition: 'front',
        },
        {
          id: '3',
          frontText: 'Cat',
          backText: 'A small furry pet',
          imagePosition: 'front',
        },
        {
          id: '4',
          frontText: 'Dog',
          backText: 'A loyal animal',
          imagePosition: 'front',
        },
      ],
      cardType: 'double-sided',
      printSettings: DEFAULT_PRINT_SETTINGS,
      testSettings: DEFAULT_TEST_SETTINGS,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    
    saveSet(demoSet)
    setSets([demoSet])
    toast.success('Demo set created!')
  }

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
    setSets([...sets, newSet])
    setCurrentSet(newSet)
    setNewSetTitle('')
    setCreateDialogOpen(false)
    toast.success('Set created!')
  }

  function handleDeleteSet(id: string) {
    deleteSet(id)
    setSets(sets.filter(s => s.id !== id))
    if (currentSet?.id === id) {
      setCurrentSet(null)
    }
    toast.success('Set deleted')
  }

  function handlePrint() {
    window.print()
  }

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

            {sets.length === 0 ? (
              <Card className="max-w-md mx-auto shadow-lg border-2">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Plus className="w-10 h-10 text-primary" weight="bold" />
                  </div>
                  <p className="text-xl font-semibold text-foreground mb-2">No flashcard sets yet</p>
                  <p className="text-muted-foreground mb-6">Create your first set to begin</p>
                  <Button onClick={() => setCreateDialogOpen(true)} size="lg" className="shadow-md">
                    <Plus className="mr-2" weight="bold" />
                    Create Your First Set
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sets.map((set) => (
                  <Card
                    key={set.id}
                    className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-primary/50"
                    onClick={() => setCurrentSet(set)}
                  >
                    <CardHeader>
                      <CardTitle className="text-xl">{set.title}</CardTitle>
                      {set.subtitle && (
                        <CardDescription className="text-base">{set.subtitle}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                        <span className="font-medium">{set.cards.length} cards</span>
                        {set.className && <span className="font-medium">{set.className}</span>}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSet(set.id)
                        }}
                      >
                        <Trash className="mr-2" weight="bold" />
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <SetEditor
            set={currentSet}
            onBack={() => setCurrentSet(null)}
            onUpdate={(updated) => {
              saveSet(updated)
              setSets(sets.map(s => s.id === updated.id ? updated : s))
              setCurrentSet(updated)
            }}
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
}

function SetEditor({ set, onBack, onUpdate }: SetEditorProps) {
  const [localSet, setLocalSet] = useState(set)
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [generatedTest, setGeneratedTest] = useState<ReturnType<typeof generateTestQuestions> | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    onUpdate(localSet)
  }, [localSet])

  function addCard() {
    const newCard: FlashCard = {
      id: `card-${Date.now()}`,
      frontText: '',
      backText: '',
      imagePosition: 'front',
    }
    setLocalSet({
      ...localSet,
      cards: [...localSet.cards, newCard],
    })
  }

  function updateCard(id: string, updates: Partial<FlashCard>) {
    setLocalSet({
      ...localSet,
      cards: localSet.cards.map(c => c.id === id ? { ...c, ...updates } : c),
    })
  }

  function deleteCard(id: string) {
    setLocalSet({
      ...localSet,
      cards: localSet.cards.filter(c => c.id !== id),
    })
  }

  async function handleImageUpload(cardId: string, file: File) {
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
        updateCard(cardId, { imageUrl: compressed })
        toast.success('Image uploaded!')
      } catch (error) {
        console.error('Image upload error:', error)
        toast.error('Failed to upload image')
      }
    }
    reader.readAsDataURL(file)
  }

  function removeImage(cardId: string) {
    updateCard(cardId, { imageUrl: undefined })
    toast.success('Image removed')
  }

  function handleGenerateTest() {
    if (localSet.cards.length === 0) {
      toast.error('Add some cards first!')
      return
    }
    const questions = generateTestQuestions(localSet.cards, localSet.testSettings)
    setGeneratedTest(questions)
    toast.success('Test generated!')
  }

  function handleTestSettingsChange(newSettings: typeof localSet.testSettings) {
    setLocalSet({
      ...localSet,
      testSettings: newSettings,
    })
  }

  const layout = calculatePrintLayout(
    localSet.printSettings.cardsPerPage,
    localSet.printSettings.paperSize,
    localSet.printSettings.orientation
  )
  const pages = paginateCards(localSet.cards, localSet.printSettings.cardsPerPage)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between no-print">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-3">
            <ArrowLeft className="mr-2" weight="bold" />
            Back to Sets
          </Button>
          <h2 className="text-3xl font-bold">{localSet.title}</h2>
          {localSet.subtitle && <p className="text-muted-foreground mt-1">{localSet.subtitle}</p>}
        </div>
        <Button onClick={addCard} size="lg" className="shadow-md">
          <Plus className="mr-2" weight="bold" />
          Add Card
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-6 no-print">
        <Button variant="outline" onClick={() => setShowTestDialog(true)} disabled={localSet.cards.length === 0} className="shadow-sm">
          <Exam className="mr-2" weight="bold" />
          Generate Test
        </Button>
      </div>

      <TestConfigDialog
        open={showTestDialog}
        onOpenChange={setShowTestDialog}
        settings={localSet.testSettings}
        onSettingsChange={handleTestSettingsChange}
        onGenerate={handleGenerateTest}
        maxQuestions={localSet.cards.length}
      />

      <Tabs defaultValue="editor" className="no-print">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          {generatedTest && <TabsTrigger value="test">Test</TabsTrigger>}
        </TabsList>

        <TabsContent value="editor" className="space-y-6 mt-6">
          {localSet.cards.length === 0 ? (
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
            localSet.cards.map((card, index) => (
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

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Card Image</Label>
                      {card.imageUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeImage(card.id)}
                        >
                          <Trash className="mr-2" size={16} weight="bold" />
                          Remove Image
                        </Button>
                      )}
                    </div>

                    {card.imageUrl ? (
                      <div className="relative group rounded-lg overflow-hidden border-2 border-border">
                        <img 
                          src={card.imageUrl} 
                          alt="Card" 
                          className="w-full h-64 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => fileInputRefs.current[card.id]?.click()}
                          >
                            <ImageIcon className="mr-2" weight="bold" />
                            Change Image
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeImage(card.id)}
                          >
                            <Trash className="mr-2" weight="bold" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRefs.current[card.id]?.click()}
                        className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" weight="duotone" />
                        <p className="text-base font-medium text-foreground mb-1">Click to upload image</p>
                        <p className="text-sm text-muted-foreground">PNG, JPG up to 5MB</p>
                      </div>
                    )}

                    <input
                      ref={(el) => {
                        fileInputRefs.current[card.id] = el
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          handleImageUpload(card.id, file)
                        }
                      }}
                    />

                    {card.imageUrl && (
                      <div className="space-y-2">
                        <Label className="text-base font-semibold">Image Position</Label>
                        <Select
                          value={card.imagePosition || 'front'}
                          onValueChange={(value: 'front' | 'back' | 'both') =>
                            updateCard(card.id, { imagePosition: value })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="front">Front Only</SelectItem>
                            <SelectItem value="back">Back Only</SelectItem>
                            <SelectItem value="both">Both Sides</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Print Preview</CardTitle>
              <CardDescription className="text-base">
                {pages.length} page{pages.length !== 1 ? 's' : ''} · {localSet.cards.length} card{localSet.cards.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-12">
                {pages.map((pageCards, pageIndex) => (
                  <div key={pageIndex} className="border-2 rounded-xl p-8 bg-white shadow-md">
                    <p className="text-base font-semibold mb-6 text-muted-foreground">Page {pageIndex + 1}</p>
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                      }}
                    >
                      {pageCards.map((card, cardIndex) => (
                        <FlashCardDisplay
                          key={card.id}
                          card={card}
                          settings={localSet.printSettings}
                          cardWidth={layout.cardWidth / 2}
                          cardHeight={layout.cardHeight / 2}
                          cardNumber={pageIndex * localSet.printSettings.cardsPerPage + cardIndex + 1}
                          showSetTitle={localSet.title}
                        />
                      ))}
                    </div>
                  </div>
                ))}
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
                  {localSet.testSettings.includeAnswerKey && ' · Includes answer key'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="border-2 rounded-xl overflow-hidden shadow-md">
                    <TestDisplay
                      questions={generatedTest}
                      settings={localSet.testSettings}
                      showAnswers={false}
                    />
                  </div>
                  
                  {localSet.testSettings.includeAnswerKey && (
                    <div className="border-2 rounded-xl overflow-hidden shadow-md">
                      <AnswerKey
                        questions={generatedTest}
                        settings={localSet.testSettings}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <div className="print-only">
        {generatedTest ? (
          <>
            <div className="page-break-after">
              <TestDisplay
                questions={generatedTest}
                settings={localSet.testSettings}
                showAnswers={false}
              />
            </div>
            
            {localSet.testSettings.includeAnswerKey && (
              <div>
                <AnswerKey
                  questions={generatedTest}
                  settings={localSet.testSettings}
                />
              </div>
            )}
          </>
        ) : (
          <>
            {pages.map((pageCards, pageIndex) => (
              <div
                key={pageIndex}
                className="page-break-after"
                style={{
                  width: `${layout.pageWidth}px`,
                  height: `${layout.pageHeight}px`,
                  padding: `${layout.marginTop}px ${layout.marginRight}px ${layout.marginBottom}px ${layout.marginLeft}px`,
                  pageBreakAfter: 'always',
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
                      key={card.id}
                      card={card}
                      settings={localSet.printSettings}
                      cardWidth={layout.cardWidth}
                      cardHeight={layout.cardHeight}
                      cardNumber={pageIndex * localSet.printSettings.cardsPerPage + cardIndex + 1}
                      showSetTitle={localSet.title}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export default App