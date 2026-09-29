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
  /**
   * True when the portion came from her usual-portion history because the
   * analyzer reported no grams. The call site stamps gramsSource "typical".
   */
  usedTypicalPortion?: boolean
}

/** Canonical key for a food name: "  Dill  Pickles " -> "dill pickles". */
export function normalizeFoodKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

/**
 * Correction matching — "correct once, remembered forever" has to survive
 * the analyzer naming things slightly differently.
 *
 * The old approach tried the exact name plus the name minus its first word,
 * so "cappuccino with oat milk" never found her "cappuccino" correction.
 * Now: her corrections load once per request, and the longest stored
 * correction whose phrase appears in the item name wins — "cappuccino
 * with oat milk" and "iced cappuccino" both find "cappuccino".
 * Whole-word matching only, so "tea" never matches "steak".
 */

// Words that carry no food meaning — dropped before matching.
const STOPWORDS = new Set([
  "with",
  "and",
  "or",
  "of",
  "a",
  "an",
  "the",
  "in",
  "on",
  "to",
  "for",
])

/** Tiny stemmer so "blueberries" matches "blueberry" (applied to both sides). */
function stemWord(w: string): string {
  let s = w.toLowerCase()
  if (s.length > 3) {
    if (s.endsWith("ies")) s = s.slice(0, -3) + "y"
    else if (/(oes|ses|xes|zes|ches|shes)$/.test(s)) s = s.slice(0, -2)
    else if (s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1)
  }
  return s
}

/**
 * Stemmed content words: "  Cappuccino with Oat Milk " ->
 * ["cappuccino", "oat", "milk"].
 */
function contentWords(name: string): string[] {
  return normalizeFoodKey(name)
    .split(" ")
    .map(stemWord)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
}

/** True when every word of `phrase` appears contiguously inside `words`. */
function containsPhrase(words: string[], phrase: string[]): boolean {
  if (phrase.length === 0 || phrase.length > words.length) return false
  for (let i = 0; i <= words.length - phrase.length; i++) {
    let ok = true
    for (let j = 0; j < phrase.length; j++) {
      if (words[i + j] !== phrase[j]) {
        ok = false
        break
      }
    }
    if (ok) return true
  }
  return false
}

type Correction = {
  food_key: string
  protein_per100: number
  carbs_per100: number
  fat_per100: number
}

/**
 * Her corrections, loaded once per request (one query, not one per food).
 * Cached on the request cache the call site passes in.
 */
async function loadCorrections(
  supabase: any,
  userId: string,
  cache: Map<string, any>
): Promise<Correction[]> {
  const cacheKey = `corrections:${userId}`
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? []
  try {
    const { data } = await supabase
      .from("food_corrections")
      .select("food_key, protein_per100, carbs_per100, fat_per100")
      .eq("user_id", userId)
    const list: Correction[] = (Array.isArray(data) ? data : [])
      .map((d: any) => ({
        food_key: String(d.food_key || ""),
        protein_per100: Number(d.protein_per100) || 0,
        carbs_per100: Number(d.carbs_per100) || 0,
        fat_per100: Number(d.fat_per100) || 0,
      }))
      .filter((c) => c.food_key.length > 0)
    cache.set(cacheKey, list)
    return list
  } catch {
    cache.set(cacheKey, [])
    return []
  }
}

/**
 * Find her correction for an item: exact match first, then the longest
 * stored correction whose phrase appears in the item name.
 */
function matchCorrection(
  item: string,
  corrections: Correction[]
): Correction | null {
  const key = normalizeFoodKey(item)
  if (!key) return null
  const exact = corrections.find((c) => c.food_key === key)
  if (exact) return exact
  const words = contentWords(key)
  if (words.length === 0) return null
  let best: Correction | null = null
  let bestLen = 0
  for (const c of corrections) {
    const cw = contentWords(c.food_key)
    if (cw.length <= bestLen) continue
    if (containsPhrase(words, cw)) {
      best = c
      bestLen = cw.length
    }
  }
  return best
}

