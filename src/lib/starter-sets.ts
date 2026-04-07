import type { FlashCard, FlashCardSet } from './types'
import { DEFAULT_PRINT_SETTINGS, DEFAULT_TEST_SETTINGS } from './types'
import { generateUniqueId } from './storage'

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    svg.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim(),
  )}`
}

function sceneSvg({
  bg = '#FFF7ED',
  accent = '#F59E0B',
  accent2 = '#10B981',
  title = '',
  scene = '',
}: {
  bg?: string
  accent?: string
  accent2?: string
  title: string
  scene: string
}): string {
  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
      <rect width="800" height="600" rx="44" fill="${bg}"/>
      <circle cx="118" cy="100" r="46" fill="${accent}" opacity="0.22"/>
      <circle cx="688" cy="110" r="58" fill="${accent2}" opacity="0.18"/>
      <rect x="34" y="34" width="732" height="532" rx="34" fill="white" opacity="0.88"/>
      ${scene}
      <rect x="120" y="480" width="560" height="56" rx="18" fill="${accent}" opacity="0.15"/>
      <text x="400" y="517" text-anchor="middle" font-family="Verdana, sans-serif" font-weight="700" font-size="30" fill="#1F2937">${title}</text>
    </svg>
  `)
}

function childScene({
  shirt = '#60A5FA',
  skin = '#F2C7A5',
  wave = false,
  jump = false,
  heart = false,
  tag = false,
  map = false,
  friend = false,
  candles = false,
  handshake = false,
  bubble = false,
}: {
  shirt?: string
  skin?: string
  wave?: boolean
  jump?: boolean
  heart?: boolean
  tag?: boolean
  map?: boolean
  friend?: boolean
  candles?: boolean
  handshake?: boolean
  bubble?: boolean
}): string {
  const extras: string[] = []
  if (wave) extras.push(`<path d="M480 220 Q560 180 610 235" stroke="#1F2937" stroke-width="14" fill="none" stroke-linecap="round"/>`)
  if (jump) extras.push(`<path d="M315 430 Q400 360 485 430" stroke="#F97316" stroke-width="10" fill="none" stroke-dasharray="16 10"/>`)
  if (heart) extras.push(`<path d="M560 245 C560 215 600 210 600 242 C600 210 640 215 640 245 C640 286 600 312 600 312 C600 312 560 286 560 245Z" fill="#EF4444"/>`)
  if (tag) extras.push(`<rect x="560" y="255" width="110" height="76" rx="14" fill="#DBEAFE" stroke="#1F2937" stroke-width="8"/><line x1="582" y1="292" x2="648" y2="292" stroke="#1F2937" stroke-width="8" stroke-linecap="round"/>`)
  if (map) extras.push(`<rect x="520" y="215" width="130" height="110" rx="16" fill="#D1FAE5" stroke="#1F2937" stroke-width="8"/><path d="M545 245 L575 228 L600 252 L628 232" stroke="#059669" stroke-width="8" fill="none"/><circle cx="606" cy="275" r="12" fill="#DC2626"/>`)
  if (friend) extras.push(`<circle cx="570" cy="250" r="38" fill="${skin}" stroke="#1F2937" stroke-width="8"/><path d="M530 360 Q570 300 610 360 V420 H530Z" fill="#FCA5A5" stroke="#1F2937" stroke-width="8"/>`)
  if (candles) extras.push(`<rect x="545" y="355" width="120" height="40" rx="8" fill="#F59E0B" stroke="#1F2937" stroke-width="8"/><line x1="575" y1="355" x2="575" y2="320" stroke="#1F2937" stroke-width="8"/><line x1="605" y1="355" x2="605" y2="320" stroke="#1F2937" stroke-width="8"/><line x1="635" y1="355" x2="635" y2="320" stroke="#1F2937" stroke-width="8"/><circle cx="575" cy="308" r="8" fill="#F97316"/><circle cx="605" cy="308" r="8" fill="#F97316"/><circle cx="635" cy="308" r="8" fill="#F97316"/>`)
  if (handshake) extras.push(`<path d="M470 345 Q520 325 565 352" stroke="#1F2937" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M565 352 Q610 326 660 348" stroke="#1F2937" stroke-width="14" fill="none" stroke-linecap="round"/>`)
  if (bubble) extras.push(`<rect x="520" y="170" width="120" height="70" rx="18" fill="#E0F2FE" stroke="#1F2937" stroke-width="8"/><path d="M560 240 L545 262 L582 246" fill="#E0F2FE" stroke="#1F2937" stroke-width="8"/>`)

  return `
    <circle cx="280" cy="220" r="64" fill="${skin}" stroke="#1F2937" stroke-width="8"/>
    <path d="M210 360 Q280 285 350 360 V446 H210Z" fill="${shirt}" stroke="#1F2937" stroke-width="8"/>
    <circle cx="255" cy="210" r="8" fill="#1F2937"/>
    <circle cx="305" cy="210" r="8" fill="#1F2937"/>
    <path d="M252 244 Q280 262 308 244" stroke="#1F2937" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M210 165 Q280 120 350 165" stroke="#1F2937" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M220 335 Q180 270 212 230" stroke="#1F2937" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M340 335 Q395 250 468 246" stroke="#1F2937" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M250 446 L232 520" stroke="#1F2937" stroke-width="14" stroke-linecap="round"/>
    <path d="M312 446 L330 520" stroke="#1F2937" stroke-width="14" stroke-linecap="round"/>
    ${extras.join('')}
  `
}

