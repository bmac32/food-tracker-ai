"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../lib/supabase"
import { getSmartFoodImage } from "@/lib/getSmartFoodImage"

import { Sparkles, Dumbbell } from "lucide-react"

import Upload from "@/components/Upload"
import DailySummary from "@/components/DailySummary"
import MealFeed from "@/components/MealFeed"
import MealReviewCard from "@/components/MealReviewCard"
import UserInfo from "@/components/UserInfo"
import WorkoutLogger from "@/components/WorkoutLogger"

type Analysis = {
  meal_name: string
  foods: string[]
  calories: number | string
  protein: number | string
  carbs: number | string
  fat: number | string
}

// 🔥 Prompt helper (unchanged)
const improvePrompt = (text: string) => {
  const lower = text.toLowerCase()

  if (lower.includes("celery") && lower.includes("ranch")) {
    return "celery sticks with ranch dip"
  }

  if (lower.includes("cheese") && lower.includes("cracker")) {
    return "cheese and crackers"
  }

  if (lower.includes("oatmeal") || lower.includes("oats")) {
    return "oatmeal bowl"
  }

  return text
}

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  const [note, setNote] = useState("")
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const [refreshFeed, setRefreshFeed] = useState(0)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [optimisticMeals, setOptimisticMeals] = useState<any[]>([])

  const [textInputMode, setTextInputMode] = useState(false)
  const [mealText, setMealText] = useState("")

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [workoutLoggerOpen, setWorkoutLoggerOpen] = useState(false)
  const [mealChooserOpen, setMealChooserOpen] = useState(false)

  // Continuous 0→1 scroll progress (not a hard threshold) so the header
  // collapses in lockstep with the scroll, like iOS's large-title behavior,
  // instead of snapping at a fixed pixel breakpoint.
  useEffect(() => {
    const COLLAPSE_RANGE = 90
    let ticking = false

    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrollProgress(Math.min(window.scrollY / COLLAPSE_RANGE, 1))
        ticking = false
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/login")
        return
      }

      setLoading(false)
    }

    checkUser()
  }, [router])
  const toNumber = (val: any) => {
    if (!val) return 0
    const num = parseFloat(String(val).replace(/[^\d.]/g, ""))
    return isNaN(num) ? 0 : Math.round(num)
  }

  // -------------------------
  // 📸 IMAGE UPLOAD + ANALYZE
  // -------------------------
  const uploadAndAnalyze = async (file: File) => {
    setAnalyzing(true)
    setAnalysis(null)

    try {
      const fileName = `${Date.now()}-${file.name}`

      const { error: uploadError } = await supabase.storage
        .from("meal-photos")
        .upload(fileName, file)

      if (uploadError) {
        console.error("UPLOAD ERROR:", uploadError)
        return
      }

      const { data: publicData } = supabase.storage
        .from("meal-photos")
        .getPublicUrl(fileName)

      const url = publicData?.publicUrl || ""
      setPhotoUrl(url)

      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      })

      const data = await res.json()

      const parsedAnalysis = {
        meal_name: data?.meal_name || "Meal",
        foods:
          data?.foods?.length > 0
            ? data.foods.map((f: any) =>
                typeof f === "string" ? f : f?.item || "food"
              )
            : ["Meal"],
        calories: data?.calories ?? 200,
        protein: data?.protein ?? 5,
        carbs: data?.carbs ?? 30,
        fat: data?.fat ?? 5,
      }

      setAnalysis(parsedAnalysis)
    } catch (err) {
      console.error(err)
    } finally {
      setAnalyzing(false)
    }
  }

  // -------------------------
  // ✏️ TEXT ANALYSIS (UPDATED)
  // -------------------------
  const analyzeTextMeal = async () => {
    if (!mealText) return

    setAnalyzing(true)
    setTextInputMode(false)

    try {
      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: mealText }),
      })

      const data = await res.json()

      const parsedAnalysis = {
        meal_name: data?.meal_name || mealText,
        foods:
          data?.foods?.length > 0
            ? data.foods.map((f: any) =>
                typeof f === "string" ? f : f?.item || "food"
              )
            : [mealText],
        calories: data?.calories ?? 200,
        protein: data?.protein ?? 5,
        carbs: data?.carbs ?? 30,
        fat: data?.fat ?? 5,
      }

      // ✅ FIRST: get image
      const imageUrl = await getSmartFoodImage(
        parsedAnalysis.meal_name,
        parsedAnalysis.foods
      )

      // ✅ THEN: set both together
      setPhotoUrl(imageUrl)
      setAnalysis(parsedAnalysis)
    } catch (err) {
      console.error(err)
    } finally {
      setAnalyzing(false)
      setMealText("")
    }
  }

  // -------------------------
  // 💾 SAVE (UNCHANGED)
  // -------------------------
  const saveMeal = async () => {
    if (!analysis || isSaving) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert("Not logged in")
      return
    } 
    
    setIsSaving(true)

    const safePhoto =
      photoUrl ||
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"

    const optimisticMeal = {
      id: Date.now(),
      created_at: new Date().toISOString(),
      photo_url: safePhoto,
      ai_analysis: analysis,
      calories: toNumber(analysis.calories),
      protein: toNumber(analysis.protein),
      carbs: toNumber(analysis.carbs),
      fat: toNumber(analysis.fat),
      note: note || null,
    }

    setOptimisticMeals((prev) => [optimisticMeal, ...prev])

    try {
      const { error } = await supabase.from("meals").insert([
        {
          user_id: user.id, // ✅ ADD THIS LINE
          photo_url: safePhoto,
          note: optimisticMeal.note,
          meal_type: "meal",
          ai_analysis: optimisticMeal.ai_analysis,
          calories: optimisticMeal.calories,
          protein: optimisticMeal.protein,
          carbs: optimisticMeal.carbs,
          fat: optimisticMeal.fat,
        },
      ])

      if (error) {
        console.error("SAVE ERROR:", error)
        setIsSaving(false)
        return
      }

      setRefreshFeed((prev) => prev + 1)

      setSaveSuccess(true)

      setTimeout(() => {
        setSaveSuccess(false)
        setIsSaving(false)
        setAnalysis(null)
        setPhotoUrl(null)
        setNote("")

        // ✅ CLEAR optimistic meals AFTER DB sync
        setOptimisticMeals([])
      }, 1000)
    } catch (err) {
      console.error(err)
      setIsSaving(false)
    }
  }

  if (loading) return null

 return (
  <div className="relative min-h-screen bg-ground text-ink">

    {/* ✨ AURORA BACKGROUND — tied to the same cal/protein/carb/fat palette as
        the rings. overflow-hidden lives on this layer specifically (not the
        outer wrapper) so it clips its own blobs without breaking position:
        sticky on DailySummary below — sticky stops working if ANY ancestor
        between it and the scroll container has overflow other than visible. */}
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute w-[500px] h-[500px] bg-cal/10 blur-[140px] rounded-full top-[-120px] left-[-120px] animate-pulse" />
      <div className="absolute w-[400px] h-[400px] bg-fat/10 blur-[140px] rounded-full bottom-[-120px] right-[-120px] animate-pulse" />
      <div className="absolute w-[300px] h-[300px] bg-carb/10 blur-[120px] rounded-full top-[40%] left-[60%] animate-pulse" />
    </div>

    <DailySummary
        refreshTrigger={refreshFeed}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        scrollProgress={scrollProgress}
      />

    <main className="relative z-10 max-w-xl mx-auto p-6 space-y-6 min-h-screen">

      {!photoUrl && !analysis && (
        <div className="flex gap-3">
          <button
            onClick={() => setMealChooserOpen(true)}
            className="group flex-1 flex items-center justify-center gap-2 bg-surface border border-hair-strong rounded-2xl py-3.5 text-sm font-bold text-ink transition-all duration-200 ease-spring hover:border-cal/40 hover:bg-surface-2 active:scale-[0.97]"
          >
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-cal to-[#ffd479] flex items-center justify-center text-[13px] font-black text-ground transition-transform duration-300 ease-spring group-active:rotate-90">
              +
            </span>
            Log meal
          </button>

          <button
            onClick={() => setWorkoutLoggerOpen(true)}
            className="group flex-1 flex items-center justify-center gap-2 bg-surface border border-hair-strong rounded-2xl py-3.5 text-sm font-bold text-ink transition-all duration-200 ease-spring hover:border-burn/40 hover:bg-surface-2 active:scale-[0.97]"
          >
            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-burn to-burn-2 flex items-center justify-center transition-transform duration-300 ease-spring group-active:scale-[1.15]">
              <Dumbbell size={11} className="text-ground" />
            </span>
            Log workout
          </button>
        </div>
      )}

      {mealChooserOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-surface border border-hair rounded-[22px] p-6 w-[90%] max-w-sm space-y-4 relative animate-fade-scale-in">
            <button
              onClick={() => setMealChooserOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink text-sm transition-all duration-150 ease-spring hover:bg-black/70 active:scale-90"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-ink">Log a meal</h2>
            <p className="text-xs text-ink-faint -mt-3">How do you want to add it?</p>

            <Upload
              onFileSelect={(file) => {
                setMealChooserOpen(false)
                uploadAndAnalyze(file)
              }}
            />

            <button
              onClick={() => {
                setMealChooserOpen(false)
                setTextInputMode(true)
              }}
              className="group w-full flex items-center gap-3 bg-surface-2 border border-hair rounded-xl px-4 py-3.5 text-sm font-bold text-ink transition-all duration-200 ease-spring hover:border-ink-faint active:scale-[0.98]"
            >
              <span className="w-8 h-8 rounded-full bg-surface border border-hair-strong flex items-center justify-center text-sm shrink-0 transition-transform duration-300 ease-spring group-active:rotate-12">
                ✎
              </span>
              <span>
                <span className="block">Enter manually</span>
                <span className="block text-xs font-normal text-ink-faint mt-0.5">
                  Describe your meal in words
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      {analyzing && (
        <div className="bg-surface border border-hair rounded-[22px] overflow-hidden animate-fade-scale-in">
          <div className="relative h-[220px] overflow-hidden">
            {photoUrl ? (
              <img
                src={photoUrl}
                className="w-full h-full object-cover opacity-40"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-surface via-surface to-surface-2" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-surface via-black/10 to-black/30" />

            <div className="absolute inset-0 -translate-x-full animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/10 backdrop-blur flex items-center justify-center">
                <Sparkles size={20} className="text-ink animate-pulse-soft" />
              </div>

              <div className="flex items-center gap-1.5 text-sm text-ink font-medium">
                <span>Analyzing your meal</span>
                <span className="flex items-end gap-0.5 pb-0.5">
                  <span className="w-1 h-1 rounded-full bg-ink animate-bounce-dot [animation-delay:0ms]" />
                  <span className="w-1 h-1 rounded-full bg-ink animate-bounce-dot [animation-delay:160ms]" />
                  <span className="w-1 h-1 rounded-full bg-ink animate-bounce-dot [animation-delay:320ms]" />
                </span>
              </div>
            </div>
          </div>

          {/* SKELETON CONTENT */}
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="h-6 w-16 rounded-full bg-surface-2 animate-pulse-soft" />
              <div className="h-6 w-20 rounded-full bg-surface-2 animate-pulse-soft [animation-delay:120ms]" />
              <div className="h-6 w-14 rounded-full bg-surface-2 animate-pulse-soft [animation-delay:240ms]" />
            </div>

            <div className="flex justify-between pt-3 border-t border-hair">
              <div className="h-3 w-10 rounded bg-surface-2 animate-pulse-soft" />
              <div className="h-3 w-10 rounded bg-surface-2 animate-pulse-soft [animation-delay:80ms]" />
              <div className="h-3 w-10 rounded bg-surface-2 animate-pulse-soft [animation-delay:160ms]" />
              <div className="h-3 w-10 rounded bg-surface-2 animate-pulse-soft [animation-delay:240ms]" />
            </div>
          </div>
        </div>
      )}

      {photoUrl && analysis && (
        <MealReviewCard
          imageUrl={photoUrl || ""}
          analysis={analysis}
          note={note}
          setNote={setNote}
          onSave={saveMeal}
          analyzing={analyzing}
          isSaving={isSaving}
          saveSuccess={saveSuccess}
          onCancel={() => {
            setPhotoUrl(null)
            setAnalysis(null)
          } } 
        />
      )}

      <MealFeed
        currentDate={currentDate}
        refreshTrigger={refreshFeed}
        optimisticMeals={optimisticMeals}
        onDeleteSuccess={() => setRefreshFeed((prev) => prev + 1)}
      />

      {textInputMode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-surface border border-hair rounded-[22px] p-6 w-[90%] max-w-sm space-y-4 relative animate-fade-scale-in">

             {/* ❌ CLOSE BUTTON */}
            <button
              onClick={() => {
                setTextInputMode(false)
                setMealText("")
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink text-sm transition-all duration-150 ease-spring hover:bg-black/70 active:scale-90"
            >
              ✕
            </button>

            <textarea
              value={mealText}
              onChange={(e) => setMealText(e.target.value)}
              placeholder="Describe your meal"
              className="w-full bg-ground border border-hair rounded-xl px-3 py-3 text-sm text-ink outline-none transition focus:border-ink/40"
            />

            <button
              onClick={analyzeTextMeal}
              disabled={!mealText.trim()}
              className={`w-full rounded-lg py-2 transition-all duration-200 ease-spring ${
                mealText.trim()
                  ? "bg-ink text-ground hover:bg-ink/90 active:scale-[0.98]"
                  : "bg-surface-2 text-ink-faint cursor-not-allowed"
              }`}
            >
              Analyze
            </button>
          </div>
        </div>
      )}

      <WorkoutLogger
        open={workoutLoggerOpen}
        onClose={() => setWorkoutLoggerOpen(false)}
        onSaved={() => setRefreshFeed((prev) => prev + 1)}
      />
    </main>
  </div>
 )
}