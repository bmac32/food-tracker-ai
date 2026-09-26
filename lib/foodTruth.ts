/**
 * Food truth loop — "correct once, remembered forever."
 *
 * Resolution order for every food item, cheapest and most personal first:
 *   1. HER correction (food_corrections table) — her truth beats everything.
 *   2. USDA FoodData Central lab data (per 100g).
 *   3. The AI's own macro estimate (fallback).
 *
 * Each result carries its source so the UI can be honest about it:
 * numbers the model guessed get a "~", lab data and her corrections don't.
 * As the truth loop and USDA cover more of her foods, the "~"s disappear —
 * the app visibly getting better over time.
 */
import { usdaMacrosFor, type UsdaMacrosPer100g } from "./usda"

export type MacroSource = "yours" | "usda" | "ai"

export type ResolvedMacros = {
  protein: number
  carbs: number
  fat: number
  per100: { protein: number; carbs: number; fat: number } | null
  source: MacroSource
}

/** Canonical key for a food name: "  Dill  Pickles " -> "dill pickles". */
export function normalizeFoodKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

/**
 * Lookup keys to try, most specific first. "dill pickles" also tries
 * "pickles" — a correction for the plain food should cover its variants.
 */
function candidateKeys(name: string): string[] {
  const key = normalizeFoodKey(name)
  if (!key) return []
  const keys = [key]
  const words = key.split(" ")
  if (words.length > 1) keys.push(words.slice(1).join(" "))
  return keys
}

type Correction = {
  protein_per100: number
  carbs_per100: number
  fat_per100: number
}

async function findCorrection(
  supabase: any,
  userId: string,
  item: string,
  cache: Map<string, Correction | null>
): Promise<Correction | null> {
  for (const key of candidateKeys(item)) {
    const cacheKey = `${userId}:${key}`
    if (cache.has(cacheKey)) {
      const hit = cache.get(cacheKey)
      if (hit) return hit
      continue
    }
    try {
      const { data } = await supabase
        .from("food_corrections")
        .select("protein_per100, carbs_per100, fat_per100")
        .eq("user_id", userId)
        .eq("food_key", key)
        .maybeSingle()
      const correction = data
        ? {
            protein_per100: Number(data.protein_per100) || 0,
            carbs_per100: Number(data.carbs_per100) || 0,
            fat_per100: Number(data.fat_per100) || 0,
          }
        : null
      cache.set(cacheKey, correction)
      if (correction) return correction
    } catch {
      cache.set(cacheKey, null)
    }
  }
  return null
}

const r1 = (n: number) => Math.round(n * 10) / 10

function scale(per100: UsdaMacrosPer100g, grams: number) {
  const k = grams / 100
  return {
    protein: r1(per100.protein * k),
    carbs: r1(per100.carbs * k),
    fat: r1(per100.fat * k),
    per100: {
      protein: r1(per100.protein),
      carbs: r1(per100.carbs),
      fat: r1(per100.fat),
    },
  }
}

/**
 * Resolve the best macros for one food item at a serving size.
 * `fallback` is the AI's own estimate, used only when nothing better exists.
 */
export async function resolveFoodMacros(opts: {
  supabase: any
  userId: string
  item: string
  grams: number
  fallback: { protein: number; carbs: number; fat: number }
  /** Per-request correction cache (user-scoped). Created fresh per call site. */
  cache?: Map<string, Correction | null>
}): Promise<ResolvedMacros> {
  const { supabase, userId, item, grams, fallback } = opts
  const cache = opts.cache ?? new Map<string, Correction | null>()
  const ai = {
    protein: r1(fallback.protein),
    carbs: r1(fallback.carbs),
    fat: r1(fallback.fat),
    per100: null,
    source: "ai" as MacroSource,
  }

  // 1. Her correction — but only when we know the serving size, since
  // corrections are stored per 100g and must be scaled to the portion.
  if (grams > 0) {
    const correction = await findCorrection(supabase, userId, item, cache)
    if (correction) {
      return {
        ...scale(
          {
            protein: correction.protein_per100,
            carbs: correction.carbs_per100,
            fat: correction.fat_per100,
          },
          grams
        ),
        source: "yours",
      }
    }
  }

  // 2. USDA lab data.
  if (grams > 0) {
    const per100 = await usdaMacrosFor(item)
    if (per100) return { ...scale(per100, grams), source: "usda" }
  }

  // 3. AI estimate — honest fallback, flagged so the UI can show "~".
  return ai
}

/** Convert serving-level macros to per-100g for storing a correction. */
export function servingToPer100(
  protein: number,
  carbs: number,
  fat: number,
  grams: number
): { protein: number; carbs: number; fat: number } | null {
  if (!(grams > 0)) return null
  const k = 100 / grams
  return {
    protein: r1(protein * k),
    carbs: r1(carbs * k),
    fat: r1(fat * k),
  }
}
