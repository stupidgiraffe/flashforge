import type { FlashCard, ImageAsset, ImageCandidate, ImagePlacement, ImagePlacementMode } from '@/lib/types'

export const MIN_IMAGE_ZOOM = 1
export const MAX_IMAGE_ZOOM = 3

export const DEFAULT_IMAGE_PLACEMENT: ImagePlacement = {
  mode: 'fit',
  zoom: 1,
  x: 0,
  y: 0,
}

export interface ImagePlacementGeometry {
  width: number
  height: number
  left: number
  top: number
  scale: number
  overflowX: number
  overflowY: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeImagePlacement(
  value: Partial<ImagePlacement> | undefined,
  fallbackMode: ImagePlacementMode = 'fit',
): ImagePlacement {
  return {
    mode: value?.mode === 'fill' || value?.mode === 'fit' ? value.mode : fallbackMode,
    zoom: clamp(finiteNumber(value?.zoom, 1), MIN_IMAGE_ZOOM, MAX_IMAGE_ZOOM),
    x: clamp(finiteNumber(value?.x, 0), -1, 1),
    y: clamp(finiteNumber(value?.y, 0), -1, 1),
    ...(value?.focalPoint
      ? {
          focalPoint: {
            x: clamp(finiteNumber(value.focalPoint.x, 0.5), 0, 1),
            y: clamp(finiteNumber(value.focalPoint.y, 0.5), 0, 1),
          },
        }
      : {}),
  }
}

export function getImagePlacementGeometry({
  imageWidth,
  imageHeight,
  frameWidth,
  frameHeight,
  placement,
}: {
  imageWidth: number
  imageHeight: number
  frameWidth: number
  frameHeight: number
  placement: ImagePlacement
}): ImagePlacementGeometry {
  if (imageWidth <= 0 || imageHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return { width: 0, height: 0, left: 0, top: 0, scale: 0, overflowX: 0, overflowY: 0 }
  }

  const normalized = normalizeImagePlacement(placement)
  const fitScale = Math.min(frameWidth / imageWidth, frameHeight / imageHeight)
  const fillScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight)
  const baseScale = normalized.mode === 'fill' ? fillScale : fitScale
  const scale = baseScale * normalized.zoom
  const width = imageWidth * scale
  const height = imageHeight * scale
  const overflowX = Math.max(0, width - frameWidth)
  const overflowY = Math.max(0, height - frameHeight)

  return {
    width,
    height,
    scale,
    overflowX,
    overflowY,
    left: (frameWidth - width) / 2 - normalized.x * overflowX / 2,
    top: (frameHeight - height) / 2 - normalized.y * overflowY / 2,
  }
}

export function placementFromLegacy(
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  fallbackMode: ImagePlacementMode = 'fill',
): ImagePlacement {
  return normalizeImagePlacement({
    mode: fallbackMode,
    zoom: Math.max(1, scale),
    x: clamp(offsetX / 180, -1, 1),
    y: clamp(offsetY / 180, -1, 1),
  }, fallbackMode)
}

export function imageAssetFromCandidate(candidate: ImageCandidate, displayUrl = candidate.url): ImageAsset {
  return {
    url: displayUrl,
    originalUrl: candidate.originalUrl || candidate.url,
    title: candidate.title,
    description: candidate.description,
    provider: candidate.provider,
    sourcePage: candidate.sourcePage,
    width: candidate.width,
    height: candidate.height,
    selectedCandidateId: candidate.id,
    confidence: candidate.confidence,
    needsReview: candidate.needsReview,
  }
}

export function getCardSideImage(
  card: FlashCard,
  side: 'front' | 'back',
  fallbackMode: ImagePlacementMode = 'fill',
) {
  const asset = side === 'front' ? card.frontImage : card.backImage
  const legacyUrl = side === 'front' ? card.frontImageUrl : card.backImageUrl
  const legacyScale = side === 'front' ? card.frontImageScale : card.backImageScale
  const legacyOffsetX = side === 'front' ? card.frontImageOffsetX : card.backImageOffsetX
  const legacyOffsetY = side === 'front' ? card.frontImageOffsetY : card.backImageOffsetY
  const placement = side === 'front' ? card.frontImagePlacement : card.backImagePlacement

  return {
    asset,
    url: asset?.url || legacyUrl,
    placement: placement
      ? normalizeImagePlacement(placement)
      : placementFromLegacy(legacyScale, legacyOffsetX, legacyOffsetY, fallbackMode),
  }
}
