/**
 * Food photo lookup — goes through our own /api/food-image proxy so the
 * Unsplash access key stays server-side (see app/api/food-image/route.ts).
 * The old NEXT_PUBLIC_UNSPLASH_ACCESS_KEY env var is no longer used;
 * set server-only UNSPLASH_ACCESS_KEY instead.
 */

const U = (id: string) =>
  `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`

/**
 * Category fallback sets — used whenever Unsplash can't deliver (no key,
 * no results, rate-limited). Every ID below was verified to resolve
 * (2026-09-25). Each category carries several images so the carousel can
 * offer relevant alternatives: frozen yogurt only ever shows frozen-treat
 * photos, never a burger.
 */
const CATEGORY_FALLBACKS: { match: RegExp; ids: string[] }[] = [
  {
    match: /salad|bowl|veggie|vegetable|greens|kale/i,
    ids: [
      "photo-1546069901-ba9599a7e63c",
      "photo-1512621776951-a57141f2eefd",
      "photo-1540189549336-e6e99c3679fe",
      "photo-1490818387583-1baba5e638af",
    ],
  },
  {
    match: /pizza|flatbread|calzone/i,
    ids: [
      "photo-1565299624946-b28f40a0ae38",
      "photo-1574071318508-1cdbab80d002",
      "photo-1513104890138-7c749659a591",
    ],
  },
  {
    match: /burger|sandwich|wrap|burrito|taco|quesadilla|panini/i,
    ids: [
      "photo-1568901346375-23c9450c58cd",
      "photo-1553979459-d2229ba7433b",
      "photo-1571091718767-18b5b1457add",
      "photo-1550547660-d9450f859349",
    ],
  },
  {
    match: /egg|pancake|waffle|toast|oatmeal|cereal|breakfast|granola/i,
    ids: [
      "photo-1484723091739-30a097e8f929",
      "photo-1525351484163-7529414344d8",
      "photo-1504754524776-8f4f37790ca0",
      "photo-1567620905732-2d1ec7ab7445",
    ],
  },
  {
    match:
      /cake|cookie|ice cream|dessert|chocolate|brownie|donut|yogurt|frozen|gelato|smoothie|shake|sorbet|parfait|mousse|pudding/i,
    ids: [
      "photo-1565958011703-44f9829ba187",
      "photo-1563805042-7684c019e1cb",
      "photo-1488900128323-21503983a07e",
      "photo-1551024506-0bccd828d307",
      "photo-1578985545062-69928b1d9587",
    ],
  },
  {
    match: /noodle|ramen|pho|sushi|stir fry|stir-fry|fried rice|curry|pad thai|dumpling/i,
    ids: [
      "photo-1585032226651-759b368d7246",
      "photo-1569718212165-3a8278d5f624",
      "photo-1455619452474-d2be8b1e70cd",
      "photo-1512058564366-18510be2db19",
    ],
  },
]

const GENERIC_IDS = [
  "photo-1504674900247-0877df9cc836",
  "photo-1493770348161-369560ae357d",
  "photo-1414235077428-338989a2e8c0",
]

function categoryIds(mealName?: string): string[] | null {
  if (!mealName) return null
  for (const c of CATEGORY_FALLBACKS) {
    if (c.match.test(mealName)) return c.ids
  }
  return null
}

export function fallbackImage(mealName?: string): string {
  const ids = categoryIds(mealName) ?? GENERIC_IDS
  return U(ids[0])
}

/**
 * A swipeable set of fallbacks drawn from ONE category, so every
 * alternative is relevant to the meal. Deterministic rotation by meal
 * name so different meals don't all open on the same picture.
 */
export function fallbackSet(mealName?: string): string[] {
  const ids = categoryIds(mealName) ?? GENERIC_IDS
  let h = 0
  for (const ch of mealName || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const offset = ids.length ? h % ids.length : 0
  const rotated = [...ids.slice(offset), ...ids.slice(0, offset)]
  return rotated.map(U)
}

export type ImageLookupOpts = {
  /** 3-6 word photo search from the AI analysis — best query source. */
  imageQuery?: string
  /** URLs already used by other meals today — excluded so the day view
   *  doesn't repeat the same photo. */
  exclude?: string[]
}

export async function getSmartFoodImage(
  mealName: string,
  foods?: string[],
  opts?: ImageLookupOpts
) {
  const urls = await getSmartFoodImages(mealName, foods, opts)
  return urls[0] || fallbackImage(mealName)
}

/**
 * Returns up to 6 candidate photo URLs so the UI can offer a swipeable
 * picker when the first pick doesn't match the meal.
 */
export async function getSmartFoodImages(
  mealName: string,
  foods?: string[],
  opts?: ImageLookupOpts
): Promise<string[]> {
  try {
    // Best query first: the AI's plated-dish description, then the meal
    // name, then the ingredient list as a last resort.
    const query =
      opts?.imageQuery?.trim() ||
      mealName.trim() ||
      (foods?.length ? foods.slice(0, 3).join(" ") : "") ||
      "meal"

    const params = new URLSearchParams({ q: query })
    if (opts?.exclude?.length) {
      params.set("exclude", opts.exclude.join(","))
    }

    const res = await fetch(`/api/food-image?${params.toString()}`)

    if (!res.ok) return fallbackSet(mealName)

    const data = await res.json()
    // Server signals fallback:true when the key is missing or the search
    // failed — use a category-matched fallback instead of its generic one.
    if (data.fallback) return fallbackSet(mealName)

    const urls = Array.isArray(data.urls)
      ? data.urls.filter((u: any) => typeof u === "string")
      : []
    if (data.url && !urls.includes(data.url)) urls.unshift(data.url)
    return urls.length > 0 ? urls : [fallbackImage(mealName)]
  } catch (err) {
    console.error("Food image lookup failed", err)
    return fallbackSet(mealName)
  }
}
