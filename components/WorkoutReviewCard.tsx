"use client"

import { useState } from "react"
import { Flame } from "lucide-react"
import { WORKOUT_META_BY_TYPE, type WorkoutType } from "@/lib/workoutMeta"

type Props = {
  imageUrl: string
  workoutType: WorkoutType
  durationMinutes: number
  calories: number
  setCalories: (v: number) => void
  note: string
  setNote: (v: string) => void
  onSave: () => void
  isSaving: boolean
  saveSuccess: boolean
  onCancel: () => void
}

export default function WorkoutReviewCard({
  imageUrl,
  workoutType,
  durationMinutes,
  calories,
  setCalories,
  note,
  setNote,
  onSave,
  isSaving,
  saveSuccess,
  onCancel,
}: Props) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const meta = WORKOUT_META_BY_TYPE[workoutType]
  const Icon = meta?.icon || Flame

  const handleSave = async () => {
    if (isSaving) return
    await onSave()
  }

  return (
    <div
      className={`
        bg-[#171A21] border border-[#232734] rounded-2xl overflow-hidden
        animate-fade-slide-up
        transition-all duration-500
        ${saveSuccess ? "scale-[0.98] opacity-60" : ""}
      `}
    >
      {/* IMAGE */}
      <div className="relative">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white text-sm transition-all duration-150 hover:bg-black/60 hover:scale-110 active:scale-90"
        >
          ✕
        </button>

        {!imgLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-[#1a1f2b] via-[#222838] to-[#1a1f2b]" />
        )}

        <img
          src={
            imageUrl ||
            "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
          }
          onLoad={() => setImgLoaded(true)}
          onError={(e) => {
            e.currentTarget.src =
              "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
            setImgLoaded(true)
          }}
          className="w-full h-[340px] object-cover transition-opacity duration-500"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-orange-500/20 border border-orange-400/30 backdrop-blur-md px-2.5 py-1 rounded-full">
          <Icon size={13} className="text-orange-300" />
          <span className="text-xs font-medium text-orange-200">
            {meta?.label || "Workout"}
          </span>
        </div>

        <div className="absolute bottom-3 left-4 right-4">
          <h2 className="text-white text-lg font-semibold">
            {meta?.label || "Workout"} — {durationMinutes} min
          </h2>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-4 space-y-4">
        {/* CALORIES (editable) */}
        <div>
          <p className="text-xs text-[#9AA3B2] mb-2">Calories burned</p>
          <div className="flex items-center gap-2 bg-[#0F1115] border border-[#232734] rounded-lg px-3 py-2 transition focus-within:border-white/40">
            <Flame size={16} className="text-orange-400 shrink-0" />
            <input
              type="number"
              min={0}
              value={calories}
              onChange={(e) => setCalories(Number(e.target.value) || 0)}
              className="w-full bg-transparent text-sm text-white outline-none"
            />
            <span className="text-xs text-[#6B7280] shrink-0">cal</span>
          </div>
        </div>

        {/* NOTE */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note..."
          className="w-full bg-[#0F1115] border border-[#232734] rounded-lg px-3 py-2 text-sm outline-none transition focus:border-white/40"
        />

        {/* SAVE BUTTON */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`
            w-full h-12 rounded-xl font-medium
            transition-all duration-300 flex items-center justify-center gap-2
            ${
              isSaving
                ? "bg-[#232734] text-[#9AA3B2] cursor-not-allowed"
                : saveSuccess
                ? "bg-green-500 text-white"
                : "bg-white text-black hover:bg-white/90"
            }
            active:scale-[0.98]
          `}
        >
          {isSaving && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}

          {!isSaving && !saveSuccess && "Save Workout"}
          {isSaving && "Saving..."}
          {saveSuccess && "✓ Nice work!"}
        </button>

        {saveSuccess && (
          <p className="text-center text-xs text-green-400 animate-fade-in">
            Added to your day
          </p>
        )}
      </div>
    </div>
  )
}
