"use client"

import { useEffect, useState } from "react"
import { X, Trophy, CheckCircle2, AlertCircle, ArrowRight, RotateCcw } from "lucide-react"

type Gap = { gap: string; why: string; fix: string }
type Review = {
  headline: string
  grade: string
  wins: string[]
  gaps: Gap[]
  next_week: string[]
}
type Stats = {
  days_analyzed: number
  days_with_meals: number
  avg_calories: number
  avg_protein: number
  avg_carbs: number
  avg_fat: number
  protein_goal_hit_days: number
  fat_over_days: number
  total_workouts: number
  workout_days: number
}

type Stage = "loading" | "results" | "error"

type Props = {
  open: boolean
  onClose: () => void
}

const LOADING_COPY = [
  "Pulling your last 7 days…",
  "Checking protein consistency…",
  "Looking at the fat pattern…",
  "Your coach is writing this up…",
]

export default function CoachReview({ open, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("loading")
  const [step, setStep] = useState(0)
  const [review, setReview] = useState<Review | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [goals, setGoals] = useState<{ protein: number; fat: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchReview = async () => {
    setStage("loading")
    setStep(0)
    setError(null)
    try {
      const res = await fetch("/api/coach/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7 }),
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
    const t = setInterval(() => setStep((s) => (s + 1) % LOADING_COPY.length), 2000)
    return () => clearInterval(t)
  }, [stage])

  if (!open) return null

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
          <div className="p-6 py-14 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-burn to-burn-2 flex items-center justify-center">
              <Trophy size={20} className="text-ground animate-pulse-soft" />
            </div>
            <p className="text-sm text-ink font-medium animate-fade-in" key={step}>
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
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-3 pr-8">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-burn to-burn-2 flex items-center justify-center shrink-0">
                <Trophy size={20} className="text-ground" />
              </div>
              <div>
                <p className="text-xs text-ink-faint">Coach review · last {stats?.days_analyzed ?? 7} days</p>
                <h2 className="text-base font-bold text-ink mt-0.5">{review.headline}</h2>
              </div>
              <span className="ml-auto text-2xl font-black text-ink tabular-nums">{review.grade}</span>
            </div>

            {/* Stat strip */}
            {stats && goals && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-ground border border-hair rounded-xl py-2.5 px-1">
                  <p className="text-sm font-black text-protein tabular-nums">{stats.avg_protein}g</p>
                  <p className="text-[10px] text-ink-faint mt-0.5">avg protein</p>
                </div>
                <div className="bg-ground border border-hair rounded-xl py-2.5 px-1">
                  <p className="text-sm font-black text-fat tabular-nums">{stats.fat_over_days}/{stats.days_with_meals}</p>
                  <p className="text-[10px] text-ink-faint mt-0.5">days over fat</p>
                </div>
                <div className="bg-ground border border-hair rounded-xl py-2.5 px-1">
                  <p className="text-sm font-black text-burn tabular-nums">{stats.total_workouts}</p>
                  <p className="text-[10px] text-ink-faint mt-0.5">workouts</p>
                </div>
              </div>
            )}

            {/* Wins */}
            {review.wins.length > 0 && (
              <div>
                <p className="text-xs font-bold text-ink-faint uppercase tracking-wide mb-2">Doing well</p>
                <div className="space-y-1.5">
                  {review.wins.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-ink-dim">
                      <CheckCircle2 size={15} className="text-protein shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gaps — what you're missing */}
            {review.gaps.length > 0 && (
              <div>
                <p className="text-xs font-bold text-ink-faint uppercase tracking-wide mb-2">What you're missing</p>
                <div className="space-y-2.5">
                  {review.gaps.map((gp, i) => (
                    <div
                      key={i}
                      className="bg-ground border border-hair rounded-2xl p-4 space-y-1.5 animate-fade-slide-up"
                      style={{ animationDelay: `${i * 90}ms` }}
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle size={15} className="text-cal shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-ink">{gp.gap}</p>
                      </div>
                      {gp.why ? <p className="text-xs text-ink-dim pl-6">{gp.why}</p> : null}
                      {gp.fix ? (
                        <p className="text-xs text-ink pl-6">
                          <span className="font-bold text-protein">Fix: </span>{gp.fix}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next week */}
            {review.next_week.length > 0 && (
              <div>
                <p className="text-xs font-bold text-ink-faint uppercase tracking-wide mb-2">Next week</p>
                <div className="space-y-1.5">
                  {review.next_week.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-ink-dim bg-surface-2 rounded-xl px-3 py-2.5">
                      <ArrowRight size={14} className="text-ink-faint shrink-0 mt-0.5" />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-ink-faint text-center">
              Based on your logged meals and workouts — the more days you log, the sharper this gets.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
