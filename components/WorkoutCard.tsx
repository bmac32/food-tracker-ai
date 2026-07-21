"use client"

import { useState } from "react"
import { Flame, SlidersHorizontal } from "lucide-react"
import { getUserProfile, lbsToKg } from "@/lib/getUserProfile"
import {
  WORKOUT_META_BY_TYPE,
  estimateCaloriesBurned,
  type WorkoutType,
} from "@/lib/workoutMeta"

type Workout = {
  id: string
  created_at: string
  workout_type: WorkoutType
  duration_minutes: number
  calories_burned: number
  photo_url: string | null
  note: string | null
}

type Props = {
  workout: Workout
  isDeleting: boolean
  onDelete: () => void
  onUpdate: (updates: Partial<Workout>) => Promise<void>
}

export default function WorkoutCard({
  workout,
  isDeleting,
  onDelete,
  onUpdate,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editDuration, setEditDuration] = useState(
    String(workout.duration_minutes)
  )
  const [editCalories, setEditCalories] = useState(workout.calories_burned)
  const [editNote, setEditNote] = useState(workout.note || "")
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const meta = WORKOUT_META_BY_TYPE[workout.workout_type]
  const Icon = meta?.icon || Flame

  const imageSrc =
    workout.photo_url ||
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"

  const startEditing = () => {
    setEditDuration(String(workout.duration_minutes))
    setEditCalories(workout.calories_burned)
    setEditNote(workout.note || "")
    setIsEditing(true)
  }

  const handleDurationChange = async (value: string) => {
    setEditDuration(value)

    const minutes = parseFloat(value)
    if (!minutes || minutes <= 0) return

    const profile = await getUserProfile()
    const weightKg = profile?.weight ? lbsToKg(profile.weight) : undefined
    setEditCalories(
      estimateCaloriesBurned(workout.workout_type, minutes, weightKg)
    )
  }

  const handleSaveEdit = async () => {
    const minutes = Math.round(parseFloat(editDuration))
    if (!minutes || minutes <= 0 || isSavingEdit) return

    setIsSavingEdit(true)

    await onUpdate({
      duration_minutes: minutes,
      calories_burned: editCalories,
      note: editNote || null,
    })

    setIsSavingEdit(false)
    setIsEditing(false)
  }

  return (
    <div
      className={`bg-surface border border-hair rounded-[22px] overflow-hidden transition-all duration-300 ease-spring animate-fade-slide-up ${
        isDeleting
          ? "opacity-0 scale-95"
          : "opacity-100 scale-100 hover:scale-[1.01] active:scale-[0.99] hover:border-hair-strong hover:shadow-lg hover:shadow-black/20"
      }`}
    >
      <div className="relative">
        <img src={imageSrc} className="w-full h-[260px] object-cover" />

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <button
          onClick={startEditing}
          className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink transition-all duration-150 ease-spring hover:bg-black/60 active:scale-90"
        >
          <SlidersHorizontal size={16} />
        </button>

        <button
          onClick={onDelete}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink transition-all duration-150 ease-spring hover:bg-burn/30 hover:border-burn/50 active:scale-90"
        >
          ✕
        </button>

        <div className="absolute top-3 left-14 flex items-center gap-1.5 bg-burn/20 border border-burn/40 backdrop-blur-md px-2.5 py-1 rounded-full">
          <Icon size={13} className="text-burn" />
          <span className="text-xs font-bold text-[#ffb3c1]">
            {meta?.label || "Workout"}
          </span>
        </div>

        <div className="absolute bottom-3 left-4 right-4">
          <h2 className="text-ink text-base font-bold tracking-tight">
            {meta?.label || "Workout"} · {workout.duration_minutes} min
          </h2>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-ink-faint mb-1">
                Duration (minutes)
              </p>
              <input
                type="number"
                value={editDuration}
                onChange={(e) => handleDurationChange(e.target.value)}
                className="w-full bg-surface-2 rounded-xl px-3 py-2 text-sm text-ink outline-none transition focus:ring-1 focus:ring-ink/30"
              />
            </div>

            <div>
              <p className="text-[11px] text-ink-faint mb-1">
                Calories burned
              </p>
              <input
                type="number"
                value={editCalories}
                onChange={(e) => setEditCalories(Number(e.target.value) || 0)}
                className="w-full bg-surface-2 rounded-xl px-3 py-2 text-sm text-ink outline-none transition focus:ring-1 focus:ring-ink/30"
              />
            </div>

            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Add a note..."
              className="w-full bg-surface-2 rounded-xl p-3 text-sm text-ink outline-none transition focus:ring-1 focus:ring-ink/30"
            />

            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className={`flex-1 py-2 rounded-lg text-sm transition-all duration-200 ease-spring active:scale-[0.97] ${
                  isSavingEdit
                    ? "bg-surface-2 text-ink-faint cursor-not-allowed"
                    : "bg-ink text-ground hover:bg-ink/90"
                }`}
              >
                {isSavingEdit ? "Saving..." : "Save"}
              </button>

              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2 rounded-lg bg-surface-2 text-ink text-sm transition-all duration-150 ease-spring hover:bg-white/10 active:scale-[0.97]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
              <Flame size={14} className="text-burn" />
              <span className="bg-gradient-to-r from-cal to-burn bg-clip-text text-transparent">
                {workout.calories_burned} cal burned
              </span>
            </div>

            {workout.note && (
              <p className="text-sm text-ink">{workout.note}</p>
            )}

            <div className="text-[10px] text-right text-ink-faint pt-1">
              {new Date(workout.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
