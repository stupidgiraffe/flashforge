import { useState, useEffect } from 'react'
import { Plus, Printer, DownloadSimple, Exam } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast, Toaster } from 'sonner'
import type { FlashCardSet, FlashCard } from '@/lib/types'
import { DEFAULT_PRINT_SETTINGS, DEFAULT_TEST_SETTINGS } from '@/lib/types'
import { loadSets, saveSet, deleteSet, generateUniqueId } from '@/lib/storage'
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
    <div className="min-h-screen bg-background">
      <Toaster position="bottom-right" />
      
      <header className="border-b bg-card no-print">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">FlashForge</h1>
            <p className="text-sm text-muted-foreground">Create beautiful printable flashcards & tests</p>
          </div>
          
          <div className="flex gap-2">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2" />
                  New Set
                </Button>
              </DialogTrigger>
              <DialogContent>
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
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2" />
                Print
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {!currentSet ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Your Flashcard Sets</h2>
              <p className="text-muted-foreground">Select a set to edit or create a new one</p>
            </div>

            {sets.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <p className="text-lg text-muted-foreground mb-4">No flashcard sets yet</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2" />
                    Create Your First Set
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sets.map((set) => (
                  <Card
                    key={set.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setCurrentSet(set)}
                  >
                    <CardHeader>
                      <CardTitle>{set.title}</CardTitle>
                      {set.subtitle && (
                        <CardDescription>{set.subtitle}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{set.cards.length} cards</span>
                        {set.className && <span>{set.className}</span>}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="mt-4"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSet(set.id)
                        }}
                      >
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
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-2">
            ← Back to Sets
          </Button>
          <h2 className="text-2xl font-bold">{localSet.title}</h2>
        </div>
        <Button onClick={addCard}>
          <Plus className="mr-2" />
          Add Card
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4 no-print">
        <Button variant="outline" onClick={() => setShowTestDialog(true)} disabled={localSet.cards.length === 0}>
          <Exam className="mr-2" />
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
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          {generatedTest && <TabsTrigger value="test">Test</TabsTrigger>}
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          {localSet.cards.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No cards yet</p>
                <Button onClick={addCard}>
                  <Plus className="mr-2" />
                  Add Your First Card
                </Button>
              </CardContent>
            </Card>
          ) : (
            localSet.cards.map((card, index) => (
              <Card key={card.id}>
                <CardHeader>
                  <CardTitle className="text-lg">Card {index + 1}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Front Text</Label>
                      <Input
                        value={card.frontText}
                        onChange={(e) => updateCard(card.id, { frontText: e.target.value })}
                        placeholder="Front of card"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Back Text</Label>
                      <Input
                        value={card.backText}
                        onChange={(e) => updateCard(card.id, { backText: e.target.value })}
                        placeholder="Back of card"
                      />
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteCard(card.id)}
                  >
                    Delete Card
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Print Preview</CardTitle>
              <CardDescription>
                {pages.length} page{pages.length !== 1 ? 's' : ''} · {localSet.cards.length} card{localSet.cards.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {pages.map((pageCards, pageIndex) => (
                  <div key={pageIndex} className="border rounded-lg p-4">
                    <p className="text-sm font-medium mb-4">Page {pageIndex + 1}</p>
                    <div
                      className="grid gap-3"
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
          <TabsContent value="test">
            <Card>
              <CardHeader>
                <CardTitle>Test Preview</CardTitle>
                <CardDescription>
                  {generatedTest.length} question{generatedTest.length !== 1 ? 's' : ''}
                  {localSet.testSettings.includeAnswerKey && ' · Includes answer key'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="border rounded-lg overflow-hidden">
                    <TestDisplay
                      questions={generatedTest}
                      settings={localSet.testSettings}
                      showAnswers={false}
                    />
                  </div>
                  
                  {localSet.testSettings.includeAnswerKey && (
                    <div className="border rounded-lg overflow-hidden">
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