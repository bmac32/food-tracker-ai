"use client"

import { useState, useEffect } from "react"
import { ThumbsDown } from "lucide-react"
import MealImageCarousel from "./MealImageCarousel"
import { fallbackSet } from "@/lib/getSmartFoodImage"

type Props = {
  images: string[]
  imageIndex: number
  onImageChange: (i: number) => void
  onDislikePhoto: (i: number) => void
  onNoneOfThesePhotos: () => void
  analysis: any
  note: string
  setNote: (v: string) => void
  onSave: () => void
  analyzing: boolean
  isSaving: boolean
  saveSuccess: boolean
  onCancel: () => void
}

export default function MealReviewCard({
  images,
  imageIndex,
  onImageChange,
  onDislikePhoto,
  onNoneOfThesePhotos,
  analysis,
  note,
  setNote,
  onSave,
  analyzing,
  isSaving,
  saveSuccess,
  onCancel,
}: Props) {
  const [foods, setFoods] = useState<string[]>(analysis?.foods || [])
  const [newFood, setNewFood] = useState("")

  // keep foods in sync if analysis changes
  useEffect(() => {
    setFoods(analysis?.foods || [])
  }, [analysis])

  if (!analysis) return null

  const handleRemove = (index: number) => {
    setFoods((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAdd = () => {
    if (!newFood.trim()) return
    setFoods((prev) => [...prev, newFood.trim()])
    setNewFood("")
  }

  const handleSave = async () => {
    if (isSaving) return
    analysis.foods = foods
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

      {/* IMAGE — swipeable candidates so a wrong auto-pick can be swapped */}
      <div className="relative">

        {/* CANCEL PREVIEW */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink text-sm transition-all duration-150 ease-spring hover:bg-black/60 hover:scale-110 active:scale-90"
        >
          ✕
        </button>

        {/* THUMBS-DOWN — "this photo is wrong" teaches the picker */}
        <button
          onClick={() => onDislikePhoto(imageIndex)}
          title="This photo isn't right"
          className="absolute top-3 left-3 z-10 w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink/80 transition-all duration-150 ease-spring hover:bg-black/60 hover:text-ink hover:scale-110 active:scale-90"
        >
          <ThumbsDown size={14} />
        </button>

        <MealImageCarousel
          images={
            images.length > 0
              ? images
              : fallbackSet(analysis.meal_name || "meal")
          }
          index={imageIndex}
          onChange={onImageChange}
          className="h-[340px]"
          alt={analysis.meal_name || "Meal photo"}
        />

        {/* gradient — pointer-events-none so swipes pass through to the carousel */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

        {/* title */}
        <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
          <h2 className="text-ink text-lg font-bold tracking-tight">
            {analysis.meal_name}
          </h2>
        </div>
      </div>

      {/* NONE OF THESE — dislike the whole batch, fetch a fresh set */}
      <button
        onClick={onNoneOfThesePhotos}
        className="w-full pt-2 pb-1 text-[11px] text-ink-faint hover:text-ink transition-colors"
      >
        None of these look right — try others
      </button>

      {/* CONTENT */}
      <div className="p-4 space-y-4">

        {/* INGREDIENTS */}
        <div>
          <p className="text-xs text-ink-faint mb-2">Ingredients</p>

          <div className="flex flex-wrap gap-2">
            {foods.map((food, i) => (
              <div
                key={i}
                className="flex items-center gap-1 bg-surface-2 px-2 py-1 rounded-full text-xs text-ink transition-colors duration-150 hover:bg-white/10"
              >
                {food}
                <button
                  onClick={() => handleRemove(i)}
                  className="text-ink-faint transition-all duration-150 ease-spring hover:text-ink active:scale-90"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <input
              value={newFood}
              onChange={(e) => setNewFood(e.target.value)}
              placeholder="Add ingredient"
              className="flex-1 bg-ground border border-hair rounded-lg px-3 py-2 text-xs text-ink outline-none transition focus:border-ink/40"
            />
            <button
              onClick={handleAdd}
              className="px-3 py-2 bg-surface-2 text-ink rounded-lg text-xs transition-all duration-150 ease-spring hover:bg-white/10 active:scale-[0.97]"
            >
              Add
            </button>
          </div>
        </div>

        {/* MACROS */}
        <div className="flex justify-between text-xs font-semibold tabular-nums pt-2 border-t border-hair">
          <span className="text-cal">
            {analysis.calories} calories
          </span>
          <span className="text-protein">
            {analysis.protein} protein
          </span>
          <span className="text-carb">
            {analysis.carbs} carbs
          </span>
          <span className="text-fat">
            {analysis.fat} fat
          </span>
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

          {!isSaving && !saveSuccess && "Save Meal"}
          {isSaving && "Saving..."}
          {saveSuccess && "✓ Saved"}
        </button>

        {/* SUCCESS TEXT */}
        {saveSuccess && (
          <p className="text-center text-xs text-protein animate-fade-in">
            Added to your day
          </p>
        )}

      </div>
    </div>
  )
}