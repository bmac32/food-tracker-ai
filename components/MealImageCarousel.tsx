"use client"

import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

type Props = {
  images: string[]
  index: number
  onChange: (i: number) => void
  /** Optional: fetch a fresh set of candidates ("none of these match") */
  onRefresh?: () => void
  refreshing?: boolean
  /** Sizing classes for the carousel frame, e.g. "h-[260px]" */
  className?: string
  alt?: string
}

const SWIPE_THRESHOLD = 60

/**
 * Swipeable meal photo picker. Touch *and* mouse drag supported.
 * `touch-action: pan-y` lets vertical page scroll pass through while
 * horizontal drags are captured for the carousel.
 */
export default function MealImageCarousel({
  images,
  index,
  onChange,
  onRefresh,
  refreshing = false,
  className = "h-[260px]",
  alt = "Meal photo",
}: Props) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const movedFar = useRef(false)

  const safeImages = images.length > 0 ? images : []
  const clamped = Math.min(Math.max(index, 0), Math.max(safeImages.length - 1, 0))
  const multi = safeImages.length > 1

  const begin = (clientX: number) => {
    startX.current = clientX
    movedFar.current = false
    setDragging(true)
    setDragX(0)
  }

  const move = (clientX: number) => {
    const dx = clientX - startX.current
    if (Math.abs(dx) > 10) movedFar.current = true
    setDragX(dx)
  }

  const end = () => {
    if (!dragging) return
    const dx = dragX
    setDragging(false)
    setDragX(0)
    if (!multi) return
    if (dx <= -SWIPE_THRESHOLD && clamped < safeImages.length - 1) {
      onChange(clamped + 1)
    } else if (dx >= SWIPE_THRESHOLD && clamped > 0) {
      onChange(clamped - 1)
    }
  }

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        begin(e.clientX)
      }}
      onPointerMove={(e) => {
        if (dragging) move(e.clientX)
      }}
      onPointerUp={end}
      onPointerCancel={() => {
        setDragging(false)
        setDragX(0)
      }}
      // A drag that ends over a button shouldn't fire its click.
      onClickCapture={(e) => {
        if (movedFar.current) {
          e.stopPropagation()
          e.preventDefault()
          movedFar.current = false
        }
      }}
    >
      {/* TRACK */}
      <div
        className="flex h-full"
        style={{
          transform: `translateX(calc(${-clamped * 100}% + ${dragX}px))`,
          transition: dragging ? "none" : "transform 280ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {safeImages.map((src, i) => (
          <div key={`${src}-${i}`} className="w-full h-full shrink-0">
            <img
              src={src}
              alt={alt}
              draggable={false}
              loading={i === 0 ? "eager" : "lazy"}
              className="w-full h-full object-cover pointer-events-none"
            />
          </div>
        ))}
      </div>

      {multi && (
        <>
          {/* COUNTER */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[5] px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-[11px] font-semibold tabular-nums text-ink">
            {clamped + 1} / {safeImages.length}
          </div>

          {/* CHEVRONS */}
          {clamped > 0 && (
            <button
              aria-label="Previous photo"
              onClick={() => onChange(clamped - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-[5] w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink transition-all duration-150 hover:bg-black/60 active:scale-90"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {clamped < safeImages.length - 1 && (
            <button
              aria-label="Next photo"
              onClick={() => onChange(clamped + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-[5] w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink transition-all duration-150 hover:bg-black/60 active:scale-90"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </>
      )}

      {/* REFRESH CANDIDATES */}
      {onRefresh && (
        <button
          aria-label="Load different photos"
          title="None of these match? Load more photos"
          onClick={onRefresh}
          disabled={refreshing}
          className="absolute bottom-3 right-3 z-[5] w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink transition-all duration-150 hover:bg-black/60 active:scale-90 disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        </button>
      )}
    </div>
  )
}
