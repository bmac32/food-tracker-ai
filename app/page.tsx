"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../lib/supabase"
import { getSmartFoodImage } from "@/lib/getSmartFoodImage"

import Upload from "@/components/Upload"
import DailySummary from "@/components/DailySummary"
import MealFeed from "@/components/MealFeed"
import MealReviewCard from "@/components/MealReviewCard"
import UserInfo from "@/components/UserInfo"

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
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsCollapsed(window.scrollY > 60)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
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
  <div className="relative min-h-screen bg-[#0F1115] text-[#E6E8EC] overflow-hidden">

    {/* ✨ SHIMMER BACKGROUND */}
    <div className="absolute inset-0 z-0">
      <div className="absolute w-[500px] h-[500px] bg-blue-500/10 blur-[140px] rounded-full top-[-120px] left-[-120px] animate-pulse" />
      <div className="absolute w-[400px] h-[400px] bg-purple-500/10 blur-[140px] rounded-full bottom-[-120px] right-[-120px] animate-pulse" />
      <div className="absolute w-[300px] h-[300px] bg-teal-400/10 blur-[120px] rounded-full top-[40%] left-[60%] animate-pulse" />
    </div>

    <DailySummary
        refreshTrigger={refreshFeed}
        currentDate={currentDate}
        setCurrentDate={setCurrentDate}
        isCollapsed={isCollapsed}
      />

    <main className="relative z-10 max-w-xl mx-auto p-6 space-y-6 min-h-screen pt-52">

      {!photoUrl && !analysis && (
        <Upload
          onFileSelect={uploadAndAnalyze}
          onManualEntry={() => setTextInputMode(true)}
        />
      )}

      {analyzing && (
        <div className="bg-[#171A21] border border-[#232734] rounded-2xl overflow-hidden animate-pulse">
          {photoUrl && (
            <img
              src={photoUrl}
              className="w-full h-[280px] object-cover opacity-70"
            />
          )}
          <div className="p-4 text-center">
            ✨ Analyzing your meal
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#171A21] rounded-2xl p-6 w-[90%] max-w-sm space-y-4 relative">
             
             {/* ❌ CLOSE BUTTON */}
            <button
              onClick={() => {
                setTextInputMode(false)
                setMealText("")
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white text-sm"
            >
              ✕
            </button>

            <textarea
              value={mealText}
              onChange={(e) => setMealText(e.target.value)}
              placeholder="Describe your meal"
              className="w-full bg-[#0F1115] border border-[#232734] rounded-xl px-3 py-3 text-sm"
            />

            <button
              onClick={analyzeTextMeal}
              className="w-full bg-white text-black rounded-lg py-2"
            >
              Analyze
            </button>
          </div>
        </div>
      )}
    </main>
  </div>
 )
}