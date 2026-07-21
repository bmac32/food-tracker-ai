"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const ACTIVITY_LEVELS = ["Not very active", "Somewhat active", "Very active"]

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [weight, setWeight] = useState("")
  const [height, setHeight] = useState("")
  const [age, setAge] = useState("")
  const [activityLevel, setActivityLevel] = useState("Somewhat active")

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push("/login")
        return
      }

      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle()

      if (error) {
        console.error("PROFILE LOAD ERROR:", error)
      }

      if (data) {
        setWeight(data.weight ? String(data.weight) : "")
        setHeight(data.height ? String(data.height) : "")
        setAge(data.age ? String(data.age) : "")
        setActivityLevel(data.activity_level || "Somewhat active")
      }

      setLoading(false)
    }

    load()
  }, [router])

  const handleSave = async () => {
    if (saving) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    setSaving(true)

    const { error } = await supabase.from("user_profiles").upsert(
      {
        user_id: user.id,
        weight: weight ? Number(weight) : null,
        height: height ? Number(height) : null,
        age: age ? Number(age) : null,
        activity_level: activityLevel,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

    setSaving(false)

    if (error) {
      console.error("PROFILE SAVE ERROR:", error)
      return
    }

    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 1800)
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#E6E8EC] px-4 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-8 h-8 rounded-full bg-[#171A21] border border-[#232734] flex items-center justify-center text-[#9AA3B2] transition-all duration-150 hover:bg-[#1b1f28] hover:text-white active:scale-90"
          >
            ‹
          </button>
          <h1 className="text-lg font-semibold">Profile</h1>
        </div>

        <p className="text-xs text-[#9AA3B2]">
          This helps us personalize calorie estimates for your workouts. No
          pressure — update it anytime.
        </p>

        <div className="bg-[#171A21] border border-[#232734] rounded-2xl p-6 space-y-4 animate-fade-slide-up">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[11px] text-[#9AA3B2]">Weight (lbs)</p>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="150"
                className="w-full bg-[#0F1115] border border-[#232734] rounded-lg px-3 py-2 text-sm outline-none transition focus:border-white/40"
              />
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-[#9AA3B2]">Height (in)</p>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="67"
                className="w-full bg-[#0F1115] border border-[#232734] rounded-lg px-3 py-2 text-sm outline-none transition focus:border-white/40"
              />
            </div>

            <div className="space-y-1 col-span-2">
              <p className="text-[11px] text-[#9AA3B2]">Age</p>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="30"
                className="w-full bg-[#0F1115] border border-[#232734] rounded-lg px-3 py-2 text-sm outline-none transition focus:border-white/40"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-[#9AA3B2]">Activity level</p>
            <div className="flex flex-col gap-2">
              {ACTIVITY_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setActivityLevel(level)}
                  className={`w-full py-2 rounded-lg text-sm transition-all duration-150 active:scale-[0.98] ${
                    activityLevel === level
                      ? "bg-white text-black hover:bg-white/90"
                      : "border border-[#232734] hover:border-[#3a4152] hover:bg-[#1b1f28]"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full rounded-lg py-2 transition-all duration-200 active:scale-[0.98] ${
              saving
                ? "bg-[#232734] text-[#6B7280] cursor-not-allowed"
                : saveSuccess
                ? "bg-green-500 text-white"
                : "bg-white text-black hover:bg-white/90"
            }`}
          >
            {saving ? "Saving..." : saveSuccess ? "✓ Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
