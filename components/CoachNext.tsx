"use client"

import { Sparkles, X } from "lucide-react"

export type CoachTip = {
  headline: string
  focus: "protein" | "carbs" | "fat" | "balanced"
  detail: string
  suggestions: string[]
}

const FOCUS_COLOR: Record<CoachTip["focus"], string> = {
  protein: "text-protein",
  carbs: "text-carb",
  fat: "text-fat",
  balanced: "text-ink",
}

/**
 * Live coach card — appears right after a meal is saved with guidance
 * for the NEXT meal, based on what's been logged so far today.
 * A guide in the moment, not a post-mortem.
 */
export default function CoachNext({
  tip,
  nextMeal,
  onClose,
}: {
  tip: CoachTip
  nextMeal: string
  onClose: () => void
}) {
  return (
    <div className="relative bg-surface border border-hair rounded-[22px] p-5 overflow-hidden animate-fade-slide-up">
      {/* soft glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-burn/20 blur-3xl pointer-events-none" />

      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-ink-faint text-sm transition-all duration-150 hover:bg-black/50 hover:text-ink active:scale-90"
        aria-label="Dismiss"
      >
        ✕
      </button>

      <div className="relative space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-burn to-burn-2 flex items-center justify-center shrink-0">
            <Sparkles size={13} className="text-ground" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            Coach · for {nextMeal}
          </p>
        </div>

        <h3 className={`text-lg font-bold tracking-tight ${FOCUS_COLOR[tip.focus]}`}>
          {tip.headline}
        </h3>

        {tip.detail && (
          <p className="text-sm text-ink-dim leading-relaxed">{tip.detail}</p>
        )}

        {tip.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {tip.suggestions.map((s, i) => (
              <span
                key={i}
                className="bg-surface-2 border border-hair rounded-full px-3 py-1.5 text-xs font-semibold text-ink"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
