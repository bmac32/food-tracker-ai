"use client"

import { useState, useEffect } from "react"
import { ThumbsDown } from "lucide-react"
import PortionBalance, { type TeachMacros } from "./PortionBalance"
import MealImageCarousel from "./MealImageCarousel"
import { fallbackSet } from "@/lib/getSmartFoodImage"

// Per-item breakdown from the analyzer (USDA-verified where possible).
// Read-only: the card informs the portion balance, it never asks for tweaks.
type FoodItem = {
  item: string
  grams: number
  protein: number
  carbs: number
  fat: number
  per100: { protein: number; carbs: number; fat: number } | null
  source?: string
  /** "hers" once she confirms the portion — until then the AI guessed it. */
  gramsSource?: string
}

const r1 = (n: number) => Math.round(n * 10) / 10

function toFoodItems(analysis: any): FoodItem[] {
  if (Array.isArray(analysis?.food_items) && analysis.food_items.length > 0) {
    return analysis.food_items.map((f: any) => ({
      item: String(f.item || "").trim(),
      grams: Number(f.grams) || 0,
      protein: Number(f.protein) || 0,
      carbs: Number(f.carbs) || 0,
      fat: Number(f.fat) || 0,
      per100: f.per100
        ? {
            protein: Number(f.per100.protein) || 0,
            carbs: Number(f.per100.carbs) || 0,
            fat: Number(f.per100.fat) || 0,
          }
        : null,
      source: typeof f.source === "string" ? f.source : undefined,
      gramsSource:
        typeof f.gramsSource === "string" ? f.gramsSource : undefined,
    }))
  }
  // Legacy analyses: names only, no portion data.
  return (analysis?.foods || []).map((s: string) => ({
    item: String(s),
    grams: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    per100: null,
  }))
}

