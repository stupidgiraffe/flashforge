import type { FlashCardSet, FlashCard, PrintSettings } from '@/lib/types'
import { calculateFontSize } from '@/lib/print-utils'
import { cn } from '@/lib/utils'

interface FlashCardDisplayProps {
  card: FlashCard
  settings: PrintSettings
  cardWidth: number
  cardHeight: number
  cardNumber?: number
  side?: 'front' | 'back'
  showSetTitle?: string
}

export function FlashCardDisplay({
  card,
  settings,
  cardWidth,
  cardHeight,
  cardNumber,
  side = 'front',
  showSetTitle,
}: FlashCardDisplayProps) {
  const isFront = side === 'front'
  const text = isFront ? card.frontText : card.backText
  const secondary = isFront ? card.frontSecondary : card.backSecondary
  
  let imageUrl: string | undefined
  if (isFront) {
    imageUrl = card.frontImageUrl || (card.imagePosition === 'front' || card.imagePosition === 'both' ? card.imageUrl : undefined)
  } else {
    imageUrl = card.backImageUrl || (card.imagePosition === 'back' || card.imagePosition === 'both' ? card.imageUrl : undefined)
  }

  const fontSize = calculateFontSize(settings.fontSize, settings.cardsPerPage, text?.length || 0)
  const secondaryFontSize = fontSize * 0.7

  const themeClasses = getThemeClasses(settings.theme)
  const borderClass = settings.showBorder ? 'border-2' : 'border-0'
  const roundedClass = settings.showRoundedCorners ? 'rounded-xl' : 'rounded-none'

  const imageHeight = cardHeight * 0.5

  return (
    <div
      className={cn(
        'relative overflow-hidden flex flex-col shadow-sm',
        themeClasses,
        borderClass,
        roundedClass
      )}
      style={{
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        borderColor: settings.mainColor,
        borderWidth: settings.showBorder ? `${settings.borderThickness}px` : 0,
        borderRadius: settings.showRoundedCorners ? `${settings.cornerRadius}px` : 0,
      }}
    >
      {settings.showNumbering && cardNumber !== undefined && (
        <div
          className="absolute top-3 left-3 text-xs font-semibold opacity-40 z-10"
          style={{ color: settings.mainColor }}
        >
          #{cardNumber}
        </div>
      )}

      {showSetTitle && settings.showSetTitle && (
        <div
          className="absolute top-3 right-3 text-xs font-semibold opacity-40 max-w-[60%] truncate z-10"
          style={{ color: settings.mainColor }}
        >
          {showSetTitle}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {imageUrl && (
          <div
            className="mb-4 rounded-lg overflow-hidden"
            style={{
              width: '100%',
              maxHeight: `${imageHeight}px`,
              minHeight: `${Math.min(imageHeight, 120)}px`,
            }}
          >
            <img
              src={imageUrl}
              alt={text || ''}
              className="w-full h-full"
              style={{
                objectFit: settings.imageFit === 'contain' ? 'contain' : 'cover',
                objectPosition: 'center',
              }}
            />
          </div>
        )}

        {text && (
          <div
            className={cn(
              'font-bold break-words hyphens-auto w-full',
              settings.textAlignment === 'left' && 'text-left',
              settings.textAlignment === 'center' && 'text-center',
              settings.textAlignment === 'right' && 'text-right'
            )}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: 1.3,
              color: settings.mainColor,
              fontFamily: settings.fontFamily,
            }}
          >
            {text}
          </div>
        )}

        {secondary && (
          <div
            className={cn(
              'mt-3 break-words w-full',
              settings.textAlignment === 'left' && 'text-left',
              settings.textAlignment === 'center' && 'text-center',
              settings.textAlignment === 'right' && 'text-right'
            )}
            style={{
              fontSize: `${secondaryFontSize}px`,
              lineHeight: 1.4,
              color: settings.accentColor,
              fontFamily: settings.fontFamily,
            }}
          >
            {secondary}
          </div>
        )}
      </div>

      {settings.footerText && (
        <div
          className="text-xs text-center py-2 border-t opacity-40"
          style={{ borderColor: settings.mainColor, color: settings.mainColor }}
        >
          {settings.footerText}
        </div>
      )}
    </div>
  )
}

function getThemeClasses(theme: string): string {
  const themes: Record<string, string> = {
    minimal: 'bg-white',
    'classroom-cute': 'bg-amber-50',
    'bold-vocabulary': 'bg-gradient-to-br from-blue-50 to-purple-50',
    'picture-focus': 'bg-gray-50',
    'ink-saver': 'bg-white',
    'quiz-card': 'bg-slate-50',
  }
  return themes[theme] || 'bg-white'
}
