"use client"

import { useState, useEffect } from "react"

type Props = {
  imageUrl: string
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
  imageUrl,
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
  const [imgLoaded, setImgLoaded] = useState(false)

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

  const fallback =
    "https://source.unsplash.com/800x600/?food"

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

        {/* CANCEL PREVIEW */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white text-sm transition-all duration-150 hover:bg-black/60 hover:scale-110 active:scale-90"
        >
          ✕
        </button>

  {/* shimmer (only briefly) */}
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
      setImgLoaded(true) // 🔥 CRITICAL FIX
    }}
    className={`
      w-full h-[340px] object-cover
      transition-opacity duration-500
      ${imgLoaded ? "opacity-100" : "opacity-100"} 
    `}
  />

  {/* gradient */}
  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

  {/* title */}
  <div className="absolute bottom-3 left-4 right-4">
    <h2 className="text-white text-lg font-semibold">
      {analysis.meal_name}
    </h2>
  </div>
</div>

      {/* CONTENT */}
      <div className="p-4 space-y-4">

        {/* INGREDIENTS */}
        <div>
          <p className="text-xs text-[#9AA3B2] mb-2">Ingredients</p>

          <div className="flex flex-wrap gap-2">
            {foods.map((food, i) => (
              <div
                key={i}
                className="flex items-center gap-1 bg-[#232734] px-2 py-1 rounded-full text-xs transition-colors duration-150 hover:bg-[#2A2F3A]"
              >
                {food}
                <button
                  onClick={() => handleRemove(i)}
                  className="text-[#6B7280] transition-all duration-150 hover:text-white active:scale-90"
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
              className="flex-1 bg-[#0F1115] border border-[#232734] rounded-lg px-3 py-2 text-xs outline-none transition focus:border-white/40"
            />
            <button
              onClick={handleAdd}
              className="px-3 py-2 bg-[#232734] rounded-lg text-xs transition-all duration-150 hover:bg-[#2A2F3A] active:scale-[0.97]"
            >
              Add
            </button>
          </div>
        </div>

        {/* MACROS */}
        <div className="flex justify-between text-xs pt-2 border-t border-[#232734]">
          <span className="text-[#E9B949]">
            {analysis.calories} calories
          </span>
          <span className="text-[#6FCF97]">
            {analysis.protein} protein
          </span>
          <span className="text-[#5FA8D3]">
            {analysis.carbs} carbs
          </span>
          <span className="text-[#9B8AFB]">
            {analysis.fat} fat
          </span>
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

          {!isSaving && !saveSuccess && "Save Meal"}
          {isSaving && "Saving..."}
          {saveSuccess && "✓ Saved"}
        </button>

        {/* SUCCESS TEXT */}
        {saveSuccess && (
          <p className="text-center text-xs text-green-400 animate-fade-in">
            Added to your day
          </p>
        )}

      </div>
    </div>
  )
}