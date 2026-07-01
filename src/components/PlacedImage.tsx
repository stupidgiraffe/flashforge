import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ImagePlacement } from '@/lib/types'
import { getImagePlacementGeometry, normalizeImagePlacement } from '@/lib/image-placement'
import { cn } from '@/lib/utils'

interface PlacedImageProps {
  src: string
  alt: string
  placement: ImagePlacement
  className?: string
  imageClassName?: string
}

export function PlacedImage({ src, alt, placement, className, imageClassName }: PlacedImageProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const update = () => setFrameSize({ width: frame.clientWidth, height: frame.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const geometry = getImagePlacementGeometry({
    imageWidth: imageSize.width,
    imageHeight: imageSize.height,
    frameWidth: frameSize.width,
    frameHeight: frameSize.height,
    placement: normalizeImagePlacement(placement),
  })

  const style: CSSProperties = geometry.width > 0
    ? {
        position: 'absolute',
        width: `${geometry.width}px`,
        height: `${geometry.height}px`,
        left: `${geometry.left}px`,
        top: `${geometry.top}px`,
        maxWidth: 'none',
        maxHeight: 'none',
      }
    : { visibility: 'hidden' }

  return (
    <div ref={frameRef} className={cn('absolute inset-0 overflow-hidden', className)}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={cn('select-none', imageClassName)}
        style={style}
        onLoad={(event) => setImageSize({
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight,
        })}
      />
    </div>
  )
}