function wordScene(word: string): string {
  const colors: Record<string, [string, string, string]> = {
    hello: ['#FEF3C7', '#F59E0B', '#60A5FA'],
    my: ['#FCE7F3', '#EC4899', '#F59E0B'],
    name: ['#DBEAFE', '#2563EB', '#F59E0B'],
    is: ['#E0F2FE', '#0891B2', '#22C55E'],
    i: ['#FAE8FF', '#9333EA', '#F97316'],
    am: ['#ECFCCB', '#65A30D', '#2563EB'],
    from: ['#DCFCE7', '#16A34A', '#2563EB'],
    years: ['#FEF2F2', '#DC2626', '#F59E0B'],
    old: ['#F3F4F6', '#4B5563', '#A855F7'],
    like: ['#FFF1F2', '#E11D48', '#10B981'],
    can: ['#EFF6FF', '#1D4ED8', '#F97316'],
    friend: ['#FEF3C7', '#D97706', '#EC4899'],
    nice: ['#F0FDF4', '#16A34A', '#0EA5E9'],
    meet: ['#FDF4FF', '#C026D3', '#F59E0B'],
    you: ['#EEF2FF', '#4F46E5', '#EF4444'],
    goodbye: ['#FFF7ED', '#EA580C', '#2563EB'],
  }
  const [bg, accent, accent2] = colors[word] || ['#F8FAFC', '#334155', '#22C55E']
  return sceneSvg({
    bg,
    accent,
    accent2,
    title: `Power Word: ${word.toUpperCase()}`,
    scene: `
      <rect x="110" y="138" width="580" height="248" rx="32" fill="${accent}" opacity="0.12"/>
      <text x="400" y="285" text-anchor="middle" font-family="Verdana, sans-serif" font-weight="900" font-size="112" fill="${accent}">${word.toUpperCase()}</text>
      <circle cx="170" cy="420" r="28" fill="${accent2}" opacity="0.28"/>
      <circle cx="630" cy="420" r="28" fill="${accent2}" opacity="0.28"/>
    `,
  })
}

interface StarterTemplate {
  id: string
  title: string
  subtitle: string
  description: string
  audience: string
  tags: string[]
  createSet: () => FlashCardSet
}

function createCard(card: Omit<FlashCard, 'id'>, slug: string): FlashCard {
  return { id: `card-${slug}-${Math.random().toString(36).slice(2, 8)}`, ...card }
}

