"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getUserProfile, lbsToKg } from "@/lib/getUserProfile"
import { getWorkoutImage } from "@/lib/getWorkoutImage"
import {
  WORKOUT_TYPES,
  estimateCaloriesBurned,
  type WorkoutType,
} from "@/lib/workoutMeta"
import WorkoutReviewCard from "./WorkoutReviewCard"

type Props = {
  open: boolean
  onClose: () => void
  onSaved: () => void
  currentDate: Date
}

type Step = "type" | "duration" | "loading" | "review"

export default function WorkoutLogger({ open, onClose, onSaved, currentDate }: Props) {
  const [step, setStep] = useState<Step>("type")
  const [workoutType, setWorkoutType] = useState<WorkoutType | null>(null)
  const [duration, setDuration] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [calories, setCalories] = useState(0)
  const [note, setNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      setStep("type")
      setWorkoutType(null)
      setDuration("")
      setImageUrl("")
      setCalories(0)
      setNote("")
      setIsSaving(false)
      setSaveSuccess(false)
    }
  }, [open])

  if (!open) return null

  const handlePickType = (type: WorkoutType) => {
    setWorkoutType(type)
    setStep("duration")
  }

  const handleConfirmDuration = async () => {
    const minutes = parseFloat(duration)
    if (!workoutType || !minutes || minutes <= 0) return

    setStep("loading")

    try {
      const [profile, fetchedImage] = await Promise.all([
        getUserProfile(),
        getWorkoutImage(workoutType),
      ])

      const weightKg = profile?.weight ? lbsToKg(profile.weight) : undefined
      const estimate = estimateCaloriesBurned(workoutType, minutes, weightKg)

      setImageUrl(fetchedImage)
      setCalories(estimate)
      setStep("review")
    } catch (err) {
      console.error("WORKOUT PREP FAILED:", err)
      setStep("duration")
    }
  }

  const handleSave = async () => {
    if (!workoutType || isSaving) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert("Not logged in")
      return
    }

    setIsSaving(true)

    try {
      const { error } = await supabase.from("workouts").insert([
        {
          user_id: user.id,
          // File under the day being viewed, not "now" — same fix as meals.
          created_at: (() => {
            const now = new Date()
            const stamp = new Date(currentDate)
            stamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
            return stamp.toISOString()
          })(),
          workout_type: workoutType,
          duration_minutes: Math.round(parseFloat(duration)),
          calories_burned: calories,
          photo_url: imageUrl,
          note: note || null,
        },
      ])

      if (error) {
        console.error("WORKOUT SAVE ERROR:", error)
        setIsSaving(false)
        return
      }

      setSaveSuccess(true)

      setTimeout(() => {
        onSaved()
        onClose()
      }, 1000)
    } catch (err) {
      console.error(err)
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in p-4">
      {step === "type" && (
        <div className="bg-surface border border-hair rounded-[22px] p-6 w-full max-w-sm space-y-4 relative animate-fade-scale-in">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink text-sm transition-all duration-150 ease-spring hover:bg-black/70 active:scale-90"
          >
            ✕
          </button>

          <h2 className="text-lg font-bold text-ink">Log a workout</h2>
          <p className="text-xs text-ink-faint -mt-3">What did you do?</p>

          <div className="grid grid-cols-2 gap-3">
            {WORKOUT_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handlePickType(value)}
                className="flex flex-col items-center gap-2 py-4 rounded-xl border border-hair transition-all duration-150 ease-spring hover:border-burn/40 hover:bg-surface-2 active:scale-[0.97]"
              >
                <Icon size={20} className="text-ink" />
                <span className="text-xs text-ink">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "duration" && workoutType && (
        <div className="bg-surface border border-hair rounded-[22px] p-6 w-full max-w-sm space-y-4 relative animate-fade-scale-in">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink text-sm transition-all duration-150 ease-spring hover:bg-black/70 active:scale-90"
          >
            ✕
          </button>

          <button
            onClick={() => setStep("type")}
            className="text-xs text-ink-faint hover:text-ink active:scale-95 transition"
          >
            ‹ Back
          </button>

          <h2 className="text-lg font-bold text-ink">
            How long was it?
          </h2>

          <input
            type="number"
            min={1}
            autoFocus
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Duration (minutes)"
            className="w-full bg-ground border border-hair rounded-xl px-3 py-3 text-sm text-ink outline-none transition focus:border-ink/40"
          />

          <button
            onClick={handleConfirmDuration}
            disabled={!duration || parseFloat(duration) <= 0}
            className={`w-full rounded-lg py-2 transition-all duration-200 ease-spring active:scale-[0.98] ${
              duration && parseFloat(duration) > 0
                ? "bg-ink text-ground hover:bg-ink/90"
                : "bg-surface-2 text-ink-faint cursor-not-allowed"
            }`}
          >
            Continue
          </button>
        </div>
      )}

      {step === "loading" && (
        <div className="bg-surface border border-hair rounded-[22px] p-8 w-full max-w-sm flex flex-col items-center gap-3 animate-fade-scale-in">
          <div className="w-12 h-12 rounded-full bg-burn/15 border border-burn/30 backdrop-blur flex items-center justify-center">
            <Sparkles size={20} className="text-burn animate-pulse-soft" />
          </div>
          <p className="text-sm text-ink font-medium">
            Getting your workout ready...
          </p>
        </div>
      )}

      {step === "review" && workoutType && (
        <div className="w-full max-w-sm">
          <WorkoutReviewCard
            imageUrl={imageUrl}
            workoutType={workoutType}
            durationMinutes={Math.round(parseFloat(duration))}
            calories={calories}
            setCalories={setCalories}
            note={note}
            setNote={setNote}
            onSave={handleSave}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            onCancel={onClose}
          />
        </div>
      )}
    </div>
  )
}
