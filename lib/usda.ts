/**
 * USDA FoodData Central lookup — the "big tracker" accuracy tier.
 *
 * The AI identifies foods and estimates portion grams; this module verifies
 * each item against lab-measured USDA data (per 100g) instead of letting
 * the model guess macros from vibes. Priority: Foundation > SR Legacy
 * (both per-100g, lab analyzed), then Branded (manufacturer data, scaled
 * from its serving size).
 *
 * Needs USDA_API_KEY (free signup, no card: fdc.nal.usda.gov/api-key-signup.html).
 * When the key is missing or a lookup fails, callers fall back to the
 * AI's own macro estimates — never a hard error.
 */

export type UsdaMacrosPer100g = {
  protein: number
  carbs: number
  fat: number
}

const BASE = "https://api.nal.usda.gov/fdc/v1"
// USDA nutrient IDs — stable across data types.
const NUTRIENT = { protein: 1003, fat: 1004, carbs: 1005 } as const

// In-memory cache: normalized food name -> macros per 100g (null = no match).
// Good enough for a single instance; also keeps us far under the 1000/hr quota.
const cache = new Map<string, UsdaMacrosPer100g | null>()

function getKey(): string | null {
  return process.env.USDA_API_KEY || null
}

async function search(
  query: string,
  dataType: string,
  apiKey: string
): Promise<any[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    query,
    dataType,
    pageSize: "5",
  })
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(`${BASE}/foods/search?${params.toString()}`, {
      signal: ctrl.signal,
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.foods) ? data.foods : []
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

/** Pull protein/carbs/fat per 100g out of a search hit. Handles both
 *  per-100g data types (Foundation/SR Legacy) and per-serving Branded. */
function macrosFromHit(hit: any): UsdaMacrosPer100g | null {
  const byId = new Map<number, number>()
  for (const n of hit?.foodNutrients || []) {
    if (typeof n?.nutrientId === "number" && typeof n?.value === "number") {
      byId.set(n.nutrientId, n.value)
    }
  }
  let protein = byId.get(NUTRIENT.protein) ?? 0
  let fat = byId.get(NUTRIENT.fat) ?? 0
  let carbs = byId.get(NUTRIENT.carbs) ?? 0

  // Branded entries report per serving — convert to per 100g.
  const servingG = Number(hit?.servingSize)
  if (hit?.dataType === "Branded" && servingG > 0) {
    const k = 100 / servingG
    protein *= k
    fat *= k
    carbs *= k
  }

  // Sanity: a real food entry should have at least one nonzero macro.
  if (protein + fat + carbs <= 0) return null
  return { protein, carbs, fat }
}

/**
 * Best-effort lab-verified macros per 100g for a plain food name like
 * "scrambled eggs". Returns null when the key is missing, the network
 * fails, or nothing matches — callers must fall back gracefully.
 */
export async function usdaMacrosFor(
  food: string
): Promise<UsdaMacrosPer100g | null> {
  const name = food.toLowerCase().trim()
  if (!name) return null
  if (cache.has(name)) return cache.get(name)!

  const apiKey = getKey()
  if (!apiKey) return null // no key -> caller uses AI estimates

  try {
    // Lab-analyzed data first (per 100g, no conversion needed).
    let hits = await search(name, "Foundation,SR Legacy", apiKey)
    let macros = hits.length ? macrosFromHit(hits[0]) : null

    // Manufacturer data as a second chance (scaled from serving size).
    if (!macros) {
      hits = await search(name, "Branded", apiKey)
      macros = hits.length ? macrosFromHit(hits[0]) : null
    }

    cache.set(name, macros)
    return macros
  } catch {
    cache.set(name, null)
    return null
  }
}
