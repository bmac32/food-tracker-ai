"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import UserInfo from "@/components/UserInfo"

type Props = {
  refreshTrigger?: number
  currentDate: Date
  setCurrentDate: (date: Date) => void
  scrollProgress?: number
}

type Meal = {
  id?: number
  created_at?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  [key: string]: any
}

const CIRCUMFERENCE = 2 * Math.PI * 34

const RING_COLOR: Record<string, string> = {
  calories: "var(--color-cal)",
  protein: "var(--color-protein)",
  carbs: "var(--color-carb)",
  fat: "var(--color-fat)",
}

function getMessage(type: string, total: number, goal: number) {
  const diff = goal - total

  if (diff > 0) {
    if (type === "calories") return `${diff} cal left`
    return `${diff}g left`
  }

  if (type === "protein") return "On track"
  if (type === "calories") return `+${Math.abs(diff)} over`
  return "Slightly high"
}

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (reduced) {
      setValue(target)
      return
    }

    let raf: number
    let start: number | null = null

    function step(ts: number) {
      if (start === null) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

function Ring({
  label,
  value,
  goal,
  progress,
  type,
  detailOpacity = 1,
}: {
  label: string
  value: number
  goal: number
  progress: number
  type: string
  detailOpacity?: number
}) {
  const capped = Math.min(progress, 1)
  const color = RING_COLOR[type] || "var(--color-ink)"
  const displayPct = useCountUp(Math.round(capped * 100))

  return (
    <div className="flex flex-col items-center transition-transform duration-200 ease-spring active:scale-95">
      <div className="relative w-20 h-20">
        {/* Soft ambient glow — a blurred HTML div behind the ring, not an
            SVG filter. SVG filter regions default to a tight bounding box
            (110% of the element) and clip wide drop-shadows, which made
            the glow look hard-edged/cut off instead of smooth. */}
        <div
          className="absolute inset-[-6px] rounded-full blur-lg opacity-40 pointer-events-none"
          style={{ background: color }}
        />

        <svg className="relative w-full h-full -rotate-90">
          <circle cx="50%" cy="50%" r="34" stroke="var(--color-hair-strong)" strokeWidth="7" fill="none" />
          <circle
            cx="50%"
            cy="50%"
            r="34"
            stroke={color}
            strokeWidth="7"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE - capped * CIRCUMFERENCE}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center text-base font-extrabold tabular-nums text-ink">
          {displayPct}%
        </div>
      </div>

      <p className="text-xs mt-2 font-bold tracking-wide text-ink">{label}</p>
      <p
        className="text-[11px] text-ink-faint overflow-hidden"
        style={{
          opacity: detailOpacity,
          maxHeight: detailOpacity > 0 ? "1.2em" : "0",
        }}
      >
        {getMessage(type, value, goal)}
      </p>
    </div>
  )
}

