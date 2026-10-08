"use client"

import { useState } from "react"
import { Flame } from "lucide-react"
import { WORKOUT_META_BY_TYPE, type WorkoutType } from "@/lib/workoutMeta"
import { workoutFallback } from "@/lib/workoutImageFallbacks"
import MealImageCarousel from "./MealImageCarousel"

type Props = {
  /** Candidate photos; the user swipes/picks the one they like. */
  images: string[]
  imageIndex: number
  onImageChange: (i: number) => void
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
  images,
  imageIndex,
  onImageChange,
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
        bg-surface border border-hair rounded-[22px] overflow-hidden
        animate-fade-slide-up
        transition-all duration-500
        ${saveSuccess ? "scale-[0.98] opacity-60" : ""}
      `}
    >
      {/* IMAGE — swipeable candidates, same picker as the meal photo flow.
          The selected photo is what gets saved with the workout. */}
      <div className="relative" onLoadCapture={() => setImgLoaded(true)}>
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink text-sm transition-all duration-150 ease-spring hover:bg-black/60 hover:scale-110 active:scale-90"
        >
          ✕
        </button>

        {!imgLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-surface via-surface-2 to-surface" />
        )}

        <MealImageCarousel
          images={images.length > 0 ? images : [workoutFallback(workoutType)]}
          index={imageIndex}
          onChange={onImageChange}
          className="h-[340px]"
          alt={`${meta?.label || "Workout"} photo`}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-burn/20 border border-burn/40 backdrop-blur-md px-2.5 py-1 rounded-full">
          <Icon size={13} className="text-burn" />
          <span className="text-xs font-bold text-[#ffb3c1]">
            {meta?.label || "Workout"}
          </span>
        </div>

        <div className="absolute bottom-3 left-4 right-4">
          <h2 className="text-ink text-lg font-bold tracking-tight">
            {meta?.label || "Workout"} — {durationMinutes} min
          </h2>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-4 space-y-4">
        {/* CALORIES (editable) */}
        <div>
          <p className="text-xs text-ink-faint mb-2">Calories burned</p>
          <div className="flex items-center gap-2 bg-ground border border-hair rounded-lg px-3 py-2 transition focus-within:border-ink/40">
            <Flame size={16} className="text-burn shrink-0" />
            <input
              type="number"
              min={0}
              value={calories}
              onChange={(e) => setCalories(Number(e.target.value) || 0)}
              className="w-full bg-transparent text-sm text-ink outline-none tabular-nums"
            />
            <span className="text-xs text-ink-faint shrink-0">cal</span>
          </div>
        </div>

        {/* NOTE */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note..."
          className="w-full bg-ground border border-hair rounded-lg px-3 py-2 text-sm text-ink outline-none transition focus:border-ink/40"
        />

        {/* SAVE BUTTON */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`
            w-full h-12 rounded-xl font-bold
            transition-all duration-300 ease-spring flex items-center justify-center gap-2
            ${
              isSaving
                ? "bg-surface-2 text-ink-faint cursor-not-allowed"
                : saveSuccess
                ? "bg-protein text-ground"
                : "bg-ink text-ground hover:bg-ink/90"
            }
            active:scale-[0.98]
          `}
        >
          {isSaving && (
            <div className="w-4 h-4 border-2 border-ground border-t-transparent rounded-full animate-spin" />
          )}

          {!isSaving && !saveSuccess && "Save Workout"}
          {isSaving && "Saving..."}
          {saveSuccess && "✓ Nice work!"}
        </button>

        {saveSuccess && (
          <p className="text-center text-xs text-protein animate-fade-in">
            Added to your day
          </p>
        )}
      </div>
    </div>
  )
}
