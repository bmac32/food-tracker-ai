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
    <div className="relative bg-surface border border-hair rounded-[22px] p-4 overflow-hidden animate-fade-slide-up">

      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-ink-faint text-xs transition-all duration-150 hover:bg-black/50 hover:text-ink active:scale-90"
        aria-label="Dismiss"
      >
        ✕
      </button>

      <div className="relative space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-surface-2 border border-hair flex items-center justify-center shrink-0">
            <Sparkles size={12} className="text-ink-faint" />
          </span>
          <p className="text-[11px] font-semibold tracking-wide text-ink-faint">
            For {nextMeal}
          </p>
        </div>

        <h3 className={`text-[15px] font-bold tracking-tight ${FOCUS_COLOR[tip.focus]}`}>
          {tip.headline}
        </h3>

        {tip.detail && (
          <p className="text-[13px] text-ink-dim leading-relaxed">{tip.detail}</p>
        )}

        {tip.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {tip.suggestions.map((s, i) => (
              <span
                key={i}
                className="bg-surface-2 border border-hair rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-dim"
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
