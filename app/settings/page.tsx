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
  const [displayName, setDisplayName] = useState("")

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
        setDisplayName(data.display_name || "")
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
        display_name: displayName.trim() || null,
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
    <div className="min-h-screen bg-ground text-ink px-4 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-8 h-8 rounded-full bg-surface border border-hair flex items-center justify-center text-ink-dim transition-all duration-150 ease-spring hover:bg-surface-2 hover:text-ink active:scale-90"
          >
            ‹
          </button>
          <h1 className="text-lg font-bold">Profile</h1>
        </div>

        <p className="text-xs text-ink-faint">
          This helps us personalize calorie estimates for your workouts. No
          pressure — update it anytime.
        </p>

        <div className="bg-surface border border-hair rounded-[22px] p-6 space-y-4 animate-fade-slide-up">
          <div className="space-y-1">
            <p className="text-[11px] text-ink-faint">
              Display name (shown when you share meals)
            </p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              className="w-full bg-ground border border-hair rounded-lg px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[11px] text-ink-faint">Weight (lbs)</p>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="150"
                className="w-full bg-ground border border-hair rounded-lg px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40"
              />
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-ink-faint">Height (in)</p>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="67"
                className="w-full bg-ground border border-hair rounded-lg px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40"
              />
            </div>

            <div className="space-y-1 col-span-2">
              <p className="text-[11px] text-ink-faint">Age</p>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="30"
                className="w-full bg-ground border border-hair rounded-lg px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-ink-faint">Activity level</p>
            <div className="flex flex-col gap-2">
              {ACTIVITY_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setActivityLevel(level)}
                  className={`w-full py-2 rounded-lg text-sm transition-all duration-150 ease-spring active:scale-[0.98] ${
                    activityLevel === level
                      ? "bg-ink text-ground hover:bg-ink/90"
                      : "border border-hair text-ink hover:border-ink-faint hover:bg-surface-2"
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
            className={`w-full rounded-lg py-2 transition-all duration-200 ease-spring active:scale-[0.98] ${
              saving
                ? "bg-surface-2 text-ink-faint cursor-not-allowed"
                : saveSuccess
                ? "bg-protein text-ground"
                : "bg-ink text-ground hover:bg-ink/90"
            }`}
          >
            {saving ? "Saving..." : saveSuccess ? "✓ Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
