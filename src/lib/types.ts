export interface FlashCard {
  id: string
  frontText: string
  backText: string
  frontSecondary?: string
  backSecondary?: string
  frontImageUrl?: string
  backImageUrl?: string
  imageUrl?: string
  imagePosition?: 'front' | 'back' | 'both'
  tags?: string[]
  category?: string
}

export interface FlashCardSet {
  id: string
  title: string
  subtitle?: string
  className?: string
  notes?: string
  cards: FlashCard[]
  cardType: CardType
  printSettings: PrintSettings
  testSettings: TestSettings
  createdAt: number
  updatedAt: number
}

export type CardType = 'single-sided' | 'double-sided'

export type SingleSidedStyle = 
  | 'image-only'
  | 'image-word'
  | 'word-subtitle'
  | 'text-only'
  | 'character-card'

export type DoubleSidedStyle = 
  | 'picture-word'
  | 'word-meaning'
  | 'text-text'
  | 'question-answer'

export type CardsPerPage = 1 | 2 | 4 | 6 | 8 | 9 | 10 | 12

export type PaperSize = 'a4' | 'letter'

export type Orientation = 'portrait' | 'landscape'

export type DuplexMode = 'manual' | 'long-edge' | 'short-edge'

export type CardSize = 'extra-large' | 'large' | 'medium' | 'small'

export type ImageFit = 'cover' | 'contain' | 'center'

export type CaptionPlacement = 'top' | 'bottom' | 'overlay' | 'none'

export type CardTheme = 
  | 'minimal'
  | 'classroom-cute'
  | 'bold-vocabulary'
  | 'picture-focus'
  | 'ink-saver'
  | 'quiz-card'

export interface PrintSettings {
  cardsPerPage: CardsPerPage
  paperSize: PaperSize
  orientation: Orientation
  cardSize: CardSize
  singleSidedStyle?: SingleSidedStyle
  doubleSidedStyle?: DoubleSidedStyle
  duplexMode?: DuplexMode
  theme: CardTheme
  
  showCropMarks: boolean
  showCutLines: boolean
  showBorder: boolean
  showRoundedCorners: boolean
  showNumbering: boolean
  showSetTitle: boolean
  
  colorMode: 'color' | 'ink-saver'
  imageFit: ImageFit
  captionPlacement: CaptionPlacement
  
  fontFamily: string
  fontSize: number
  mainColor: string
  accentColor: string
  borderThickness: number
  cornerRadius: number
  textAlignment: 'left' | 'center' | 'right'
  
  horizontalOffset: number
  verticalOffset: number
  
  footerText?: string
}

export type QuestionType = 
  | 'picture-to-word'
  | 'word-to-picture'
  | 'word-to-translation'
  | 'translation-to-word'
  | 'matching'
  | 'fill-blank'
  | 'short-answer'
  | 'multiple-choice'

export interface TestSettings {
  testTitle: string
  includeStudentInfo: boolean
  includeDate: boolean
  instructions?: string
  questionTypes: QuestionType[]
  numberOfQuestions: number
  randomizeOrder: boolean
  includeWordBank: boolean
  includeAnswerKey: boolean
  includeImages: boolean
  teacherNotes?: string
}

export interface PrintLayout {
  cardsPerPage: CardsPerPage
  cardWidth: number
  cardHeight: number
  rows: number
  cols: number
  pageWidth: number
  pageHeight: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  gapX: number
  gapY: number
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  cardsPerPage: 4,
  paperSize: 'letter',
  orientation: 'portrait',
  cardSize: 'medium',
  singleSidedStyle: 'image-word',
  doubleSidedStyle: 'picture-word',
  duplexMode: 'long-edge',
  theme: 'minimal',
  showCropMarks: false,
  showCutLines: true,
  showBorder: true,
  showRoundedCorners: true,
  showNumbering: false,
  showSetTitle: false,
  colorMode: 'color',
  imageFit: 'contain',
  captionPlacement: 'bottom',
  fontFamily: 'Inter',
  fontSize: 16,
  mainColor: '#1e293b',
  accentColor: '#0ea5e9',
  borderThickness: 1,
  cornerRadius: 8,
  textAlignment: 'center',
  horizontalOffset: 0,
  verticalOffset: 0,
}

export const DEFAULT_TEST_SETTINGS: TestSettings = {
  testTitle: 'Vocabulary Test',
  includeStudentInfo: true,
  includeDate: true,
  instructions: 'Write the correct answer for each question.',
  questionTypes: ['word-to-translation'],
  numberOfQuestions: 10,
  randomizeOrder: false,
  includeWordBank: false,
  includeAnswerKey: true,
  includeImages: false,
}
