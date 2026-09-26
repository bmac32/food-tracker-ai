"use client"

import { useState, useEffect } from "react"
import { ThumbsDown } from "lucide-react"
import MealImageCarousel from "./MealImageCarousel"
import { fallbackSet } from "@/lib/getSmartFoodImage"

// Portion model: every ingredient keeps its AI/USDA baseline and a simple
// multiplier — halves and doubles, not grams. Nobody thinks in grams.
type FoodItem = {
  item: string
  baseGrams: number
  baseProtein: number
  baseCarbs: number
  baseFat: number
  multIdx: number // index into MULTS
  per100: { protein: number; carbs: number; fat: number } | null
}

const MULTS = [0.5, 0.75, 1, 1.5, 2]
const MULT_LABEL: Record<number, string> = {
  0: "½×",
  1: "¾×",
  2: "1×",
  3: "1½×",
  4: "2×",
}

// Muted editorial segment colors for the share bar.
const SEGMENT_COLORS = [
  "#c98f4e",
  "#7ba05b",
  "#5b8dc9",
  "#c96a5b",
  "#9b7fc9",
  "#5bc9b0",
  "#c95b85",
  "#7f8dc9",
]

const r1 = (n: number) => Math.round(n * 10) / 10
const gramsOf = (it: FoodItem) => Math.round(it.baseGrams * MULTS[it.multIdx])
const macrosOf = (it: FoodItem) => {
  const k = MULTS[it.multIdx]
  return {
    protein: r1(it.baseProtein * k),
    carbs: r1(it.baseCarbs * k),
    fat: r1(it.baseFat * k),
  }
}
const calsOf = (m: { protein: number; carbs: number; fat: number }) =>
  m.protein * 4 + m.carbs * 4 + m.fat * 9

function toFoodItems(analysis: any): FoodItem[] {
  if (Array.isArray(analysis?.food_items) && analysis.food_items.length > 0) {
    return analysis.food_items.map((f: any) => ({
      item: String(f.item || "").trim(),
      baseGrams: Number(f.grams) || 0,
      baseProtein: Number(f.protein) || 0,
      baseCarbs: Number(f.carbs) || 0,
      baseFat: Number(f.fat) || 0,
      multIdx: 2,
      per100: f.per100
        ? {
            protein: Number(f.per100.protein) || 0,
            carbs: Number(f.per100.carbs) || 0,
            fat: Number(f.per100.fat) || 0,
          }
        : null,
    }))
  }
  // Legacy analyses: names only, no portion data.
  return (analysis?.foods || []).map((s: string) => ({
    item: String(s),
    baseGrams: 0,
    baseProtein: 0,
    baseCarbs: 0,
    baseFat: 0,
    multIdx: 2,
    per100: null,
  }))
}

