import { useRef } from 'react'
import type { PointerEventHandler, WheelEventHandler } from 'react'
import { ArrowsCounterClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { PlacedImage } from '@/components/PlacedImage'
import type { ImagePlacement } from '@/lib/types'
import { MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM, normalizeImagePlacement } from '@/lib/image-placement'

interface ImagePlacementEditorProps {
  imageUrl: string
  alt: string
  placement: ImagePlacement
  onChange: (placement: ImagePlacement) => void
}

export function ImagePlacementEditor({ imageUrl, alt, placement, onChange }: ImagePlacementEditorProps) {
  const normalized = normalizeImagePlacement(placement)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null)

  const update = (changes: Partial<ImagePlacement>) => {
    onChange(normalizeImagePlacement({ ...normalized, ...changes }, normalized.mode))
  }

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: normalized.x,
      y: normalized.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    update({
      x: drag.x - (event.clientX - drag.startX) * 2 / Math.max(rect.width, 1),
      y: drag.y - (event.clientY - drag.startY) * 2 / Math.max(rect.height, 1),
    })
  }

  const handlePointerUp: PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  const handleWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    update({ zoom: normalized.zoom * Math.exp(-event.deltaY * 0.002) })
  }

  return (
    <div className="space-y-3">
      <div
        className="relative h-48 touch-none cursor-grab overflow-hidden rounded-md border-2 border-border bg-muted/30 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        aria-label={`${alt} image placement preview. Drag to reposition.`}
      >
        <PlacedImage src={imageUrl} alt={alt} placement={normalized} />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Image fit mode">
        <Button
          type="button"
          size="sm"
          variant={normalized.mode === 'fit' ? 'default' : 'outline'}
          aria-pressed={normalized.mode === 'fit'}
          onClick={() => update({ mode: 'fit', zoom: 1, x: 0, y: 0 })}
        >
          Fit whole image
        </Button>
        <Button
          type="button"
          size="sm"
          variant={normalized.mode === 'fill' ? 'default' : 'outline'}
          aria-pressed={normalized.mode === 'fill'}
          onClick={() => update({ mode: 'fill', zoom: 1, x: 0, y: 0 })}
        >
          Fill frame
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => update({ zoom: 1, x: 0, y: 0 })}
        >
          <ArrowsCounterClockwise className="mr-2" weight="bold" aria-hidden="true" />
          Reset position
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <label htmlFor={`${alt.toLowerCase()}-image-zoom`}>Zoom</label>
          <span>{Math.round(normalized.zoom * 100)}%</span>
        </div>
        <Slider
          id={`${alt.toLowerCase()}-image-zoom`}
          aria-label={`${alt} image zoom`}
          value={[normalized.zoom]}
          onValueChange={([zoom]) => update({ zoom })}
          min={MIN_IMAGE_ZOOM}
          max={MAX_IMAGE_ZOOM}
          step={0.05}
        />
        <p className="text-xs text-muted-foreground">
          Drag to reposition. Fill always covers the frame; Fit always shows the whole image.
        </p>
      </div>
    </div>
  )
}
