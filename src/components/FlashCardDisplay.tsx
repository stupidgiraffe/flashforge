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
  
  const showImage = card.imageUrl && (
    card.imagePosition === 'both' ||
    (isFront && card.imagePosition === 'front') ||
    (!isFront && card.imagePosition === 'back')
  )

  const fontSize = calculateFontSize(settings.fontSize, settings.cardsPerPage, text?.length || 0)
  const secondaryFontSize = fontSize * 0.75

  const themeClasses = getThemeClasses(settings.theme)
  const borderClass = settings.showBorder ? 'border-2' : 'border-0'
  const roundedClass = settings.showRoundedCorners ? 'rounded-lg' : 'rounded-none'

  return (
    <div
      className={cn(
        'relative overflow-hidden flex flex-col',
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
          className="absolute top-2 left-2 text-xs font-medium opacity-60"
          style={{ color: settings.mainColor }}
        >
          #{cardNumber}
        </div>
      )}

      {showSetTitle && settings.showSetTitle && (
        <div
          className="absolute top-2 right-2 text-xs font-medium opacity-60 max-w-[60%] truncate"
          style={{ color: settings.mainColor }}
        >
          {showSetTitle}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {showImage && card.imageUrl && (
          <div
            className={cn(
              'mb-3',
              settings.imageFit === 'cover' && 'w-full h-32 object-cover',
              settings.imageFit === 'contain' && 'max-w-full max-h-32 object-contain',
              settings.imageFit === 'center' && 'w-full h-32 object-center object-cover'
            )}
          >
            <img
              src={card.imageUrl}
              alt={text || ''}
              className="w-full h-full"
              style={{
                objectFit: settings.imageFit === 'contain' ? 'contain' : 'cover',
              }}
            />
          </div>
        )}

        {text && (
          <div
            className={cn(
              'font-bold break-words hyphens-auto w-full',
              `text-${settings.textAlignment}`
            )}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: 1.2,
              color: settings.mainColor,
            }}
          >
            {text}
          </div>
        )}

        {secondary && (
          <div
            className={cn(
              'mt-2 break-words w-full',
              `text-${settings.textAlignment}`
            )}
            style={{
              fontSize: `${secondaryFontSize}px`,
              lineHeight: 1.3,
              color: settings.accentColor,
            }}
          >
            {secondary}
          </div>
        )}
      </div>

      {settings.footerText && (
        <div
          className="text-xs text-center py-1 border-t opacity-50"
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
