"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import UserInfo from "@/components/UserInfo"

type Props = {
  refreshTrigger?: number
  currentDate: Date
  setCurrentDate: (date: Date) => void
  isCollapsed?: boolean
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

export default function DailySummary(props: Props) {
  const { refreshTrigger, currentDate, setCurrentDate, isCollapsed } = props
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

  const circumference = 2 * Math.PI * 36

  // -------------------------
  // COLORS
  // -------------------------
  const getColor = (type: string) => {
    if (type === "protein") return "#6FCF97"
    if (type === "calories") return "#E9B949"
    if (type === "carbs") return "#5FA8D3"
    if (type === "fat") return "#9B8AFB"
    return "#E6E8EC"
  }

  // -------------------------
  // MICROCOPY
  // -------------------------
  const getMessage = (type: string, total: number, goal: number) => {
    const diff = goal - total

    if (diff > 0) {
      if (type === "calories") return `${diff} cal left`
      return `${diff}g left`
    }

    if (type === "protein") return "On track"
    if (type === "calories") return `+${Math.abs(diff)} over`
    return "Slightly high"
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
const changeDay = (dir: "prev" | "next") => {
  const newDate = new Date(currentDate)
  newDate.setDate(currentDate.getDate() + (dir === "prev" ? -1 : 1))
  setCurrentDate(newDate)
}

  // -------------------------
  // RING
  // -------------------------
  const Ring = ({ label, value, goal, progress, type }: any) => {
    const capped = Math.min(progress, 1)
    const color = getColor(type)

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-20 h-20">
          <div
            className="absolute inset-0 rounded-full blur-[6px] opacity-20"
            style={{ background: color }}
          />

          <svg className="w-full h-full -rotate-90">
            <circle cx="50%" cy="50%" r="36" stroke="#232734" strokeWidth="8" fill="none" />
            <circle
              cx="50%"
              cy="50%"
              r="36"
              stroke={color}
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - capped * circumference}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-white">
            {Math.round(progress * 100)}%
          </div>
        </div>

        <p className="text-xs mt-2 font-semibold">{label}</p>
        <p className="text-[11px] text-[#9AA3B2]">
          {getMessage(type, value, goal)}
        </p>
      </div>
    )
  }

  return (
    <>
        <div
            className={`fixed top-0 left-0 right-0 z-40 bg-[#0F1115]/95 backdrop-blur-md border-b border-[#232734]/60 transition-all duration-300 ${
            isCollapsed ? "space-y-2" : "space-y-4"
          }`}
        >        

        <div className="relative z-20 flex items-center justify-between max-w-md mx-auto px-5">
  
          {/* LEFT: EDIT */}
          <button
            onClick={() => setShowModal(true)}
            className="text-xs text-[#6B7280] hover:text-white active:scale-95 transition pl-1"
          >
            {goals?.calories ? "Edit" : "Set"}
          </button>

          {/* CENTER: DATE */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeDay("prev")}
              className="text-[#6B7280] hover:text-white active:scale-90 transition"
            >
              ‹
            </button>

            <span className="text-base font-medium tracking-tight text-white">
              {currentDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>

            <button
              onClick={() => changeDay("next")}
              className="text-[#6B7280] hover:text-white active:scale-90 transition"
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
       <div className="relative z-0 overflow-hidden mt-2">
        <div
          className={`grid grid-cols-4 gap-2 justify-items-center transition-all duration-300 ${
            isCollapsed ? "scale-75 opacity-80" : "scale-100"
          }`}
        >
          
          <Ring
            label="Cal"
            value={netCalories}
            goal={goals.calories}
            progress={animatedProgress.calories}
            type="calories"
          />
          <Ring
            label="Protein"
            value={totals.protein}
            goal={goals.protein}
            progress={animatedProgress.protein}
            type="protein"
          />
          <Ring
            label="Carbs"
            value={totals.carbs}
            goal={goals.carbs}
            progress={animatedProgress.carbs}
            type="carbs"
          />
          <Ring
            label="Fat"
            value={totals.fat}
            goal={goals.fat}
            progress={animatedProgress.fat}
            type="fat"
          />
        </div>

        {caloriesBurned > 0 && (
          <p className="text-center text-[11px] text-orange-300 mt-2 animate-fade-in">
            🔥 {caloriesBurned} cal burned today — nice work!
          </p>
        )}
      </div>
    </div> {/* CLOSE space-y-4 */}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-[#171A21] border border-[#232734] rounded-2xl p-6 w-[90%] max-w-sm space-y-4 animate-fade-scale-in">

            <h2 className="text-lg font-semibold">Edit Goals</h2>

            <input
              type="number"
              placeholder="Current weight (lbs)"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-transparent border border-[#232734] rounded-lg px-3 py-2 outline-none transition focus:border-white/40"
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
                      className={`w-full py-2 rounded-lg capitalize transition-all duration-150 active:scale-[0.97] ${
                        goalType === type
                          ? "bg-white text-black hover:bg-white/90"
                          : "border border-[#232734] hover:border-[#3a4152] hover:bg-[#1b1f28]"
                      }`}
                    >
                      {type}
                    </button>

                    <p className="text-[10px] text-[#6B7280] mt-1 text-center">
                      {label}
                    </p>
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleGenerate}
              disabled={!weight || isNaN(parseFloat(weight))}
              className={`w-full py-2 rounded-lg transition-all duration-200 active:scale-[0.98] ${
                !weight || isNaN(parseFloat(weight))
                  ? "bg-[#232734] text-[#6B7280] cursor-not-allowed"
                  : "bg-white text-black hover:bg-white/90"
              }`}
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>

            {/* ✨ TRUST */}
            <p className="text-xs text-[#9AA3AF] text-center">
              Based on general nutrition guidance (CDC, dietitian standards)
            </p>

            {/* MANUAL EDIT */}
            <div className="grid grid-cols-2 gap-3">

              {/* Calories */}
              <div className="space-y-1">
                <p className="text-[11px] text-[#9AA3B2]">Calories</p>
                <input
                  value={goals.calories}
                  onChange={(e) =>
                    setGoals({ ...goals, calories: Number(e.target.value) })
                  }
                  className="w-full bg-[#0F1115] border border-[#232734] rounded-lg px-3 py-2 text-sm outline-none transition focus:border-white/40"
                />
              </div>

              {/* Protein */}
              <div className="space-y-1">
                <p className="text-[11px] text-[#9AA3B2]">Protein (g)</p>
                <input
                  value={goals.protein}
                  onChange={(e) =>
                    setGoals({ ...goals, protein: Number(e.target.value) })
                  }
                  className="w-full bg-[#0F1115] border border-[#232734] rounded-lg px-3 py-2 text-sm outline-none transition focus:border-white/40"
                />
              </div>

              {/* Carbs */}
              <div className="space-y-1">
                <p className="text-[11px] text-[#9AA3B2]">Carbs (g)</p>
                <input
                  value={goals.carbs}
                  onChange={(e) =>
                    setGoals({ ...goals, carbs: Number(e.target.value) })
                  }
                  className="w-full bg-[#0F1115] border border-[#232734] rounded-lg px-3 py-2 text-sm outline-none transition focus:border-white/40"
                />
              </div>

              {/* Fat */}
              <div className="space-y-1">
                <p className="text-[11px] text-[#9AA3B2]">Fat (g)</p>
                <input
                  value={goals.fat}
                  onChange={(e) =>
                    setGoals({ ...goals, fat: Number(e.target.value) })
                  }
                  className="w-full bg-[#0F1115] border border-[#232734] rounded-lg px-3 py-2 text-sm outline-none transition focus:border-white/40"
                />
              </div>

            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-[#232734] rounded-lg py-2 transition-all duration-150 hover:border-[#3a4152] hover:bg-[#1b1f28] active:scale-[0.98]"
              >
                Cancel
              </button>

              <button
                onClick={saveGoals}
                disabled={saving}
                className={`flex-1 rounded-lg py-2 transition-all duration-200 active:scale-[0.98] ${
                  saving
                    ? "bg-[#232734] text-[#6B7280] cursor-not-allowed"
                    : "bg-white text-black hover:bg-white/90"
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