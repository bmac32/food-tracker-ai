"use client"

import { useEffect, useState } from "react"
import { X, Check, Lightbulb, ArrowRight, RotateCcw, Loader2 } from "lucide-react"

type Idea = { idea: string; why: string; try: string }
type Review = {
  headline: string
  highlights: string[]
  ideas: Idea[]
  next_steps: string[]
}
type Stats = {
  days_with_meals: number
  avg_calories: number
  avg_protein: number
  avg_carbs: number
  avg_fat: number
  avg_meals_per_day: number
  total_workouts: number
  workout_days: number
}

type Stage = "loading" | "results" | "error"

type Props = {
  open: boolean
  onClose: () => void
}

const LOADING_COPY = [
  "Looking at your meals…",
  "Putting it together…",
]

export default function CoachReview({ open, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("loading")
  const [step, setStep] = useState(0)
  const [review, setReview] = useState<Review | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [goals, setGoals] = useState<{ protein: number; calories: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchReview = async () => {
    setStage("loading")
    setStep(0)
    setError(null)
    try {
      const res = await fetch("/api/coach/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || "Review failed.")
      setReview(json.review)
      setStats(json.stats)
      setGoals(json.goals)
      setStage("results")
    } catch (e: any) {
      setError(e?.message || "Something went wrong — please try again.")
      setStage("error")
    }
  }

  useEffect(() => {
    if (open) fetchReview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ])

  useEffect(() => {
    if (stage !== "loading") return
    const t = setInterval(() => setStep((s) => (s + 1) % LOADING_COPY.length), 2200)
    return () => clearInterval(t)
  }, [stage])

  if (!open) return null

  const scopeLabel =
    stats == null || stats.days_with_meals <= 1
      ? "Day review"
      : `${stats.days_with_meals}-day review`

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="w-full sm:max-w-md bg-surface border border-hair rounded-t-[28px] sm:rounded-[22px] max-h-[88vh] overflow-y-auto relative animate-fade-slide-up">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-ink-dim transition-all duration-150 ease-spring hover:bg-white/10 hover:text-ink active:scale-90"
        >
          <X size={16} />
        </button>

        {/* ============ LOADING ============ */}
        {stage === "loading" && (
          <div className="p-6 py-16 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 size={22} className="text-ink-faint animate-spin" />
            <p className="text-sm text-ink-dim animate-fade-in" key={step}>
              {LOADING_COPY[step]}
            </p>
          </div>
        )}

        {/* ============ ERROR ============ */}
        {stage === "error" && (
          <div className="p-6 space-y-4 text-center">
            <h2 className="text-lg font-bold text-ink">No review yet</h2>
            <p className="text-sm text-ink-dim">{error}</p>
            <div className="flex gap-2">
              <button
                onClick={fetchReview}
                className="flex-1 py-2.5 rounded-xl bg-ink text-ground text-sm font-bold transition-all duration-150 ease-spring hover:bg-ink/90 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} /> Try again
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-surface-2 text-ink text-sm transition-all duration-150 ease-spring hover:bg-white/10 active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ============ RESULTS ============ */}
        {stage === "results" && review && (
          <div className="p-6 space-y-6">
            {/* Header — calm, no grades, no trophies */}
            <div className="pr-8">
              <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.14em]">
                {scopeLabel}
              </p>
              <h2 className="text-xl font-bold text-ink tracking-tight mt-1.5 leading-snug">
                {review.headline}
              </h2>
            </div>

            {/* Stat strip — neutral facts only */}
            {stats && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-ground border border-hair rounded-2xl py-3 px-1">
                  <p className="text-base font-bold text-ink tabular-nums">
                    {stats.avg_protein}<span className="text-xs font-semibold text-ink-faint">g</span>
                  </p>
                  <p className="text-[10px] text-ink-faint mt-0.5">avg protein{goals ? ` / ${goals.protein}g` : ""}</p>
                </div>
                <div className="bg-ground border border-hair rounded-2xl py-3 px-1">
                  <p className="text-base font-bold text-ink tabular-nums">{stats.avg_meals_per_day}</p>
                  <p className="text-[10px] text-ink-faint mt-0.5">meals / day</p>
                </div>
                <div className="bg-ground border border-hair rounded-2xl py-3 px-1">
                  <p className="text-base font-bold text-ink tabular-nums">{stats.total_workouts}</p>
                  <p className="text-[10px] text-ink-faint mt-0.5">workouts</p>
                </div>
              </div>
            )}

            {/* Highlights */}
            {review.highlights.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink-faint uppercase tracking-[0.12em] mb-2.5">
                  Highlights
                </p>
                <div className="space-y-2">
                  {review.highlights.map((w, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm text-ink-dim">
                      <span className="w-5 h-5 rounded-full bg-protein/15 flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={12} className="text-protein" />
                      </span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ideas — additive, never shaming */}
            {review.ideas.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink-faint uppercase tracking-[0.12em] mb-2.5">
                  Ideas to try
                </p>
                <div className="space-y-2.5">
                  {review.ideas.map((it, i) => (
                    <div
                      key={i}
                      className="bg-ground border border-hair rounded-2xl p-4 space-y-1.5 animate-fade-slide-up"
                      style={{ animationDelay: `${i * 90}ms` }}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-cal/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Lightbulb size={12} className="text-cal" />
                        </span>
                        <p className="text-sm font-semibold text-ink">{it.idea}</p>
                      </div>
                      {it.why ? <p className="text-xs text-ink-dim pl-[30px]">{it.why}</p> : null}
                      {it.try ? (
                        <p className="text-xs text-ink pl-[30px]">
                          <span className="font-semibold">Try: </span>{it.try}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next steps */}
            {review.next_steps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink-faint uppercase tracking-[0.12em] mb-2.5">
                  Next steps
                </p>
                <div className="space-y-1.5">
                  {review.next_steps.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm text-ink-dim bg-surface-2 rounded-xl px-3.5 py-3">
                      <ArrowRight size={14} className="text-ink-faint shrink-0 mt-0.5" />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-ink-faint text-center">
              Based on what you&apos;ve logged so far.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
