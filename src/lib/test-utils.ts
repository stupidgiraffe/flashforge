import type { FlashCard, TestSettings, QuestionType } from './types'

export interface TestQuestion {
  id: string
  type: QuestionType
  questionText: string
  questionImage?: string
  correctAnswer: string
  options?: string[]
  wordBankWord?: string
}

export function generateTestQuestions(
  cards: FlashCard[],
  settings: TestSettings
): TestQuestion[] {
  let selectedCards = [...cards]
  
  if (settings.randomizeOrder) {
    selectedCards = shuffleArray(selectedCards)
  }
  
  const numQuestions = Math.min(settings.numberOfQuestions, selectedCards.length)
  selectedCards = selectedCards.slice(0, numQuestions)
  
  const questions: TestQuestion[] = []
  
  for (let i = 0; i < selectedCards.length; i++) {
    const card = selectedCards[i]
    const questionType = settings.questionTypes[i % settings.questionTypes.length]
    
    const question = createQuestion(card, questionType, settings, selectedCards, i)
    if (question) {
      questions.push(question)
    }
  }
  
  return questions
}

function createQuestion(
  card: FlashCard,
  type: QuestionType,
  settings: TestSettings,
  allCards: FlashCard[],
  index: number
): TestQuestion | null {
  const baseId = `q-${index + 1}`
  
  switch (type) {
    case 'picture-to-word':
      return {
        id: baseId,
        type,
        questionText: 'What is this?',
        questionImage: settings.includeImages ? card.imageUrl : undefined,
        correctAnswer: card.frontText,
      }
      
    case 'word-to-picture':
      return {
        id: baseId,
        type,
        questionText: card.frontText,
        correctAnswer: card.imageUrl ? 'See image options' : card.backText,
        options: settings.includeImages ? generateImageOptions(card, allCards) : undefined,
      }
      
    case 'word-to-translation':
      return {
        id: baseId,
        type,
        questionText: card.frontText,
        correctAnswer: card.backText,
        wordBankWord: settings.includeWordBank ? card.backText : undefined,
      }
      
    case 'translation-to-word':
      return {
        id: baseId,
        type,
        questionText: card.backText,
        correctAnswer: card.frontText,
        wordBankWord: settings.includeWordBank ? card.frontText : undefined,
      }
      
    case 'multiple-choice':
      return {
        id: baseId,
        type,
        questionText: card.frontText,
        correctAnswer: card.backText,
        options: generateMultipleChoiceOptions(card, allCards),
      }
      
    case 'fill-blank':
      return {
        id: baseId,
        type,
        questionText: `${card.frontText}: _____________`,
        correctAnswer: card.backText,
        wordBankWord: settings.includeWordBank ? card.backText : undefined,
      }
      
    case 'short-answer':
      return {
        id: baseId,
        type,
        questionText: card.frontText,
        correctAnswer: card.backText,
      }
      
    case 'matching':
      return {
        id: baseId,
        type,
        questionText: card.frontText,
        correctAnswer: card.backText,
      }
      
    default:
      return null
  }
}

function generateMultipleChoiceOptions(card: FlashCard, allCards: FlashCard[]): string[] {
  const options = [card.backText]
  const otherCards = allCards.filter(c => c.id !== card.id && c.backText !== card.backText)
  
  const shuffled = shuffleArray(otherCards)
  for (let i = 0; i < 3 && i < shuffled.length; i++) {
    if (shuffled[i].backText) {
      options.push(shuffled[i].backText)
    }
  }
  
  return shuffleArray(options)
}

function generateImageOptions(card: FlashCard, allCards: FlashCard[]): string[] {
  const options = card.imageUrl ? [card.imageUrl] : []
  const otherCards = allCards.filter(c => c.id !== card.id && c.imageUrl)
  
  const shuffled = shuffleArray(otherCards)
  for (let i = 0; i < 3 && i < shuffled.length; i++) {
    if (shuffled[i].imageUrl) {
      options.push(shuffled[i].imageUrl!)
    }
  }
  
  return shuffleArray(options)
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function extractWordBank(questions: TestQuestion[]): string[] {
  const words = questions
    .filter(q => q.wordBankWord)
    .map(q => q.wordBankWord!)
  
  return shuffleArray([...new Set(words)])
}

export function formatMatchingQuestions(questions: TestQuestion[]): {
  left: { id: string; text: string }[]
  right: { id: string; text: string }[]
} {
  const matchingQuestions = questions.filter(q => q.type === 'matching')
  
  const left = matchingQuestions.map((q, i) => ({
    id: `${i + 1}`,
    text: q.questionText,
  }))
  
  const right = shuffleArray(
    matchingQuestions.map((q, i) => ({
      id: String.fromCharCode(65 + i),
      text: q.correctAnswer,
    }))
  )
  
  return { left, right }
}
