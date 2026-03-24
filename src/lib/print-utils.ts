
import type { CardsPerPage, PaperSize, Orientation, PrintLayout } from './types'

const INCH_TO_PX = 96
const MM_TO_PX = INCH_TO_PX / 25.4

export const PAPER_SIZES = {
  letter: {
    width: 8.5 * INCH_TO_PX,
    height: 11 * INCH_TO_PX,
  },
  a4: {
    width: 210 * MM_TO_PX,
    height: 297 * MM_TO_PX,
  },
}

const SAFE_MARGIN = 0.5 * INCH_TO_PX
const TARGET_ASPECT_RATIO = 3 / 2

export function calculatePrintLayout(
  cardsPerPage: CardsPerPage,
  paperSize: PaperSize,
  orientation: Orientation
): PrintLayout {
  let pageWidth = PAPER_SIZES[paperSize].width
  let pageHeight = PAPER_SIZES[paperSize].height

  if (orientation === 'landscape') {
    ;[pageWidth, pageHeight] = [pageHeight, pageWidth]
  }

  const { rows, cols } = getRowsCols(cardsPerPage)
  const availableWidth = pageWidth - SAFE_MARGIN * 2
  const availableHeight = pageHeight - SAFE_MARGIN * 2

  const gapX = cardsPerPage <= 2 ? 16 : 12
  const gapY = cardsPerPage <= 2 ? 16 : 12

  const maxCardWidth = (availableWidth - gapX * (cols - 1)) / cols
  const maxCardHeight = (availableHeight - gapY * (rows - 1)) / rows

  let cardWidth: number
  let cardHeight: number

  if (maxCardWidth / maxCardHeight > TARGET_ASPECT_RATIO) {
    cardHeight = maxCardHeight
    cardWidth = cardHeight * TARGET_ASPECT_RATIO
  } else {
    cardWidth = maxCardWidth
    cardHeight = cardWidth / TARGET_ASPECT_RATIO
  }

  const gridWidth = cardWidth * cols + gapX * (cols - 1)
  const gridHeight = cardHeight * rows + gapY * (rows - 1)
  const extraH = Math.max(0, availableWidth - gridWidth)
  const extraV = Math.max(0, availableHeight - gridHeight)

  const marginLeft = SAFE_MARGIN + extraH / 2
  const marginRight = SAFE_MARGIN + extraH / 2
  const marginTop = SAFE_MARGIN + extraV / 2
  const marginBottom = SAFE_MARGIN + extraV / 2

  return {
    cardsPerPage,
    cardWidth,
    cardHeight,
    rows,
    cols,
    pageWidth,
    pageHeight,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    gapX,
    gapY,
  }
}

function getRowsCols(cardsPerPage: CardsPerPage): { rows: number; cols: number } {
  const layouts: Record<CardsPerPage, { rows: number; cols: number }> = {
    1: { rows: 1, cols: 1 },
    2: { rows: 2, cols: 1 },
    4: { rows: 2, cols: 2 },
    6: { rows: 3, cols: 2 },
    8: { rows: 4, cols: 2 },
    9: { rows: 3, cols: 3 },
    10: { rows: 5, cols: 2 },
    12: { rows: 4, cols: 3 },
  }
  return layouts[cardsPerPage]
}

export function calculateBackPagePositions(
  cardsPerPage: CardsPerPage,
  duplexMode: 'long-edge' | 'short-edge',
  orientation: Orientation
): number[] {
  const { rows, cols } = getRowsCols(cardsPerPage)
  const positions: number[] = []

  if (duplexMode === 'long-edge') {
    if (orientation === 'portrait') {
      for (let row = 0; row < rows; row++) {
        for (let col = cols - 1; col >= 0; col--) {
          positions.push(row * cols + col)
        }
      }
    } else {
      for (let row = rows - 1; row >= 0; row--) {
        for (let col = 0; col < cols; col++) {
          positions.push(row * cols + col)
        }
      }
    }
  } else {
    if (orientation === 'portrait') {
      for (let row = rows - 1; row >= 0; row--) {
        for (let col = 0; col < cols; col++) {
          positions.push(row * cols + col)
        }
      }
    } else {
      for (let row = 0; row < rows; row++) {
        for (let col = cols - 1; col >= 0; col--) {
          positions.push(row * cols + col)
        }
      }
    }
  }

  return positions
}

export function paginateCards<T>(cards: T[], cardsPerPage: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < cards.length; i += cardsPerPage) {
    pages.push(cards.slice(i, i + cardsPerPage))
  }
  return pages
}

export function paginateCardsFixedLength<T>(cards: T[], cardsPerPage: number): (T | null)[][] {
  const pages = paginateCards(cards, cardsPerPage)
  return pages.map((page) => Array.from({ length: cardsPerPage }, (_, index) => page[index] ?? null))
}

export function calculateFontSize(
  baseSize: number,
  cardsPerPage: CardsPerPage,
  textLength: number,
  hasImage = false
): number {
  const scaleFactor = cardsPerPage <= 2 ? 1.45 : cardsPerPage <= 4 ? 1.15 : cardsPerPage <= 6 ? 1 : 0.85
  let adjustedSize = baseSize * scaleFactor

  if (hasImage) {
    adjustedSize *= cardsPerPage <= 4 ? 0.78 : 0.70
  }

  if (textLength > 60) {
    adjustedSize *= 0.72
  } else if (textLength > 40) {
    adjustedSize *= 0.82
  } else if (textLength > 24) {
    adjustedSize *= 0.92
  }

  return Math.max(adjustedSize, 10)
}
