"use client"

import { Refrigerator, Sparkles, X, Loader2 } from "lucide-react"

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
  doneForDay,
  closureNote,
  fridgeAction,
  onFridgeSnap,
  onLogSuggestion,
  loggingSuggestion,
  onClose,
}: {
  tip: CoachTip
  nextMeal: string
  doneForDay?: boolean
  /** Woven follow-through for the done-for-day closure, e.g. "That salmon took care of your protein." */
  closureNote?: string | null
  /** Suggestions weren't grounded in her history — offer a fridge snap instead of guessing. */
  fridgeAction?: boolean
  onFridgeSnap?: () => void
  /** One-tap logging: a tapped suggestion opens a pre-filled meal card. */
  onLogSuggestion?: (suggestion: string) => void
  /** Which suggestion is being logged right now — chip press feedback. */
  loggingSuggestion?: string | null
  onClose: () => void
}) {
  const showFridge = !!fridgeAction && !!onFridgeSnap
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
        {doneForDay ? (
          <>
            {closureNote && (
              <p className="text-[13px] text-ink-dim leading-relaxed">
                {closureNote}
              </p>
            )}
            <p className="text-[13px] text-ink-dim leading-relaxed pt-0.5">
              You&apos;re all set for today.
            </p>
          </>
        ) : (
          <>
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

        {tip.suggestions.length > 0 && !showFridge && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {tip.suggestions.map((s, i) =>
              onLogSuggestion ? (
                <button
                  key={i}
                  onClick={() => onLogSuggestion(s)}
                  disabled={!!loggingSuggestion}
                  title={`Log "${s}"`}
                  className={`flex items-center gap-1.5 bg-surface-2 border border-hair rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-dim transition-all duration-150 ease-spring hover:border-protein/40 hover:text-ink active:scale-95 disabled:cursor-wait ${
                    loggingSuggestion
                      ? loggingSuggestion === s
                        ? "border-protein/50 text-ink"
                        : "opacity-50"
                      : ""
                  }`}
                >
                  {loggingSuggestion === s && (
                    <Loader2 size={12} className="animate-spin shrink-0" />
                  )}
                  {s}
                </button>
              ) : (
                <span
                  key={i}
                  className="bg-surface-2 border border-hair rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-dim"
                >
                  {s}
                </span>
              )
            )}
          </div>
        )}

        {showFridge && (
          <button
            onClick={onFridgeSnap}
            className="group w-full flex items-center gap-3 bg-surface-2 border border-hair rounded-xl px-3.5 py-3 text-left transition-all duration-200 hover:border-carb/40 active:scale-[0.98]"
          >
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-carb to-protein flex items-center justify-center shrink-0 transition-transform duration-300 group-active:rotate-12">
              <Refrigerator size={15} className="text-ground" />
            </span>
            <span>
              <span className="block text-[13px] font-bold text-ink">
                Snap your fridge
              </span>
              <span className="block text-[11px] font-normal text-ink-faint mt-0.5">
                Ideas from what&apos;s actually in there
              </span>
            </span>
          </button>
        )}

          </>
        )}
      </div>
    </div>
  )
}