async function findCorrection(
  supabase: any,
  userId: string,
  item: string,
  cache: Map<string, any>
): Promise<Correction | null> {
  const corrections = await loadCorrections(supabase, userId, cache)
  return matchCorrection(item, corrections)
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
 * `typicalGrams` is her usual portion for this food — used only when the
 * analyzer reported no grams (gram-less drinks, ambiguous portions), so her
 * correction and USDA lab data scale to a real serving instead of being
 * silently skipped.
 */
export async function resolveFoodMacros(opts: {
  supabase: any
  userId: string
  item: string
  grams: number
  typicalGrams?: number
  fallback: { protein: number; carbs: number; fat: number }
  /** Per-request cache (user-scoped). Created fresh per call site. */
  cache?: Map<string, any>
}): Promise<ResolvedMacros> {
  const { supabase, userId, item, grams, fallback } = opts
  const cache = opts.cache ?? new Map<string, any>()
  const ai: ResolvedMacros = {
    protein: r1(fallback.protein),
    carbs: r1(fallback.carbs),
    fat: r1(fallback.fat),
    per100: null,
    source: "ai" as MacroSource,
    usedTypicalPortion: false,
  }

  // Serving size: the analyzer's grams when it has them; her usual portion
  // when it doesn't. Her history beats skipping her correction entirely.
  const typical = Number(opts.typicalGrams) || 0
  const effGrams = grams > 0 ? grams : typical
  const usedTypical = grams <= 0 && typical > 0

  // 1. Her correction — scaled to the serving, or to her usual portion
  //    when the analyzer gave no grams.
  if (effGrams > 0) {
    const correction = await findCorrection(supabase, userId, item, cache)
    if (correction) {
      return {
        ...scale(
          {
            protein: correction.protein_per100,
            carbs: correction.carbs_per100,
            fat: correction.fat_per100,
          },
          effGrams
        ),
        source: "yours",
        usedTypicalPortion: usedTypical,
      }
    }
  }

  // 2. USDA lab data — same portion fallback.
  if (effGrams > 0) {
    const per100 = await usdaMacrosFor(item)
    if (per100) {
      return {
        ...scale(per100, effGrams),
        source: "usda",
        usedTypicalPortion: usedTypical,
      }
    }
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

// ---------------------------------------------------------------------------
// Silent portion learning — "the app knows her."
//
// Every logged meal and every teach correction records the food's portion
// grams (no UI, no admin). The analyzer gets her usual portions as defaults
// so first guesses land near her reality, and a portion counts as "learned"
// (clean number, no "~") once a food has been seen 3+ times AND taught once.
// ---------------------------------------------------------------------------

export type PortionProfileEntry = {
  food_key: string
  food_label: string
  typical_grams: number
  samples: number
  taught: boolean
}

/** Her learned portions, most-sampled first. Server-side; RLS keeps it hers. */
export async function getPortionProfile(
  supabase: any,
  userId: string,
  limit = 200
): Promise<PortionProfileEntry[]> {
  try {
    const { data } = await supabase
      .from("portion_profile")
      .select("food_key, food_label, typical_grams, samples, taught")
      .eq("user_id", userId)
      .order("samples", { ascending: false })
      .limit(limit)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/**
 * Compact prompt hint so the model's first portion guesses land near her
 * reality instead of a stranger's. Only foods seen 2+ times — avoids
 * biasing the model on one-offs.
 */
export function portionPromptHint(profile: PortionProfileEntry[]): string {
  const rows = profile.filter((p) => p.samples >= 2).slice(0, 30)
  if (rows.length === 0) return ""
  const lines = rows.map(
    (p) =>
      `- ${p.food_label}: ${Math.round(Number(p.typical_grams))}g (her usual, seen ${p.samples}x)`
  )
  return `\n\nHer usual portions — default to these unless the photo or description clearly shows otherwise:\n${lines.join("\n")}`
}

/** A portion earns a clean number (no "~") once seen 3+ times and taught once. */
export function isLearnedPortion(p: PortionProfileEntry | undefined): boolean {
  return !!p && p.samples >= 3 && p.taught
}

/**
 * Her usual portion grams for an item — exact profile hit first, then the
 * longest profile entry whose phrase appears in the item name (same
 * matching as corrections). Returns 0 when the app hasn't seen the food.
 */
export function typicalGramsFor(
  item: string,
  profile: PortionProfileEntry[]
): number {
  const key = normalizeFoodKey(item)
  if (!key || !Array.isArray(profile) || profile.length === 0) return 0
  const exact = profile.find((p) => p.food_key === key)
  const exactGrams = Number(exact?.typical_grams) || 0
  if (exactGrams > 0) return exactGrams
  const words = contentWords(key)
  if (words.length === 0) return 0
  let best: PortionProfileEntry | null = null
  let bestLen = 0
  for (const p of profile) {
    const cw = contentWords(p.food_key)
    if (cw.length <= bestLen) continue
    if (containsPhrase(words, cw)) {
      best = p
      bestLen = cw.length
    }
  }
  return Number(best?.typical_grams) || 0
}
