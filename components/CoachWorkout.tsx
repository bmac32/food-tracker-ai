"use client"

import { Sparkles, Sunrise, X } from "lucide-react"
import { WORKOUT_TYPES, type WorkoutType } from "@/lib/workoutMeta"

export type WorkoutMoveTip = {
  headline: string
  tomorrow: string
  foodNote?: string | null
}

/**
 * Fitness coach card — appears right after a workout is saved.
 * Movement-first: acknowledges the effort, then opens the loop on
 * tomorrow's movement (the mirror of the food coach's "your next meal").
 * Food is demoted to a single quiet line, only when there's a real gap.
 */
export default function CoachWorkout({
  tip,
  workoutType,
  followThrough,
  onClose,
}: {
  tip: WorkoutMoveTip
  workoutType: WorkoutType
  followThrough?: string | null
  onClose: () => void
}) {
  const label =
    WORKOUT_TYPES.find((w) => w.value === workoutType)?.label || "Workout"

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

        {followThrough && (
          <p className="text-[12px] text-ink-faint leading-relaxed">
            {followThrough}
          </p>
        )}

        <h3 className="text-[15px] font-bold tracking-tight text-ink">
          {tip.headline}
        </h3>

        <p className="flex items-start gap-1.5 text-[13px] text-ink-dim leading-relaxed">
          <Sunrise size={13} className="shrink-0 mt-0.5 text-ink-faint" />
          <span>{tip.tomorrow}</span>
        </p>

        {tip.foodNote && (
          <p className="text-[12px] text-ink-faint leading-relaxed pt-0.5">
            {tip.foodNote}
          </p>
        )}
      </div>
    </div>
  )
}
