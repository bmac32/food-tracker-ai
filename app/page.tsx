"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../lib/supabase"
import { getSmartFoodImages, fallbackSet } from "@/lib/getSmartFoodImage"
import { dishKey } from "@/lib/photoLearning"

import { Sparkles, Dumbbell, Refrigerator } from "lucide-react"

import Upload from "@/components/Upload"
import DailySummary from "@/components/DailySummary"
import MealFeed from "@/components/MealFeed"
import MealReviewCard from "@/components/MealReviewCard"
import CoachNext, { CoachTip } from "@/components/CoachNext"
import CoachWorkout, { WorkoutCoachTip } from "@/components/CoachWorkout"
import FridgeSuggest, { FridgeSuggestion } from "@/components/FridgeSuggest"
import UserInfo from "@/components/UserInfo"
import WorkoutLogger from "@/components/WorkoutLogger"
import type { WorkoutType } from "@/lib/workoutMeta"

type Analysis = {
  meal_name: string
  foods: string[]
  food_items?: {
    item: string
    grams: number
    protein: number
    carbs: number
    fat: number
    per100: { protein: number; carbs: number; fat: number } | null
  }[]
  calories: number | string
  protein: number | string
  carbs: number | string
  fat: number | string
  image_query?: string
  photos_analyzed?: number
}

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  const [note, setNote] = useState("")
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  // Swipeable photo candidates (auto-picked stock photos). The selected
  // index is what gets saved as photo_url; the full pool is saved as
  // photo_candidates so the feed can offer the same picker later.
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [isUserPhoto, setIsUserPhoto] = useState(false)
  const [photoIndex, setPhotoIndex] = useState(0)
  const photoUrl = photoUrls[photoIndex] ?? null
  const [analyzing, setAnalyzing] = useState(false)

  const [refreshFeed, setRefreshFeed] = useState(0)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [optimisticMeals, setOptimisticMeals] = useState<any[]>([])

  const [textInputMode, setTextInputMode] = useState(false)
  const [mealText, setMealText] = useState("")

  // Honest error state: shown when AI analysis fails instead of
  // inventing nutrition data.
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [workoutLoggerOpen, setWorkoutLoggerOpen] = useState(false)
  const [mealChooserOpen, setMealChooserOpen] = useState(false)
  const [fridgeOpen, setFridgeOpen] = useState(false)
  const [coachTip, setCoachTip] = useState<{
    tip: CoachTip
    nextMeal: string
    followThrough: string | null
    doneForDay?: boolean
  } | null>(null)
  const [coachWorkout, setCoachWorkout] = useState<{
    tip: WorkoutCoachTip
    workoutType: WorkoutType
    covered?: boolean
  } | null>(null)

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
  const uploadAndAnalyze = async (files: File[]) => {
    setAnalyzing(true)
    setAnalysis(null)
    setAnalysisError(null)

    try {
      const picked = files.slice(0, 4)

      const urls = await Promise.all(
        picked.map(async (file) => {
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`

          const { error: uploadError } = await supabase.storage
            .from("meal-photos")
            .upload(fileName, file)

          if (uploadError) throw uploadError

          const { data: publicData } = supabase.storage
            .from("meal-photos")
            .getPublicUrl(fileName)

          return publicData?.publicUrl || ""
        })
      )

      const valid = urls.filter(Boolean)
      if (valid.length === 0) {
        setAnalysisError("Couldn't upload the photos — please try again.")
        return
      }

      // User-uploaded photos: all candidates, no picker needed.
      setPhotoUrls(valid)
      setPhotoIndex(0)
      setIsUserPhoto(true)

      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: valid }),
      })

      const data = await res.json()

      // Honest failure: surface the error instead of showing fake macros.
      if (!res.ok || data?.error) {
        setAnalysisError(data?.error || "AI analysis failed — please try again.")
        return
      }

      const parsedAnalysis = {
        meal_name: data?.meal_name || "Meal",
        foods:
          data?.foods?.length > 0
            ? data.foods.map((f: any) =>
                typeof f === "string" ? f : f?.item || "food"
              )
            : ["Meal"],
        food_items: Array.isArray(data?.food_items) ? data.food_items : undefined,
        calories: data?.calories ?? 200,
        protein: data?.protein ?? 5,
        carbs: data?.carbs ?? 30,
        fat: data?.fat ?? 5,
        photos_analyzed: data?.photos_analyzed ?? 1,
      }

      setAnalysis(parsedAnalysis)
    } catch (err) {
      console.error("UPLOAD ERROR:", err)
      setAnalysisError("Couldn't upload the photos — please try again.")
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
    setAnalysisError(null)

    try {
      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: mealText }),
      })

      const data = await res.json()

      // Honest failure: surface the error instead of showing fake macros.
      if (!res.ok || data?.error) {
        setAnalysisError(data?.error || "AI analysis failed — please try again.")
        setMealText("")
        return
      }

      const parsedAnalysis = {
        meal_name: data?.meal_name || mealText,
        foods:
          data?.foods?.length > 0
            ? data.foods.map((f: any) =>
                typeof f === "string" ? f : f?.item || "food"
              )
            : [mealText],
        food_items: Array.isArray(data?.food_items) ? data.food_items : undefined,
        image_query: data?.image_query || "",
        calories: data?.calories ?? 200,
        protein: data?.protein ?? 5,
        carbs: data?.carbs ?? 30,
        fat: data?.fat ?? 5,
      }

      // ✅ FIRST: get image candidates (swipeable picker)
      const imageUrls = await getSmartFoodImages(
        parsedAnalysis.meal_name,
        parsedAnalysis.foods,
        {
          imageQuery: parsedAnalysis.image_query,
          dishKey: dishKey(parsedAnalysis.meal_name, parsedAnalysis.foods),
        }
      )

      // ✅ THEN: set both together
      setPhotoUrls(imageUrls)
      setPhotoIndex(0)
      setIsUserPhoto(false)
      setAnalysis(parsedAnalysis)
    } catch (err) {
      console.error(err)
    } finally {
      setAnalyzing(false)
      setMealText("")
    }
  }

  // -------------------------
  // 🧊 FRIDGE SUGGESTION → REVIEW FLOW
  // A chosen fridge suggestion becomes a pending meal: it goes through
  // the same review card (photo picker, editable ingredients) and the
  // same save path as a text-logged meal.
  // -------------------------
  const logFridgeSuggestion = async (s: FridgeSuggestion) => {
    setFridgeOpen(false)
    setAnalyzing(true)
    setAnalysisError(null)

    try {
      const urls = await getSmartFoodImages(s.name, s.uses, {
        dishKey: dishKey(s.name, s.uses),
      })
      setPhotoUrls(urls)
      setPhotoIndex(0)
      setIsUserPhoto(false)
      setAnalysis({
        meal_name: s.name,
        foods: s.uses.length > 0 ? s.uses : [s.name],
        calories: s.calories,
        protein: s.protein,
        carbs: s.carbs,
        fat: s.fat,
      })
    } catch (err) {
      console.error("FRIDGE LOG FAILED:", err)
      setAnalysisError("Couldn't prepare that suggestion — please try again.")
    } finally {
      setAnalyzing(false)
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

    // Stamp the meal with the day the user is VIEWING (not necessarily
    // today), keeping the current time-of-day so ordering stays sensible.
    // Without this, logging on a past day silently filed the meal under today.
    const now = new Date()
    const stamp = new Date(currentDate)
    stamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
    const createdAt = stamp.toISOString()

    const safePhoto =
      photoUrl ||
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"

    const candidates = photoUrls.length > 0 ? photoUrls : [safePhoto]

    const optimisticMeal = {
      id: Date.now(),
      created_at: createdAt,
      photo_url: safePhoto,
      photo_candidates: candidates,
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
          created_at: optimisticMeal.created_at, // the viewed day, not "now"
          photo_url: safePhoto,
          photo_candidates: candidates,
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

      // Photo learning loop: remember which STOCK photo she picked for this dish,
      // so the next similar meal opens with a winner. Fire-and-forget.
      // User-uploaded photos are her actual meal — never learn them as
      // candidates for other meals.
      if (!isUserPhoto) {
        fetch("/api/food-image/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dish_key: dishKey(analysis.meal_name, analysis.foods),
            meal_name: analysis.meal_name,
            foods: analysis.foods,
            photo_url: safePhoto,
            verdict: "chosen",
          }),
        }).catch(() => {})
      }

      // Live coach: guidance for the next meal, based on today so far.
      fetchCoachTip()

      setRefreshFeed((prev) => prev + 1)

      setSaveSuccess(true)

      setTimeout(() => {
        setSaveSuccess(false)
        setIsSaving(false)
        setAnalysis(null)
        setPhotoUrls([])
        setPhotoIndex(0)
        setNote("")

        // ✅ CLEAR optimistic meals AFTER DB sync
        setOptimisticMeals([])
      }, 1000)
    } catch (err) {
      console.error(err)
      setIsSaving(false)
    }
  }

  // -------------------------
  // 🎯 LIVE COACH — guidance for the NEXT meal, right after saving
  // -------------------------
  const PENDING_SUGGESTION_KEY = "pendingCoachSuggestion"

  // Which macros did the just-saved meal meaningfully cover? Checks ALL of
  // them, not just the tip's focus — a beef stew that delivered protein AND
  // carbs should say both, so she learns what her meals actually give her.
  // Quiet by design: returns the ack line, or null (say nothing on a miss).
  const checkFollowThrough = (meal: Analysis | null): string | null => {
    try {
      const raw = localStorage.getItem(PENDING_SUGGESTION_KEY)
      if (!raw || !meal) return null
      const pending = JSON.parse(raw)
      // Ancient suggestions don't count — 36h max.
      if (pending.at && Date.now() - pending.at > 36 * 3600 * 1000) return null
      const remaining = pending.remaining || {}
      const floors: Record<string, number> = { protein: 8, carbs: 12, fat: 7 }
      const covered: string[] = []
      for (const m of ["protein", "carbs", "fat"]) {
        const mealVal = Number((meal as any)[m]) || 0
        if (mealVal < (floors[m] ?? 8)) continue
        const remVal = Number(remaining[m]) || 0
        // Covered = a solid share of what was left (or at/past goal already).
        if (remVal <= 0 || mealVal >= 0.25 * remVal) covered.push(m)
      }
      if (covered.length === 0) return null
      const list =
        covered.length === 1
          ? covered[0]
          : covered.length === 2
            ? `${covered[0]} and ${covered[1]}`
            : `${covered[0]}, ${covered[1]}, and ${covered[2]}`
      return `That meal had your ${list} covered.`
    } catch {
      return null
    }
  }

  const fetchCoachTip = async () => {
    // Only for today — backfilling a past day doesn't need "next meal" advice.
    const today = new Date()
    const viewing = new Date(currentDate)
    const isToday =
      today.getFullYear() === viewing.getFullYear() &&
      today.getMonth() === viewing.getMonth() &&
      today.getDate() === viewing.getDate()
    if (!isToday) return

    const start = new Date(viewing)
    start.setHours(0, 0, 0, 0)
    const end = new Date(viewing)
    end.setHours(23, 59, 59, 999)

    // Follow-through check: the previous suggestion expires with this meal,
    // whether or not it was followed. Say nothing on a miss.
    const followThrough = checkFollowThrough(analysis)
    try {
      localStorage.removeItem(PENDING_SUGGESTION_KEY)
    } catch {}

    try {
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
        hour: String(new Date().getHours()),
      })
      const res = await fetch(`/api/coach/next?${params.toString()}`)
      const json = await res.json()
      // Done for the day: no more "next meal" push — just closure (plus
      // any follow-through ack above). The tip itself is skipped.
      if (json?.doneForDay) {
        setCoachTip({
          tip: { headline: "", focus: "balanced", detail: "", suggestions: [] },
          nextMeal: "",
          followThrough,
          doneForDay: true,
        })
        return
      }
      if (json?.tip) {
        // Remember the remaining macros; the NEXT logged meal gets checked
        // against all of them. Expires with the next meal either way.
        try {
          localStorage.setItem(
            PENDING_SUGGESTION_KEY,
            JSON.stringify({ remaining: json.remaining || {}, at: Date.now() })
          )
        } catch {}
        setCoachTip({
          tip: json.tip,
          nextMeal: json.nextMeal || "your next meal",
          followThrough,
        })
      }
    } catch {
      // Silent — the card just doesn't appear.
    }
  }

  // -------------------------
  // 🏋️ WORKOUT COACH
  // -------------------------
  // After a workout is saved, fetch recovery guidance. Skipped for past-day
  // backfills. The suggestion is stored like the meal coach's, so the next
  // logged meal gets the same quiet follow-through acknowledgment.
  const handleWorkoutSaved = async (w?: {
    workoutType: WorkoutType
    durationMinutes: number
    calories: number
  }) => {
    setRefreshFeed((prev) => prev + 1)
    const today = new Date()
    const viewing = new Date(currentDate)
    const isToday =
      today.getFullYear() === viewing.getFullYear() &&
      today.getMonth() === viewing.getMonth() &&
      today.getDate() === viewing.getDate()
    if (!isToday || !w) return

    const start = new Date(viewing)
    start.setHours(0, 0, 0, 0)
    const end = new Date(viewing)
    end.setHours(23, 59, 59, 999)

    try {
      const params = new URLSearchParams({
        type: w.workoutType,
        minutes: String(w.durationMinutes),
        start: start.toISOString(),
        end: end.toISOString(),
      })
      const res = await fetch(`/api/coach/workout?${params.toString()}`)
      const json = await res.json()
      // Already eaten enough to cover recovery — quiet closure, no food push.
      if (json?.covered) {
        setCoachWorkout({
          tip: {
            headline: "",
            focus: "balanced",
            detail: "",
            suggestions: [],
            hydration: null,
          },
          workoutType: w.workoutType,
          covered: true,
        })
        return
      }
      if (json?.tip) {
        // The next logged meal gets checked against these remaining macros,
        // same as the meal coach's follow-through loop.
        try {
          localStorage.setItem(
            PENDING_SUGGESTION_KEY,
            JSON.stringify({ remaining: json.remaining || {}, at: Date.now() })
          )
        } catch {}
        setCoachWorkout({
          tip: json.tip,
          workoutType: w.workoutType,
          covered: false,
        })
      }
    } catch {
      // Silent — the card just doesn't appear.
    }
  }

  // -------------------------
  // 👎 PHOTO FEEDBACK
  // -------------------------
  const recordPhotoVerdict = (
    photo_url: string,
    verdict: "disliked",
    dish_key: string,
    meal_name?: string,
    foods?: any
  ) => {
    fetch("/api/food-image/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dish_key, meal_name, foods, photo_url, verdict }),
    }).catch(() => {})
  }

  /** Thumbs-down on one photo: record it, pull it from the candidates. */
  const handleDislikePhoto = (index: number) => {
    const url = photoUrls[index]
    if (!url || !analysis) return
    recordPhotoVerdict(
      url,
      "disliked",
      dishKey(analysis.meal_name, analysis.foods),
      analysis.meal_name,
      analysis.foods
    )
    const next = photoUrls.filter((_, i) => i !== index)
    if (next.length === 0) {
      // Never strand her with no photo (the card would unmount and eat the
      // whole review). Refill with curated fallbacks for this dish.
      const gone = new Set(photoUrls)
      const fb = fallbackSet(analysis.meal_name || "meal").filter(
        (u) => !gone.has(u)
      )
      setPhotoUrls(fb.length > 0 ? fb : fallbackSet("meal"))
    } else {
      setPhotoUrls(next)
    }
    setPhotoIndex(0)
  }

  /** "None of these look right": dislike the whole batch, fetch a fresh one. */  const handleNoneOfThesePhotos = async () => {
    if (!analysis || photoUrls.length === 0) return
    const key = dishKey(analysis.meal_name, analysis.foods)
    const shown = [...photoUrls]
    for (const url of shown) {
      recordPhotoVerdict(url, "disliked", key, analysis.meal_name, analysis.foods)
    }
    setAnalyzing(true)
    try {
      const urls = await getSmartFoodImages(
        analysis.meal_name,
        analysis.foods,
        {
          imageQuery: analysis.image_query,
          dishKey: key,
          exclude: shown,
        }
      )
      setPhotoUrls(urls)
      setPhotoIndex(0)
    } finally {
      setAnalyzing(false)
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

    <main className="relative z-10 max-w-xl mx-auto px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-6 min-h-screen">

      {coachTip && !analysis && (
        <CoachNext
          tip={coachTip.tip}
          nextMeal={coachTip.nextMeal}
          followThrough={coachTip.followThrough}
          doneForDay={coachTip.doneForDay}
          onClose={() => setCoachTip(null)}
        />
      )}

      {coachWorkout && !analysis && (
        <CoachWorkout
          tip={coachWorkout.tip}
          workoutType={coachWorkout.workoutType}
          covered={coachWorkout.covered}
          onClose={() => setCoachWorkout(null)}
        />
      )}

      {!photoUrl && !analysis && (
        <div className="space-y-3">
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
              onFileSelect={(files) => {
                setMealChooserOpen(false)
                uploadAndAnalyze(files)
              }}
            />

            <button
              onClick={() => {
                setMealChooserOpen(false)
                setFridgeOpen(true)
              }}
              className="group w-full flex items-center gap-3 bg-surface-2 border border-hair rounded-xl px-4 py-3.5 text-sm font-bold text-ink transition-all duration-200 ease-spring hover:border-carb/40 active:scale-[0.98]"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-carb to-protein flex items-center justify-center shrink-0 transition-transform duration-300 ease-spring group-active:rotate-12">
                <Refrigerator size={15} className="text-ground" />
              </span>
              <span className="text-left">
                <span className="block">Snap your fridge</span>
                <span className="block text-xs font-normal text-ink-faint mt-0.5">
                  Get meal ideas that close today's gaps
                </span>
              </span>
            </button>

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

      {analysisError && !analyzing && (
        <div className="mx-4 mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-ink animate-fade-slide-up">
          <p className="font-semibold">Couldn't analyze that meal</p>
          <p className="mt-1 text-ink-dim">{analysisError}</p>
          <button
            onClick={() => setAnalysisError(null)}
            className="mt-2 text-xs font-medium text-ink underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {photoUrl && analysis && (
        <MealReviewCard
          images={photoUrls}
          imageIndex={photoIndex}
          onImageChange={setPhotoIndex}
          analysis={analysis}
          note={note}
          setNote={setNote}
          onSave={saveMeal}
          analyzing={analyzing}
          isSaving={isSaving}
          saveSuccess={saveSuccess}
          onDislikePhoto={handleDislikePhoto}
          onNoneOfThesePhotos={handleNoneOfThesePhotos}
          isUserPhoto={isUserPhoto}
          onCancel={() => {
            setPhotoUrls([])
            setPhotoIndex(0)
            setIsUserPhoto(false)
            setAnalysis(null)
            setAnalysisError(null)
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
        onSaved={handleWorkoutSaved}
        currentDate={currentDate}
      />

      <FridgeSuggest
        open={fridgeOpen}
        onClose={() => setFridgeOpen(false)}
        onLog={logFridgeSuggestion}
      />
    </main>
  </div>
 )
}