function itemTotals(items: FoodItem[]) {
  const protein = r1(items.reduce((s, i) => s + macrosOf(i).protein, 0))
  const carbs = r1(items.reduce((s, i) => s + macrosOf(i).carbs, 0))
  const fat = r1(items.reduce((s, i) => s + macrosOf(i).fat, 0))
  // Atwater 4/4/9 — derived, never independently estimated.
  const calories = Math.round(protein * 4 + carbs * 4 + fat * 9)
  return { protein, carbs, fat, calories }
}

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
  const [items, setItems] = useState<FoodItem[]>(() => toFoodItems(analysis))
  const [newFood, setNewFood] = useState("")
  const [shareMode, setShareMode] = useState<"calories" | "protein">("calories")

  // Portion data only exists on fresh analyses (with food_items).
  const hasPortions = items.some((i) => i.baseGrams > 0 || i.per100)

  // keep items in sync if analysis changes
  useEffect(() => {
    setItems(toFoodItems(analysis))
  }, [analysis])

  if (!analysis) return null

  const shown = hasPortions
    ? itemTotals(items)
    : {
        protein: analysis.protein,
        carbs: analysis.carbs,
        fat: analysis.fat,
        calories: analysis.calories,
      }

  // Share of the meal each ingredient accounts for, in the selected mode.
  const shareValues = items.map((it) => {
    const m = macrosOf(it)
    return shareMode === "calories" ? calsOf(m) : m.protein
  })
  const shareTotal = shareValues.reduce((s, v) => s + v, 0)
  const shares = shareValues.map((v) =>
    shareTotal > 0 ? Math.round((v / shareTotal) * 100) : 0
  )

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAdjust = (index: number, dir: 1 | -1) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              multIdx: Math.min(4, Math.max(0, it.multIdx + dir)),
            }
          : it
      )
    )
  }

  const handleAdd = () => {
    if (!newFood.trim()) return
    setItems((prev) => [
      ...prev,
      {
        item: newFood.trim(),
        baseGrams: 0,
        baseProtein: 0,
        baseCarbs: 0,
        baseFat: 0,
        multIdx: 2,
        per100: null,
      },
    ])
    setNewFood("")
  }

  const handleSave = async () => {
    if (isSaving) return
    analysis.foods = items.map((i) => i.item)
    if (hasPortions) {
      // Persist the refined portions + recomputed macros, not the AI's guess.
      analysis.food_items = items.map((it) => {
        const m = macrosOf(it)
        return {
          item: it.item,
          grams: gramsOf(it),
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          per100: it.per100,
        }
      })
      analysis.protein = shown.protein
      analysis.carbs = shown.carbs
      analysis.fat = shown.fat
      analysis.calories = shown.calories
    }
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
        {/* INGREDIENTS — what the meal is made of, in plain proportions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-ink-faint">
              {hasPortions
                ? shareMode === "calories"
                  ? "Where your calories come from"
                  : "Where your protein comes from"
                : "Ingredients"}
            </p>
            {hasPortions && (
              <div className="flex bg-surface-2 rounded-full p-0.5 text-[11px]">
                {(["calories", "protein"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setShareMode(mode)}
                    className={`px-2.5 py-0.5 rounded-full capitalize transition-all duration-150 active:scale-95 ${
                      shareMode === mode
                        ? "bg-ground text-ink"
                        : "text-ink-faint hover:text-ink"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {hasPortions && (
            <>
              {/* STACKED SHARE BAR */}
              <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-2 mb-1">
                {items.map((it, i) =>
                  shares[i] > 0 ? (
                    <div
                      key={i}
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${shares[i]}%`,
                        backgroundColor:
                          SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                      }}
                    />
                  ) : null
                )}
              </div>
              <p className="text-[11px] text-ink-faint/80 mb-2">
                Tap − / + for less or more — watch the balance shift.
              </p>
            </>
          )}

          {/* INGREDIENT ROWS */}
          <div className="divide-y divide-hair/50">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 py-2">
                {hasPortions && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                    }}
                  />
                )}
                <span className="flex-1 truncate text-xs text-ink">
                  {it.item}
                </span>
                {hasPortions && (
                  <span className="text-[11px] text-ink-faint tabular-nums w-9 text-right shrink-0">
                    {shares[i]}%
                  </span>
                )}
                {hasPortions && it.baseGrams > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleAdjust(i, -1)}
                      title="Less"
                      disabled={it.multIdx === 0}
                      className="w-6 h-6 rounded-full bg-surface-2 border border-hair flex items-center justify-center text-ink-faint transition-all duration-150 ease-spring hover:text-ink active:scale-90 disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-[11px] text-ink tabular-nums">
                      {MULT_LABEL[it.multIdx]}
                    </span>
                    <button
                      onClick={() => handleAdjust(i, 1)}
                      title="More"
                      disabled={it.multIdx === 4}
                      className="w-6 h-6 rounded-full bg-surface-2 border border-hair flex items-center justify-center text-ink-faint transition-all duration-150 ease-spring hover:text-ink active:scale-90 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                )}
                <button
                  onClick={() => handleRemove(i)}
                  className="text-ink-faint transition-all duration-150 ease-spring hover:text-ink active:scale-90 shrink-0"
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

        {/* MACROS — live totals reflect any portion adjustments */}
        <div className="flex justify-between text-xs font-semibold tabular-nums pt-2 border-t border-hair">
          <span className="text-cal">{shown.calories} calories</span>
          <span className="text-protein">{shown.protein} protein</span>
          <span className="text-carb">{shown.carbs} carbs</span>
          <span className="text-fat">{shown.fat} fat</span>
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
