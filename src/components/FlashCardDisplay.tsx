import type { FlashCard, PrintSettings } from '@/lib/types'
import { calculateFontSize } from '@/lib/print-utils'
import { cn } from '@/lib/utils'

interface FlashCardDisplayProps {
  card: FlashCard | null
  settings: PrintSettings
  cardWidth: number
  cardHeight: number
  cardNumber?: number
  side?: 'front' | 'back'
  showSetTitle?: string
  printMode?: boolean
}

export function FlashCardDisplay({
  card,
  settings,
  cardWidth,
  cardHeight,
  cardNumber,
  side = 'front',
  showSetTitle,
  printMode = false,
}: FlashCardDisplayProps) {
  if (!card) {
    return (
      <div
        className={cn(
          'border border-dashed border-border/80 bg-white/40 rounded-lg',
          printMode && 'print-empty-card',
        )}
        style={{
          width: printMode ? '100%' : `${cardWidth}px`,
          height: printMode ? '100%' : `${cardHeight}px`,
          borderRadius: settings.showRoundedCorners ? `${settings.cornerRadius}px` : 0,
        }}
      />
    )
  }

  const isFront = side === 'front'
  const text = isFront ? card.frontText : card.backText
  const secondary = isFront ? card.frontSecondary : card.backSecondary

  let imageUrl: string | undefined
  let imageScale = 1

  if (isFront) {
    imageUrl = card.frontImageUrl || (card.imagePosition === 'front' || card.imagePosition === 'both' ? card.imageUrl : undefined)
    imageScale = card.frontImageScale ?? card.imageScale ?? 1
  } else {
    imageUrl = card.backImageUrl || (card.imagePosition === 'back' || card.imagePosition === 'both' ? card.imageUrl : undefined)
    imageScale = card.backImageScale ?? card.imageScale ?? 1
  }

  const fontSize = calculateFontSize(settings.fontSize, settings.cardsPerPage, text?.length || 0)
  const secondaryFontSize = fontSize * 0.72
  const themeClasses = getThemeClasses(settings.theme)
  const borderClass = settings.showBorder ? 'border-2' : 'border-0'
  const roundedClass = settings.showRoundedCorners ? 'rounded-xl' : 'rounded-none'
  const imageHeight = cardHeight * 0.56

  return (
    <div
      className={cn(
        'relative overflow-hidden flex flex-col shadow-md',
        themeClasses,
        borderClass,
        roundedClass,
      )}
      style={{
        width: printMode ? '100%' : `${cardWidth}px`,
        height: printMode ? '100%' : `${cardHeight}px`,
        borderColor: settings.mainColor,
        borderWidth: settings.showBorder ? `${settings.borderThickness}px` : 0,
        borderRadius: settings.showRoundedCorners ? `${settings.cornerRadius}px` : 0,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          backgroundColor: settings.accentColor,
          opacity: 0.45,
          borderRadius: settings.showRoundedCorners ? `${settings.cornerRadius}px ${settings.cornerRadius}px 0 0` : '0',
        }}
      />

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

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-1">
        {imageUrl && (
          <div
            className="mb-4 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/70"
            style={{
              width: '100%',
              maxHeight: `${imageHeight}px`,
              minHeight: `${Math.min(imageHeight, 140)}px`,
            }}
          >
            <img
              src={imageUrl}
              alt={text || ''}
              className="w-full h-full"
              style={{
                objectFit:
                  settings.imageFit === 'contain'
                    ? 'contain'
                    : settings.imageFit === 'center'
                      ? 'none'
                      : 'cover',
                objectPosition: 'center',
                transform: settings.imageFit === 'center' ? `scale(${imageScale})` : undefined,
              }}
            />
          </div>
        )}

        {text && (
          <div
            className={cn(
              'font-bold break-words hyphens-auto w-full text-balance',
              settings.textAlignment === 'left' && 'text-left',
              settings.textAlignment === 'center' && 'text-center',
              settings.textAlignment === 'right' && 'text-right',
            )}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: 1.28,
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
              'mt-3 break-words w-full text-pretty',
              settings.textAlignment === 'left' && 'text-left',
              settings.textAlignment === 'center' && 'text-center',
              settings.textAlignment === 'right' && 'text-right',
            )}
            style={{
              fontSize: `${secondaryFontSize}px`,
              lineHeight: 1.38,
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
    minimal: 'bg-gradient-to-br from-white to-slate-50',
    'classroom-cute': 'bg-gradient-to-br from-amber-50 to-orange-50',
    'bold-vocabulary': 'bg-gradient-to-br from-blue-50 to-purple-50',
    'picture-focus': 'bg-gradient-to-br from-gray-50 to-slate-100',
    'ink-saver': 'bg-white',
    'quiz-card': 'bg-gradient-to-br from-slate-50 to-slate-100',
    'playful-pop': 'bg-gradient-to-br from-pink-50 via-white to-cyan-50',
    'teacher-pro': 'bg-gradient-to-br from-white via-slate-50 to-blue-50',
    'calm-study': 'bg-gradient-to-br from-emerald-50 to-teal-50',
  }
  return themes[theme] || 'bg-gradient-to-br from-white to-slate-50'
}