function buildPowerIntroductionCards(): FlashCard[] {
  return [
    createCard({
      frontText: 'Hello!',
      backText: 'Hello! My name is ___.',
      frontSecondary: 'Look. Wave. Say hello.',
      backSecondary: 'Read in chunks: Hello! | My name | is ___.',
      frontImageUrl: sceneSvg({ title: 'Say hello', scene: childScene({ wave: true, bubble: true }) }),
      tags: ['sentence', 'greeting'],
      category: 'Greeting',
    }, 'hello'),
    createCard({
      frontText: 'My name',
      backText: 'My name is ___.',
      frontSecondary: 'Point to yourself, then your name tag.',
      backSecondary: 'Power words: my | name | is',
      frontImageUrl: sceneSvg({ title: 'Name tag', scene: childScene({ tag: true }) }),
      tags: ['sentence', 'name'],
      category: 'Name',
    }, 'my-name'),
    createCard({
      frontText: 'What is your name?',
      backText: 'My name is ___.',
      frontSecondary: 'Ask a friend.',
      backSecondary: 'Question then answer. Take turns.',
      frontImageUrl: sceneSvg({ title: 'Ask a question', scene: childScene({ friend: true, bubble: true }) }),
      tags: ['sentence', 'question'],
      category: 'Question',
    }, 'ask-name'),
    createCard({
      frontText: 'I am ___ years old.',
      backText: 'I am ___ years old.',
      frontSecondary: 'Count on fingers.',
      backSecondary: 'Power words: I | am | years | old',
      frontImageUrl: sceneSvg({ title: 'Age card', scene: childScene({ candles: true }) }),
      tags: ['sentence', 'age'],
      category: 'Age',
    }, 'age'),
    createCard({
      frontText: 'I am from Japan.',
      backText: 'I am from Japan.',
      frontSecondary: 'Point to Japan on a map.',
      backSecondary: 'Power words: I | am | from | Japan',
      frontImageUrl: sceneSvg({ title: 'From Japan', scene: childScene({ map: true }) }),
      tags: ['sentence', 'country'],
      category: 'Country',
    }, 'from'),
    createCard({
      frontText: 'I like ___.',
      backText: 'I like soccer.',
      frontSecondary: 'Say one thing you like.',
      backSecondary: 'Swap the last word: soccer, cats, sushi, blue',
      frontImageUrl: sceneSvg({ title: 'I like', scene: childScene({ heart: true }) }),
      tags: ['sentence', 'likes'],
      category: 'Likes',
    }, 'like'),
    createCard({
      frontText: 'I can ___.',
      backText: 'I can jump.',
      frontSecondary: 'Do the action.',
      backSecondary: 'Swap the last word: jump, run, draw, swim',
      frontImageUrl: sceneSvg({ title: 'I can', scene: childScene({ jump: true }) }),
      tags: ['sentence', 'ability'],
      category: 'Ability',
    }, 'can'),
    createCard({
      frontText: 'This is my friend ___.',
      backText: 'This is my friend ___.',
      frontSecondary: 'Point to your partner.',
      backSecondary: 'Power words: this | my | friend',
      frontImageUrl: sceneSvg({ title: 'My friend', scene: childScene({ friend: true }) }),
      tags: ['sentence', 'friend'],
      category: 'Friend',
    }, 'friend'),
    createCard({
      frontText: 'Nice to meet you.',
      backText: 'Nice to meet you.',
      frontSecondary: 'Smile. Bow. Shake hands.',
      backSecondary: 'Power words: nice | meet | you',
      frontImageUrl: sceneSvg({ title: 'Nice to meet you', scene: childScene({ handshake: true, friend: true }) }),
      tags: ['sentence', 'polite'],
      category: 'Polite',
    }, 'nice'),
    createCard({
      frontText: 'How are you?',
      backText: 'I am fine!',
      frontSecondary: 'Ask first. Answer next.',
      backSecondary: 'Mini talk: How are you? | I am fine!',
      frontImageUrl: sceneSvg({ title: 'How are you?', scene: childScene({ bubble: true, friend: true }) }),
      tags: ['sentence', 'question'],
      category: 'Question',
    }, 'how-are-you'),
    createCard({
      frontText: 'See you!',
      backText: 'See you tomorrow!',
      frontSecondary: 'Wave when class ends.',
      backSecondary: 'Power words: see | you',
      frontImageUrl: sceneSvg({ title: 'See you', scene: childScene({ wave: true }) }),
      tags: ['sentence', 'goodbye'],
      category: 'Goodbye',
    }, 'see-you'),
    createCard({
      frontText: 'Goodbye!',
      backText: 'Goodbye! See you!',
      frontSecondary: 'Big wave.',
      backSecondary: 'Read in chunks: Good | bye',
      frontImageUrl: sceneSvg({ title: 'Goodbye', scene: childScene({ wave: true, bubble: true }) }),
      tags: ['sentence', 'goodbye'],
      category: 'Goodbye',
    }, 'goodbye'),
  ]
}

