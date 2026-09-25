"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Refrigerator, X, Sparkles, ArrowRight, RotateCcw } from "lucide-react"

export type FridgeSuggestion = {
  name: string
  uses: string[]
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
  why: string
}

export type FridgeIngredient = {
  item: string
  amount: string
}

type Remaining = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

type Stage = "idle" | "working" | "results" | "error"

type Props = {
  open: boolean
  onClose: () => void
  /** Log the chosen suggestion as a meal (goes through the review card). */
  onLog: (s: FridgeSuggestion) => void
}

const WORKING_COPY = [
  "Peeking inside your fridge…",
  "Tallying today's gaps…",
  "Cooking up ideas…",
]

export default function FridgeSuggest({ open, onClose, onLog }: Props) {
  const [stage, setStage] = useState<Stage>("idle")
  const [workingStep, setWorkingStep] = useState(0)
  const [ingredients, setIngredients] = useState<FridgeIngredient[]>([])
  const [remaining, setRemaining] = useState<Remaining | null>(null)
  const [suggestions, setSuggestions] = useState<FridgeSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fresh state every time the sheet opens.
  useEffect(() => {
    if (open) {
      setStage("idle")
      setWorkingStep(0)
      setIngredients([])
      setRemaining(null)
      setSuggestions([])
      setError(null)
    }
  }, [open ])

  // Rotate the working copy so a slow pass feels alive.
  useEffect(() => {
    if (stage !== "working") return
    const t = setInterval(
      () => setWorkingStep((s) => (s + 1) % WORKING_COPY.length),
      2200
    )
    return () => clearInterval(t)
  }, [stage])

  if (!open) return null

  const handleFile = async (file: File) => {
    setStage("working")
    setWorkingStep(0)
    setError(null)

    try {
      const fileName = `fridge-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
      const { error: uploadError } = await supabase.storage
        .from("meal-photos")
        .upload(fileName, file)
      if (uploadError) throw new Error("Couldn't upload the photo.")

      const { data } = supabase.storage
        .from("meal-photos")
        .getPublicUrl(fileName)

      const res = await fetch("/api/fridge/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: data?.publicUrl || "" }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || "Couldn't read that photo.")
      }

      setIngredients(json.ingredients || [])
      setRemaining(json.remaining || null)
      setSuggestions(json.suggestions || [])
      setStage("results")
    } catch (e: any) {
      setError(e?.message || "Something went wrong — please try again.")
      setStage("error")
    }
  }

  const remainingBits = remaining
    ? [
        remaining.protein > 0 && `${remaining.protein}g protein`,
        remaining.calories > 0 && `${remaining.calories} cal`,
        remaining.carbs > 0 && `${remaining.carbs}g carbs`,
        remaining.fat > 0 && `${remaining.fat}g fat`,
      ].filter(Boolean)
    : []

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="w-full sm:max-w-md bg-surface border border-hair rounded-t-[28px] sm:rounded-[22px] max-h-[88vh] overflow-y-auto relative animate-fade-slide-up">
        {/* CLOSE */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-ink-dim transition-all duration-150 ease-spring hover:bg-white/10 hover:text-ink active:scale-90"
        >
          <X size={16} />
        </button>

        {/* ============ IDLE ============ */}
        {stage === "idle" && (
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-carb to-protein flex items-center justify-center">
              <Refrigerator size={22} className="text-ground" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">What's in your fridge?</h2>
              <p className="text-sm text-ink-dim mt-1">
                Snap the inside of your fridge. I'll spot what's there and
                suggest meals that close today's gaps.
              </p>
            </div>

            <label className="group w-full flex items-center gap-3 bg-surface-2 border border-hair rounded-xl px-4 py-3.5 text-sm font-bold text-ink cursor-pointer transition-all duration-200 ease-spring hover:border-carb/40 active:scale-[0.98]">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-carb to-protein flex items-center justify-center shrink-0 transition-transform duration-300 ease-spring group-active:rotate-12">
                <Refrigerator size={15} className="text-ground" />
              </span>
              <span>
                <span className="block">Snap your fridge</span>
                <span className="block text-xs font-normal text-ink-faint mt-0.5">
                  Rear camera works best — get the shelves in frame
                </span>
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0])
                  e.target.value = ""
                }}
              />
            </label>
          </div>
        )}

        {/* ============ WORKING ============ */}
        {stage === "working" && (
          <div className="p-6 py-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-white/10 border border-white/10 backdrop-blur flex items-center justify-center">
              <Sparkles size={20} className="text-ink animate-pulse-soft" />
            </div>
            <p className="text-sm text-ink font-medium animate-fade-in" key={workingStep}>
              {WORKING_COPY[workingStep]}
            </p>
          </div>
        )}

        {/* ============ ERROR ============ */}
        {stage === "error" && (
          <div className="p-6 space-y-4 text-center">
            <h2 className="text-lg font-bold text-ink">Couldn't read that photo</h2>
            <p className="text-sm text-ink-dim">{error}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setStage("idle")}
                className="flex-1 py-2.5 rounded-xl bg-ink text-ground text-sm font-bold transition-all duration-150 ease-spring hover:bg-ink/90 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} /> Try another photo
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-surface-2 text-ink text-sm transition-all duration-150 ease-spring hover:bg-white/10 active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ============ RESULTS ============ */}
        {stage === "results" && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-ink pr-8">Here's what I'd make</h2>
              {remainingBits.length > 0 && (
                <p className="text-xs text-ink-faint mt-1">
                  Still open today:{" "}
                  <span className="text-ink-dim font-semibold">
                    {remainingBits.join(" · ")}
                  </span>
                </p>
              )}
            </div>

            {/* Spotted ingredients */}
            {ingredients.length > 0 && (
              <div>
                <p className="text-xs text-ink-faint mb-2">
                  Spotted in your fridge
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ingredients.map((ing, i) => (
                    <span
                      key={i}
                      className="bg-surface-2 px-2 py-[3px] rounded-full text-[11px] text-ink-dim"
                    >
                      {ing.item}
                      {ing.amount ? (
                        <span className="text-ink-faint"> · {ing.amount}</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            <div className="space-y-3">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="bg-ground border border-hair rounded-2xl p-4 space-y-2.5 animate-fade-slide-up"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div>
                    <h3 className="text-sm font-bold text-ink">{s.name}</h3>
                    {s.why ? (
                      <p className="text-xs text-protein font-medium mt-0.5">
                        {s.why}
                      </p>
                    ) : null}
                  </div>

                  {s.description ? (
                    <p className="text-xs text-ink-dim leading-relaxed">
                      {s.description}
                    </p>
                  ) : null}

                  {s.uses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {s.uses.map((u, j) => (
                        <span
                          key={j}
                          className="bg-surface-2 px-2 py-[3px] rounded-full text-[11px] text-ink-dim"
                        >
                          {u}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between text-[11px] font-semibold tabular-nums pt-2 border-t border-hair">
                    <span className="text-cal">{s.calories} cal</span>
                    <span className="text-protein">{s.protein} p</span>
                    <span className="text-carb">{s.carbs} c</span>
                    <span className="text-fat">{s.fat} f</span>
                  </div>

                  <button
                    onClick={() => onLog(s)}
                    className="w-full py-2.5 rounded-xl bg-ink text-ground text-sm font-bold transition-all duration-150 ease-spring hover:bg-ink/90 active:scale-[0.98] flex items-center justify-center gap-1.5"
                  >
                    Log this meal <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-ink-faint text-center">
              Macros are estimates — you'll confirm everything on the review
              step before saving.
            </p>

            <button
              onClick={() => setStage("idle")}
              className="w-full py-2.5 rounded-xl bg-surface-2 text-ink text-sm transition-all duration-150 ease-spring hover:bg-white/10 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <RotateCcw size={14} /> Scan again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