export default function DailySummary(props: Props) {
  const { refreshTrigger, currentDate, setCurrentDate } = props
  const scrollProgress = props.scrollProgress ?? 0

  // Derived, continuously-interpolated collapse values (no hard snap).
  const ringScale = 1 - scrollProgress * 0.3 // 1 -> 0.7
  // Secondary "X left" detail line fades out over the first 60% of the
  // scroll range so the compact state only shows the essentials (ring +
  // label), matching how iOS large titles drop their subtitle first.
  const detailOpacity = Math.max(0, 1 - scrollProgress / 0.6)
  const ringsMarginTop = 8 - scrollProgress * 6 // 8px -> 2px
  const ringsPaddingBottom = 16 - scrollProgress * 10 // 16px -> 6px
  const [meals, setMeals] = useState<Meal[]>([])
  const [workouts, setWorkouts] = useState<{ calories_burned?: number }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [goals, setGoals] = useState({
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 70,
  })

  // 🔥 Animated ring state
  const [animatedProgress, setAnimatedProgress] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  })

  const [weight, setWeight] = useState("")
  const [goalType, setGoalType] = useState("maintain")

  const [isGenerating, setIsGenerating] = useState(false)

  // -------------------------
  // LOAD GOALS
  // -------------------------
  async function loadGoals() {
    const { data, error } = await supabase
      .from("user_goals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)

    if (error) {
      console.error("GOALS LOAD ERROR:", error)
      return
    }

    if (data && data.length > 0) {
      const latest = data[0]
      setGoals({
        calories: latest.calories,
        protein: latest.protein,
        carbs: latest.carbs,
        fat: latest.fat,
      })
    }
  }

  // -------------------------
  // LOAD MEALS
  // -------------------------
  async function loadMeals() {
    const start = new Date(currentDate)
    start.setHours(0, 0, 0, 0)

    const end = new Date(currentDate)
    end.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from("meals")
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())

    if (error) {
      console.error("MEALS LOAD ERROR:", error)
      return
    }

    setMeals((data as Meal[]) || [])
  }

  // -------------------------
  // LOAD WORKOUTS
  // -------------------------
  async function loadWorkouts() {
    const start = new Date(currentDate)
    start.setHours(0, 0, 0, 0)

    const end = new Date(currentDate)
    end.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from("workouts")
      .select("calories_burned")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())

    if (error) {
      console.error("WORKOUTS LOAD ERROR:", error)
      return
    }

    setWorkouts(data || [])
  }

  useEffect(() => {
    loadMeals()
    loadWorkouts()
    loadGoals()
  }, [refreshTrigger, currentDate])

  // -------------------------
  // TOTALS
  // -------------------------
 const totals = meals.reduce(
  (acc: { calories: number; protein: number; carbs: number; fat: number }, meal) => {
    const ai =
      typeof meal.ai_analysis === "string"
        ? JSON.parse(meal.ai_analysis)
        : meal.ai_analysis

    acc.calories += Number(ai?.calories) || 0
    acc.protein += Number(ai?.protein) || 0
    acc.carbs += Number(ai?.carbs) || 0
    acc.fat += Number(ai?.fat) || 0
    return acc
  },
  { calories: 0, protein: 0, carbs: 0, fat: 0 }
)

  const caloriesBurned = workouts.reduce(
    (sum, w) => sum + (Number(w.calories_burned) || 0),
    0
  )

  const netCalories = Math.max(0, totals.calories - caloriesBurned)

  const progress = {
  calories: goals.calories
    ? Math.min(netCalories / goals.calories, 1)
    : 0,
  protein: goals.protein
    ? Math.min(totals.protein / goals.protein, 1)
    : 0,
  carbs: goals.carbs
    ? Math.min(totals.carbs / goals.carbs, 1)
    : 0,
  fat: goals.fat
    ? Math.min(totals.fat / goals.fat, 1)
    : 0,
}

  // 🔥 ADD RIGHT HERE
  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimatedProgress({
        calories: progress.calories,
        protein: progress.protein,
        carbs: progress.carbs,
        fat: progress.fat,
      })
    }, 200)

    return () => clearTimeout(timeout)
  }, [progress])

  const changeDay = (dir: "prev" | "next") => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (dir === "prev" ? -1 : 1))
    setCurrentDate(newDate)
  }

  // -------------------------
  // 🔥 FIXED GENERATE
  // -------------------------
  const handleGenerate = () => {
    const w = parseFloat(weight)

    if (!w || isNaN(w)) {
      console.warn("Invalid weight")
      return
    }

    setIsGenerating(true)

    let calories = w * 14

    if (goalType === "lose") calories -= 400
    if (goalType === "gain") calories += 300

    calories = Math.round(calories)

    const protein = Math.round(w * 0.8)
    const fat = Math.round((calories * 0.25) / 9)
    const carbs = Math.round(
      (calories - protein * 4 - fat * 9) / 4
    )

    setGoals({
      calories,
      protein,
      carbs,
      fat,
    })

    setTimeout(() => setIsGenerating(false), 300)
  }

  // -------------------------
  // SAVE GOALS
  // -------------------------
  const saveGoals = async () => {
    setSaving(true)

    try {
      const { error } = await supabase
        .from("user_goals")
        .insert([goals])

      if (error) {
        console.error("SAVE ERROR:", error)
        return
      }

      await loadGoals()

      setTimeout(() => {
        setSaving(false)
        setShowModal(false)
      }, 600)
    } catch (err) {
      console.error(err)
      setSaving(false)
    }
  }

  return (
    <>
        <div className="sticky top-0 z-40 bg-ground/95 backdrop-blur-md border-b border-hair">

        <div className="relative z-20 flex items-center justify-between max-w-md mx-auto px-5 pt-1">

          {/* LEFT: BRAND (tap to edit goals) */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 pl-1 text-ink-faint hover:text-ink active:scale-95 transition-transform duration-150 ease-spring"
          >
            <span className="live-dot" />
            <span className="text-xs font-extrabold tracking-[0.14em] uppercase">
              Goals
            </span>
          </button>

          {/* CENTER: DATE (absolutely centered so it's unaffected by the
              unequal widths of Edit vs the profile avatar) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 whitespace-nowrap">
            <button
              onClick={() => changeDay("prev")}
              className="text-ink-faint hover:text-ink active:scale-90 transition-transform duration-150 ease-spring"
            >
              ‹
            </button>

            <span className="text-base font-semibold tracking-tight text-ink">
              {currentDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>

            <button
              onClick={() => changeDay("next")}
              className="text-ink-faint hover:text-ink active:scale-90 transition-transform duration-150 ease-spring"
            >
              ›
            </button>
          </div>

          {/* RIGHT: PROFILE */}
          <div className="relative z-20">
            <UserInfo />
          </div>
        </div>

        {/* 🔵 RINGS (NO CARD) */}
       <div
         className="relative z-0 overflow-hidden"
         style={{
           marginTop: `${ringsMarginTop}px`,
           paddingBottom: `${ringsPaddingBottom}px`,
         }}
       >
        {/* AURORA — ambient glow tied to the same ring colors, the
            signature "premium" moment behind the daily summary */}
        <div className="absolute -top-10 left-0 right-0 h-[140px] pointer-events-none blur-[38px] opacity-40">
          <div className="absolute w-28 h-28 rounded-full bg-cal top-0 left-[8%] animate-aurora-1" />
          <div className="absolute w-28 h-28 rounded-full bg-protein top-5 left-[55%] animate-aurora-2" />
          <div className="absolute w-28 h-28 rounded-full bg-carb top-8 left-[30%] animate-aurora-3" />
          <div className="absolute w-28 h-28 rounded-full bg-fat top-2 left-[68%] animate-aurora-1-reverse" />
        </div>

        <div
          className="relative grid grid-cols-4 gap-2 justify-items-center"
          style={{
            transform: `scale(${ringScale})`,
            transformOrigin: "top center",
          }}
        >

          <Ring
            label="Cal"
            value={netCalories}
            goal={goals.calories}
            progress={animatedProgress.calories}
            type="calories"
            detailOpacity={detailOpacity}
          />
          <Ring
            label="Protein"
            value={totals.protein}
            goal={goals.protein}
            progress={animatedProgress.protein}
            type="protein"
            detailOpacity={detailOpacity}
          />
          <Ring
            label="Carbs"
            value={totals.carbs}
            goal={goals.carbs}
            progress={animatedProgress.carbs}
            type="carbs"
            detailOpacity={detailOpacity}
          />
          <Ring
            label="Fat"
            value={totals.fat}
            goal={goals.fat}
            progress={animatedProgress.fat}
            type="fat"
            detailOpacity={detailOpacity}
          />
        </div>
      </div>
    </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-surface border border-hair rounded-2xl p-6 w-[90%] max-w-sm space-y-4 animate-fade-scale-in">

            <h2 className="text-lg font-semibold text-ink">Edit Goals</h2>

            <input
              type="number"
              placeholder="Current weight (lbs)"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-transparent border border-hair-strong rounded-lg px-3 py-2 outline-none transition focus:border-ink/40 text-ink"
            />

            <div className="flex gap-2">
              {["lose", "maintain", "gain"].map((type) => {
                const label =
                  type === "lose"
                    ? "~0.5–1 lb/week"
                    : type === "gain"
                    ? "~0.25–0.5 lb/week"
                    : "Maintain weight"

                return (
                  <div key={type} className="flex-1 flex flex-col items-center">
                    <button
                      onClick={() => setGoalType(type)}
                      className={`w-full py-2 rounded-lg capitalize transition-all duration-150 ease-spring active:scale-[0.97] ${
                        goalType === type
                          ? "bg-ink text-ground hover:bg-ink/90"
                          : "border border-hair-strong text-ink hover:border-ink-faint hover:bg-surface-2"
                      }`}
                    >
                      {type}
                    </button>

                    <p className="text-[10px] text-ink-faint mt-1 text-center">
                      {label}
                    </p>
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleGenerate}
              disabled={!weight || isNaN(parseFloat(weight))}
              className={`w-full py-2 rounded-lg transition-all duration-200 ease-spring active:scale-[0.98] ${
                !weight || isNaN(parseFloat(weight))
                  ? "bg-surface-2 text-ink-faint cursor-not-allowed"
                  : "bg-ink text-ground hover:bg-ink/90"
              }`}
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>

            {/* ✨ TRUST */}
            <p className="text-xs text-ink-faint text-center">
              Based on general nutrition guidance (CDC, dietitian standards)
            </p>

            {/* MANUAL EDIT */}
            <div className="grid grid-cols-2 gap-3">

              {/* Calories */}
              <div className="space-y-1">
                <p className="text-[11px] text-ink-faint">Calories</p>
                <input
                  value={goals.calories}
                  onChange={(e) =>
                    setGoals({ ...goals, calories: Number(e.target.value) })
                  }
                  className="w-full bg-ground border border-hair-strong rounded-lg px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40"
                />
              </div>

              {/* Protein */}
              <div className="space-y-1">
                <p className="text-[11px] text-ink-faint">Protein (g)</p>
                <input
                  value={goals.protein}
                  onChange={(e) =>
                    setGoals({ ...goals, protein: Number(e.target.value) })
                  }
                  className="w-full bg-ground border border-hair-strong rounded-lg px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40"
                />
              </div>

              {/* Carbs */}
              <div className="space-y-1">
                <p className="text-[11px] text-ink-faint">Carbs (g)</p>
                <input
                  value={goals.carbs}
                  onChange={(e) =>
                    setGoals({ ...goals, carbs: Number(e.target.value) })
                  }
                  className="w-full bg-ground border border-hair-strong rounded-lg px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40"
                />
              </div>

              {/* Fat */}
              <div className="space-y-1">
                <p className="text-[11px] text-ink-faint">Fat (g)</p>
                <input
                  value={goals.fat}
                  onChange={(e) =>
                    setGoals({ ...goals, fat: Number(e.target.value) })
                  }
                  className="w-full bg-ground border border-hair-strong rounded-lg px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40"
                />
              </div>

            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-hair-strong text-ink rounded-lg py-2 transition-all duration-150 ease-spring hover:border-ink-faint hover:bg-surface-2 active:scale-[0.98]"
              >
                Cancel
              </button>

              <button
                onClick={saveGoals}
                disabled={saving}
                className={`flex-1 rounded-lg py-2 transition-all duration-200 ease-spring active:scale-[0.98] ${
                  saving
                    ? "bg-surface-2 text-ink-faint cursor-not-allowed"
                    : "bg-ink text-ground hover:bg-ink/90"
                }`}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