function buildPowerWordCards(): FlashCard[] {
  return [
    ['hello', 'Hello!'],
    ['my', 'My name is Ken.'],
    ['name', 'My name is Ken.'],
    ['is', 'My name is Ken.'],
    ['i', 'I am nine.'],
    ['am', 'I am nine.'],
    ['from', 'I am from Japan.'],
    ['years', 'I am nine years old.'],
    ['old', 'I am nine years old.'],
    ['like', 'I like soccer.'],
    ['can', 'I can jump.'],
    ['friend', 'This is my friend Aoi.'],
    ['nice', 'Nice to meet you.'],
    ['meet', 'Nice to meet you.'],
    ['you', 'Nice to meet you.'],
    ['goodbye', 'Goodbye!'],
  ].map(([word, sentence]) =>
    createCard({
      frontText: word,
      backText: sentence,
      frontSecondary: `${word[0].toUpperCase()} ${word[0]}  |  read the word fast`,
      backSecondary: `Find "${word}" inside the sentence.`,
      frontImageUrl: wordScene(word),
      tags: ['power-word', word],
      category: 'Power Words',
    }, word),
  )
}

function buildDialogueCards(): FlashCard[] {
  const cards = [
    ['greet', 'Greet a friend', 'A: Hello!  B: Hello!', 'Wave and smile.', 'Two turns. Keep it short.', sceneSvg({ title: 'Greeting talk', scene: childScene({ friend: true, wave: true, bubble: true }) })],
    ['name', 'Ask a name', 'A: What is your name?  B: My name is ___.', 'Ask, then answer.', 'Use a partner.', sceneSvg({ title: 'Name talk', scene: childScene({ friend: true, tag: true, bubble: true }) })],
    ['age', 'Ask an age', 'A: How old are you?  B: I am ___ years old.', 'Count on fingers.', 'Say the number loudly and clearly.', sceneSvg({ title: 'Age talk', scene: childScene({ friend: true, candles: true, bubble: true }) })],
    ['from', 'Ask a country', 'A: Where are you from?  B: I am from Japan.', 'Point to a map.', 'Swap Japan for another country if needed.', sceneSvg({ title: 'Country talk', scene: childScene({ friend: true, map: true, bubble: true }) })],
    ['like', 'Ask a favorite', 'A: What do you like?  B: I like ___.', 'Choose one easy favorite.', 'Use picture choices in class.', sceneSvg({ title: 'Like talk', scene: childScene({ friend: true, heart: true, bubble: true }) })],
    ['can', 'Ask an ability', 'A: What can you do?  B: I can ___.', 'Act it out.', 'Use jump, run, swim, draw.', sceneSvg({ title: 'Can talk', scene: childScene({ friend: true, jump: true, bubble: true }) })],
    ['friend', 'Introduce a friend', 'This is my friend ___.  Nice to meet you.', 'Point to your partner.', 'Three students can use this together.', sceneSvg({ title: 'Friend talk', scene: childScene({ friend: true, handshake: true }) })],
    ['bye', 'Finish the talk', 'A: Goodbye!  B: See you!', 'Big wave.', 'Use this at the end of every practice round.', sceneSvg({ title: 'Finish the talk', scene: childScene({ friend: true, wave: true, bubble: true }) })],
  ] as const

  return cards.map(([slug, frontText, backText, frontSecondary, backSecondary, frontImageUrl]) =>
    createCard({
      frontText,
      backText,
      frontSecondary,
      backSecondary,
      frontImageUrl,
      tags: ['dialogue', slug],
      category: 'Partner Talk',
    }, slug),
  )
}

