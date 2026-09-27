"use client"

import { Droplets, Sparkles, X } from "lucide-react"
import type { CoachTip } from "./CoachNext"
import { WORKOUT_TYPES, type WorkoutType } from "@/lib/workoutMeta"

export type WorkoutCoachTip = CoachTip & {
  hydration?: string | null
}

/**
 * Workout coach card — appears right after a workout is saved with
 * recovery guidance for the next meal, based on the workout and what
 * she's already eaten today. A guide in the moment, not a post-mortem.
 */
export default function CoachWorkout({
  tip,
  workoutType,
  covered,
  onClose,
}: {
  tip: WorkoutCoachTip
  workoutType: WorkoutType
  covered?: boolean
  onClose: () => void
}) {
  const label =
    WORKOUT_TYPES.find((w) => w.value === workoutType)?.label || "Workout"
  const focusColor =
    tip.focus === "protein"
      ? "text-protein"
      : tip.focus === "carbs"
        ? "text-carb"
        : "text-ink"

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
            After your {label.toLowerCase()}
          </p>
        </div>

        {covered ? (
          <p className="text-[13px] text-ink-dim leading-relaxed pt-0.5">
            You&apos;ve already eaten well today — that workout&apos;s fueled.
            Just get some water in.
          </p>
        ) : (
          <>
            <h3 className={`text-[15px] font-bold tracking-tight ${focusColor}`}>
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

            {tip.hydration && (
              <p className="flex items-center gap-1.5 text-[12px] text-ink-faint pt-1">
                <Droplets size={12} className="shrink-0" />
                {tip.hydration}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