function itemTotals(items: FoodItem[]) {
  const protein = r1(items.reduce((s, i) => s + i.protein, 0))
  const carbs = r1(items.reduce((s, i) => s + i.carbs, 0))
  const fat = r1(items.reduce((s, i) => s + i.fat, 0))
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
  /** True when the photo is the user's own upload — no picker feedback needed. */
  isUserPhoto?: boolean
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
  isUserPhoto,
}: Props) {
  const [items, setItems] = useState<FoodItem[]>(() => toFoodItems(analysis))
  const [newFood, setNewFood] = useState("")

  // Portion data only exists on fresh analyses (with food_items).
  const hasPortions = items.some((i) => i.grams > 0 || i.per100)

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

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const [addingFood, setAddingFood] = useState(false)

  // Added ingredients go through the same truth pipeline as the analysis
  // (her correction -> USDA -> AI estimate) instead of landing as blank
  // rows — so they show up in portions and totals, marked "~" like the rest.
  const handleAdd = async () => {
    if (!newFood.trim() || addingFood) return
    const name = newFood.trim()
    setAddingFood(true)
    const blank = (): FoodItem => ({
      item: name,
      grams: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      per100: null,
      source: "ai",
      gramsSource: "ai",
    })
    try {
      const res = await fetch("/api/meals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: name }),
      })
      const data = await res.json().catch(() => null)
      const resolved = Array.isArray(data?.food_items) ? data.food_items : []
      if (!res.ok || resolved.length === 0) {
        setItems((prev) => [...prev, blank()])
      } else {
        setItems((prev) => [
          ...prev,
          ...resolved.map(
            (f: any): FoodItem => ({
              item: String(f.item || name).trim(),
              grams: Number(f.grams) || 0,
              protein: Number(f.protein) || 0,
              carbs: Number(f.carbs) || 0,
              fat: Number(f.fat) || 0,
              per100: f.per100
                ? {
                    protein: Number(f.per100.protein) || 0,
                    carbs: Number(f.per100.carbs) || 0,
                    fat: Number(f.per100.fat) || 0,
                  }
                : null,
              source: typeof f.source === "string" ? f.source : "ai",
              gramsSource: "ai",
            })
          ),
        ])
      }
    } catch {
      setItems((prev) => [...prev, blank()])
    } finally {
      setAddingFood(false)
      setNewFood("")
    }
  }

  // Teach-the-app: save the correction as this food's truth (remembered
  // for all future meals) and apply it to this meal's numbers right away.
  const handleTeach = async (
    item: string,
    grams: number,
    macros: TeachMacros
  ) => {
    const res = await fetch("/api/food-corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        food: item,
        grams,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      }),
    })
    if (!res.ok) throw new Error("Couldn't save the correction.")
    // The corrected per-100g values, so the portion bar rescales correctly.
    const per100 =
      grams > 0
        ? {
            protein: r1((macros.protein * 100) / grams),
            carbs: r1((macros.carbs * 100) / grams),
            fat: r1((macros.fat * 100) / grams),
          }
        : null
    setItems((prev) =>
      prev.map((it) =>
        it.item === item
          ? {
              ...it,
              grams: grams > 0 ? r1(grams) : it.grams,
              protein: macros.protein,
              carbs: macros.carbs,
              fat: macros.fat,
              per100: per100 ?? it.per100,
              source: "yours",
              // The portion source is untouched by a macro correction —
              // portions are learned silently from her logging instead.
            }
          : it
      )
    )
  }

  // Honest "~": a total is exact only when every item's per-100g values
  // AND its portion are both trusted. Portions earn trust silently — once
  // the app has seen the food 3+ times and she has taught it once.
  const estimated = items.some(
    (i) =>
      (i.source !== "yours" && i.source !== "usda") ||
      (i.gramsSource !== "hers" &&
        i.gramsSource !== "learned" &&
        i.gramsSource !== "typical")
  )

  const handleSave = async () => {
    if (isSaving) return
    analysis.foods = items.map((i) => i.item)
    if (hasPortions) {
      analysis.food_items = items
      analysis.protein = shown.protein
      analysis.carbs = shown.carbs
      analysis.fat = shown.fat
      analysis.calories = shown.calories
      analysis.estimated = estimated
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

        {/* THUMBS-DOWN — "this photo is wrong" teaches the picker.
            Hidden for user-uploaded photos: she has the right photo already. */}
        {!isUserPhoto && (
          <button
            onClick={() => onDislikePhoto(imageIndex)}
            title="This photo isn't right"
            className="absolute top-3 left-3 z-10 w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink/80 transition-all duration-150 ease-spring hover:bg-black/60 hover:text-ink hover:scale-110 active:scale-90"
          >
            <ThumbsDown size={14} />
          </button>
        )}

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
          {(analysis.photos_analyzed ?? 1) > 1 && (
            <p className="text-ink-dim text-xs mt-0.5">
              Analyzed {analysis.photos_analyzed} photos as one meal
            </p>
          )}
        </div>
      </div>

      {/* NONE OF THESE — dislike the whole batch, fetch a fresh set.
          Hidden for user-uploaded photos: no batch to replace. */}
      {!isUserPhoto && (
        <button
          onClick={onNoneOfThesePhotos}
          className="w-full pt-2 pb-1 text-[11px] text-ink-faint hover:text-ink transition-colors"
        >
          None of these look right — try others
        </button>
      )}

      {/* CONTENT */}
      <div className="p-4 space-y-4">
        {/* INGREDIENTS */}
        <div>
          <p className="text-xs text-ink-faint mb-2">Ingredients</p>

          <div className="flex flex-wrap gap-2">
            {items.map((it, i) => (
              <div
                key={i}
                className="flex items-center gap-1 bg-surface-2 pl-2.5 pr-1 py-1 rounded-full text-xs text-ink transition-colors duration-150 hover:bg-white/10"
              >
                <span className="max-w-[130px] truncate">{it.item}</span>
                <button
                  onClick={() => handleRemove(i)}
                  className="text-ink-faint transition-all duration-150 ease-spring hover:text-ink active:scale-90 pr-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* PORTION BALANCE — hidden until asked for. Inform, don't instruct:
              the share bar lets the "huh, my portions are off" moment happen
              on its own. No steppers, no judgment. */}
          <div className="flex gap-2 mt-3">
            <input
              value={newFood}
              onChange={(e) => setNewFood(e.target.value)}
              placeholder="Add ingredient"
              className="flex-1 bg-ground border border-hair rounded-lg px-3 py-2 text-xs text-ink outline-none transition focus:border-ink/40"
            />
            <button
              onClick={handleAdd}
              disabled={addingFood}
              className="px-3 py-2 bg-surface-2 text-ink rounded-lg text-xs transition-all duration-150 ease-spring hover:bg-white/10 active:scale-[0.97] disabled:opacity-50"
            >
              {addingFood ? "…" : "Add"}
            </button>
          </div>
        </div>

        {/* MACROS — "~" when any item is still an AI estimate */}
        <div className="flex justify-between text-xs font-semibold tabular-nums pt-2 border-t border-hair">
          <span className="text-cal">{estimated ? "~" : ""}{shown.calories} calories</span>
          <span className="text-protein">{estimated ? "~" : ""}{shown.protein} protein</span>
          <span className="text-carb">{estimated ? "~" : ""}{shown.carbs} carbs</span>
          <span className="text-fat">{estimated ? "~" : ""}{shown.fat} fat</span>
        </div>

        {/* PORTION BALANCE — breakdown of the totals above */}
        <PortionBalance
          items={hasPortions ? items : []}
          teachable
          onTeach={handleTeach}
        />

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
