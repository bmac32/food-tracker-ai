"use client"

import { useEffect, useRef, useState } from "react"
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
const SETTLE_MS = 300

const mod = (n: number, m: number) => ((n % m) + m) % m

/**
 * Swipeable meal photo picker with infinite wrap-around: swipe left or
 * right forever, chevrons always visible. Touch *and* mouse drag supported.
 * `touch-action: pan-y` lets vertical page scroll pass through while
 * horizontal drags are captured for the carousel.
 *
 * Technique: render [last, ...images, first] and keep an internal position
 * 1..n; when the position lands on a clone, snap back to the real slide
 * with animation disabled. The drag distance lives in a ref (not state)
 * so fast flicks can't read a stale value on release.
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
  const n = images.length
  // Internal track position: 1..n are the real slides, 0 and n+1 are clones.
  const [pos, setPos] = useState(() => mod(index, Math.max(n, 1)) + 1)
  const [anim, setAnim] = useState(true)
  const [dragPx, setDragPx] = useState(0)

  const dragging = useRef(false)
  const startX = useRef(0)
  const liveDx = useRef(0) // ref mirror — never stale on release
  const movedFar = useRef(false)
  const settling = useRef(false)
  const lastEmitted = useRef(index)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const posRef = useRef(pos)
  posRef.current = pos

  // Reset when the image set changes size (e.g. fresh candidates loaded).
  useEffect(() => {
    if (n === 0) return
    const real = mod(index, n)
    lastEmitted.current = real
    posRef.current = real + 1
    setAnim(true)
    setPos(real + 1)
    setDragPx(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  // External index change (parent picked a photo another way) → resync.
  useEffect(() => {
    if (n === 0 || settling.current) return
    if (index !== lastEmitted.current) {
      lastEmitted.current = index
      posRef.current = mod(index, n) + 1
      setAnim(true)
      setPos(mod(index, n) + 1)
    }
  }, [index, n])

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current)
    },
    []
  )

  const realIndex = n > 0 ? mod(pos - 1, n) : 0
  const multi = n > 1

  const go = (delta: number) => {
    if (!multi || settling.current) return
    const target = posRef.current + delta
    const real = mod(target - 1, n)
    posRef.current = target
    setAnim(true)
    setPos(target)
    lastEmitted.current = real
    onChange(real)

    // Landed on a clone → snap to the matching real slide invisibly.
    if (target === 0 || target === n + 1) {
      settling.current = true
      settleTimer.current = setTimeout(() => {
        const snapped = target === 0 ? n : 1
        posRef.current = snapped
        setAnim(false)
        setPos(snapped)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setAnim(true)
            settling.current = false
          })
        })
      }, SETTLE_MS)
    }
  }

  const begin = (clientX: number) => {
    if (settling.current) return
    dragging.current = true
    startX.current = clientX
    liveDx.current = 0
    movedFar.current = false
    setDragPx(0)
  }

  const move = (clientX: number) => {
    if (!dragging.current) return
    const dx = clientX - startX.current
    if (Math.abs(dx) > 10) movedFar.current = true
    liveDx.current = dx
    setDragPx(dx)
  }

  const end = () => {
    if (!dragging.current) return
    dragging.current = false
    const dx = liveDx.current // ref — always the latest value
    liveDx.current = 0
    setDragPx(0)
    if (!multi || settling.current) return
    if (dx <= -SWIPE_THRESHOLD) go(1)
    else if (dx >= SWIPE_THRESHOLD) go(-1)
  }

  if (n === 0) return null

  // [last, ...images, first] for seamless wrap-around.
  const slides = [images[n - 1], ...images, images[0]]

  return (
    <div
      className={`relative overflow-hidden select-none ${className}`}
      style={{ touchAction: "pan-y" }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        begin(e.clientX)
      }}
      onPointerMove={(e) => move(e.clientX)}
      onPointerUp={end}
      onPointerCancel={() => {
        dragging.current = false
        liveDx.current = 0
        setDragPx(0)
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
          transform: `translateX(calc(${-pos * 100}% + ${dragPx}px))`,
          transition: anim ? `transform ${SETTLE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` : "none",
        }}
      >
        {slides.map((src, i) => (
          <div key={`${src}-${i}`} className="w-full h-full shrink-0">
            <img
              src={src}
              alt={alt}
              draggable={false}
              loading={i <= 2 ? "eager" : "lazy"}
              className="w-full h-full object-cover pointer-events-none"
            />
          </div>
        ))}
      </div>

      {multi && (
        <>
          {/* DOTS */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[5] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10">
            {images.map((_, i) => (
              <button
                key={i}
                aria-label={`Photo ${i + 1}`}
                onClick={() => {
                  if (i === realIndex || settling.current) return
                  const target = i + 1 // direct jump — never a clone
                  posRef.current = target
                  setAnim(true)
                  setPos(target)
                  lastEmitted.current = i
                  onChange(i)
                }}
                className={`rounded-full transition-all duration-200 ${
                  i === realIndex
                    ? "w-4 h-1.5 bg-white"
                    : "w-1.5 h-1.5 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>

          {/* CHEVRONS — always visible, wrap around */}
          <button
            aria-label="Previous photo"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-[5] w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink transition-all duration-150 hover:bg-black/60 active:scale-90"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            aria-label="Next photo"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-[5] w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink transition-all duration-150 hover:bg-black/60 active:scale-90"
          >
            <ChevronRight size={16} />
          </button>
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
