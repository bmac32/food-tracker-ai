"use client"

import { useState } from "react"
import { ChevronDown, ChartPie } from "lucide-react"

// Collapsible "where your macros come from" breakdown. Read-only and
// shame-free: it informs the portion balance, never instructs.
// Used on the review card and on saved meals in the feed.
export type PortionShareItem = {
  item: string
  protein: number
  carbs: number
  fat: number
}

type ShareMode = "calories" | "protein" | "carbs" | "fat"
const SHARE_MODES: ShareMode[] = ["calories", "protein", "carbs", "fat"]

// Muted editorial segment colors for the share bar.
const SEGMENT_COLORS = [
  "#c98f4e",
  "#7ba05b",
  "#5b8dc9",
  "#c96a5b",
  "#9b7fc9",
  "#5bc9b0",
  "#c95b85",
  "#7f8dc9",
]

const calsOf = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9

export default function PortionBalance({
  items,
  className = "",
}: {
  items: PortionShareItem[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [shareMode, setShareMode] = useState<ShareMode>("calories")

  if (!items || items.length === 0) return null

  const shareValues = items.map((it) =>
    shareMode === "calories"
      ? calsOf(it.protein, it.carbs, it.fat)
      : it[shareMode]
  )
  const shareTotal = shareValues.reduce((s, v) => s + v, 0)
  const shares = shareValues.map((v) =>
    shareTotal > 0 ? Math.round((v / shareTotal) * 100) : 0
  )

  return (
    <div className={className}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 bg-surface-2 border border-hair rounded-xl px-3 py-2.5 text-xs text-ink transition-all duration-150 ease-spring hover:bg-white/10 active:scale-[0.99]"
      >
        <ChartPie size={14} className="text-protein shrink-0" />
        <span className="flex-1 text-left font-medium">
          {open ? "My portions" : "View my portions"}
        </span>
        <ChevronDown
          size={14}
          className={`text-ink-faint shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-2 animate-fade-in">
          {/* mode toggle */}
          <div className="flex bg-surface-2 rounded-full p-0.5 text-[11px] mb-2">
            {SHARE_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => setShareMode(mode)}
                className={`flex-1 px-1 py-0.5 rounded-full capitalize transition-all duration-150 active:scale-95 ${
                  shareMode === mode
                    ? "bg-ground text-ink"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* stacked share bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-2 mb-1">
            {items.map((it, i) =>
              shares[i] > 0 ? (
                <div
                  key={i}
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${shares[i]}%`,
                    backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  }}
                />
              ) : null
            )}
          </div>

          {/* per-ingredient shares */}
          <div className="divide-y divide-hair/50">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  }}
                />
                <span className="flex-1 truncate text-xs text-ink">
                  {it.item}
                </span>
                <span className="text-[11px] text-ink-faint tabular-nums shrink-0">
                  {shares[i]}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