function createSet(template: Omit<FlashCardSet, 'id' | 'createdAt' | 'updatedAt'>): FlashCardSet {
  const now = Date.now()
  return {
    ...template,
    id: generateUniqueId(),
    createdAt: now,
    updatedAt: now,
  }
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'esl-power-introductions',
    title: 'Power Introductions: Speak Fast',
    subtitle: 'Picture-supported introduction practice',
    description: 'Best for young ESL learners. Each front gives a visual cue. Each back upgrades the cue into a readable sentence.',
    audience: 'Elementary ESL',
    tags: ['ESL', 'Introductions', 'Speaking', 'Pictures'],
    createSet: () =>
      createSet({
        title: 'Power Introductions: Speak Fast',
        subtitle: 'Picture cues + full sentence backs',
        className: 'Elementary ESL',
        notes: 'Use this set first. Front side builds fast speaking with visual support. Back side upgrades the cue into a full readable sentence.',
        cards: buildPowerIntroductionCards(),
        cardType: 'double-sided',
        printSettings: {
          ...DEFAULT_PRINT_SETTINGS,
          cardsPerPage: 4,
          paperSize: 'a4',
          orientation: 'landscape',
          cardSize: 'large',
          doubleSidedStyle: 'picture-word',
          theme: 'playful-pop',
          showNumbering: true,
          showSetTitle: true,
          fontSize: 24,
          mainColor: '#1F2937',
          accentColor: '#D97706',
          borderThickness: 2,
          cornerRadius: 16,
          imageHeightRatio: 0.5,
          footerText: 'Speak fast',
        },
        testSettings: {
          ...DEFAULT_TEST_SETTINGS,
          testTitle: 'Speaking Check',
          instructions: 'Say the full sentence for each card.',
          questionTypes: ['short-answer'],
          numberOfQuestions: 8,
          includeImages: true,
          teacherNotes: 'Assess oral production, not spelling.',
        },
      }),
  },
  {
    id: 'esl-power-words',
    title: 'Power Words: Read Fast',
    subtitle: 'Sight words that unlock introductions',
    description: 'Single-word fronts and sentence backs help learners see the exact words they need for speaking and reading.',
    audience: 'Elementary ESL',
    tags: ['ESL', 'Reading', 'Sight Words', 'Fluency'],
    createSet: () =>
      createSet({
        title: 'Power Words: Read Fast',
        subtitle: 'Sight words for introductions',
        className: 'Elementary ESL',
        notes: 'Use this set second. Students read a single high-frequency word on the front, then find that same word in a full sentence on the back.',
        cards: buildPowerWordCards(),
        cardType: 'double-sided',
        printSettings: {
          ...DEFAULT_PRINT_SETTINGS,
          cardsPerPage: 6,
          paperSize: 'a4',
          orientation: 'landscape',
          cardSize: 'medium',
          doubleSidedStyle: 'picture-word',
          theme: 'teacher-pro',
          showNumbering: true,
          showSetTitle: true,
          fontSize: 20,
          mainColor: '#0F172A',
          accentColor: '#2563EB',
          borderThickness: 2,
          cornerRadius: 14,
          imageHeightRatio: 0.46,
          footerText: 'Read fast',
        },
        testSettings: {
          ...DEFAULT_TEST_SETTINGS,
          testTitle: 'Word Reading Check',
          instructions: 'Read the word and circle it in the sentence.',
          questionTypes: ['fill-blank', 'word-to-translation'],
          numberOfQuestions: 10,
          includeWordBank: true,
          includeImages: true,
          teacherNotes: 'Use as reading support, not translation-heavy practice.',
        },
      }),
  },
  {
    id: 'esl-partner-talk',
    title: 'Partner Talk: Mini Dialogues',
    subtitle: 'Short conversations for pair work',
    description: 'Transforms isolated phrases into fast classroom conversations with predictable turns and picture support.',
    audience: 'Elementary ESL',
    tags: ['ESL', 'Dialogue', 'Partner Work', 'Speaking'],
    createSet: () =>
      createSet({
        title: 'Partner Talk: Introduction Mini Dialogues',
        subtitle: 'Short classroom conversations',
        className: 'Elementary ESL',
        notes: 'Use this set third. Students act out very short dialogues with a partner. These cards turn isolated vocabulary into usable conversation routines.',
        cards: buildDialogueCards(),
        cardType: 'double-sided',
        printSettings: {
          ...DEFAULT_PRINT_SETTINGS,
          cardsPerPage: 4,
          paperSize: 'a4',
          orientation: 'landscape',
          cardSize: 'large',
          doubleSidedStyle: 'question-answer',
          theme: 'calm-study',
          showNumbering: true,
          showSetTitle: true,
          fontSize: 22,
          mainColor: '#134E4A',
          accentColor: '#0F766E',
          borderThickness: 2,
          cornerRadius: 16,
          imageHeightRatio: 0.52,
          footerText: 'Partner talk',
        },
        testSettings: {
          ...DEFAULT_TEST_SETTINGS,
          testTitle: 'Dialogue Check',
          instructions: 'Read and perform the mini dialogue.',
          questionTypes: ['short-answer'],
          numberOfQuestions: 6,
          includeImages: true,
          teacherNotes: 'Pair assessment works best.',
        },
      }),
  },
]

export function createStarterSet(templateId: string): FlashCardSet | null {
  const template = STARTER_TEMPLATES.find((item) => item.id === templateId)
  return template ? template.createSet() : null
}
