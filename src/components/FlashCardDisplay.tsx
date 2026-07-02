import type { FlashCard, PrintSettings } from '@/lib/types'
import { PlacedImage } from '@/components/PlacedImage'
import { getCardSideImage } from '@/lib/image-placement'
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

  const fallbackMode = settings.imageFit === 'contain' ? 'fit' : 'fill'
  const sideImage = getCardSideImage(card, side, fallbackMode)
  const legacySharedUrl = card.imagePosition === side || card.imagePosition === 'both' ? card.imageUrl : undefined
  const imageUrl = sideImage.url || legacySharedUrl
  const imagePlacement = sideImage.url
    ? sideImage.placement
    : getCardSideImage({
        ...card,
        ...(isFront ? { frontImageUrl: legacySharedUrl } : { backImageUrl: legacySharedUrl }),
        ...(isFront ? { frontImageScale: card.imageScale } : { backImageScale: card.imageScale }),
      }, side, fallbackMode).placement

  const hasText = !!(text || secondary)
  const textLength = (text?.length || 0) + (secondary?.length || 0)
  const fontSize = printMode
    ? settings.fontSize
    : calculateFontSize(settings.fontSize, settings.cardsPerPage, textLength, !!imageUrl && hasText)
  const secondaryFontSize = fontSize * 0.72
  const themeClasses = getThemeClasses(settings.theme)
  const borderClass = settings.showBorder ? 'border-2' : 'border-0'
  const roundedClass = settings.showRoundedCorners ? 'rounded-xl' : 'rounded-none'

  const isBackgroundMode = settings.imageFit === 'background'
  // Dynamic image height: use the user-configured ratio, but if there's no text, allow more space.
  // For cards with both image and text, cap at imageHeightRatio. For image-only cards, allow up to 80%.
  const baseRatio = settings.imageHeightRatio
  const effectiveRatio = hasText ? baseRatio : Math.max(baseRatio, 0.78)
  const imageHeight = cardHeight * effectiveRatio

  // Scale minHeight proportionally with card size so small cards (8+ per page) aren't dominated by images.
  const minImageHeight = Math.min(imageHeight, settings.cardsPerPage >= 8 ? 60 : settings.cardsPerPage >= 6 ? 80 : 100)

  return (
    <div
      className={cn(
        'relative flex flex-col shadow-md overflow-hidden',
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
        {!isBackgroundMode && (
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              backgroundColor: settings.accentColor,
              opacity: 0.45,
              borderRadius: printMode || !settings.showRoundedCorners ? '0' : `${settings.cornerRadius}px ${settings.cornerRadius}px 0 0`,
            }}
          />
        )}

      {/* Background image mode: image fills the entire card */}
      {isBackgroundMode && imageUrl && (
        <>
          <PlacedImage
            src={imageUrl}
            alt={text || ''}
            placement={imagePlacement}
            className="z-0"
          />
          {hasText && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)',
                zIndex: 1,
              }}
            />
          )}
        </>
      )}

      {settings.showNumbering && cardNumber !== undefined && (
        <div
          className="absolute top-3 left-3 text-xs font-semibold opacity-40 z-10"
          style={{ color: isBackgroundMode && imageUrl ? '#ffffff' : settings.mainColor }}
        >
          #{cardNumber}
        </div>
      )}

      {showSetTitle && settings.showSetTitle && (
        <div
          className="absolute top-3 right-3 text-xs font-semibold opacity-40 max-w-[60%] truncate z-10"
          style={{ color: isBackgroundMode && imageUrl ? '#ffffff' : settings.mainColor }}
        >
          {showSetTitle}
        </div>
      )}

      {isBackgroundMode ? (
        /* Background mode: text sits at the bottom over the gradient scrim */
        <div
          className="relative flex-1 flex flex-col items-center justify-end p-6 gap-1 min-h-0"
          style={{ zIndex: 2 }}
        >
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
                color: imageUrl ? '#ffffff' : settings.mainColor,
                fontFamily: settings.fontFamily,
                textShadow: imageUrl ? '0 1px 3px rgba(0,0,0,0.5)' : undefined,
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
                color: imageUrl ? 'rgba(255,255,255,0.85)' : settings.accentColor,
                fontFamily: settings.fontFamily,
                textShadow: imageUrl ? '0 1px 2px rgba(0,0,0,0.5)' : undefined,
              }}
            >
              {secondary}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-1 min-h-0">
          {imageUrl && (
            <div
              className="relative mb-4 overflow-hidden rounded-lg bg-white/70"
              style={{
                width: '100%',
                height: `${imageHeight}px`,
                maxHeight: `${imageHeight}px`,
                minHeight: `${minImageHeight}px`,
                flexShrink: hasText ? 1 : 0,
              }}
            >
              <PlacedImage
                src={imageUrl}
                alt={text || ''}
                placement={imagePlacement}
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
      )}

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
