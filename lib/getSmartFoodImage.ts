/**
 * Food photo lookup — goes through our own /api/food-image proxy so the
 * Unsplash access key stays server-side (see app/api/food-image/route.ts).
 * The old NEXT_PUBLIC_UNSPLASH_ACCESS_KEY env var is no longer used;
 * set server-only UNSPLASH_ACCESS_KEY instead.
 */

const U = (id: string) =>
  `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`

/** Category fallbacks — used whenever Unsplash can't deliver (no key,
 *  no results, rate-limited). Keyed off the meal name so different meals
 *  get different images instead of one shared fallback. */
const CATEGORY_FALLBACKS: { match: RegExp; url: string }[] = [
  { match: /salad|bowl|veggie|vegetable|greens|kale/i, url: U("photo-1546069901-ba9599a7e63c") },
  { match: /pizza|flatbread/i, url: U("photo-1565299624946-b28f40a0ae38") },
  { match: /burger|sandwich|wrap|burrito|taco/i, url: U("photo-1568901346375-23c9450c58cd") },
  { match: /egg|pancake|waffle|toast|oatmeal|cereal|breakfast|granola/i, url: U("photo-1484723091739-30a097e8f929") },
  { match: /cake|cookie|ice cream|dessert|chocolate|brownie|donut/i, url: U("photo-1565958011703-44f9829ba187") },
]

const GENERIC_FALLBACK = U("photo-1504674900247-0877df9cc836")

export function fallbackImage(mealName?: string): string {
  if (mealName) {
    for (const c of CATEGORY_FALLBACKS) {
      if (c.match.test(mealName)) return c.url
    }
  }
  return GENERIC_FALLBACK
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

    if (!res.ok) return [fallbackImage(mealName)]

    const data = await res.json()
    // Server signals fallback:true when the key is missing or the search
    // failed — use a category-matched fallback instead of its generic one.
    if (data.fallback) return [fallbackImage(mealName)]

    const urls = Array.isArray(data.urls)
      ? data.urls.filter((u: any) => typeof u === "string")
      : []
    if (data.url && !urls.includes(data.url)) urls.unshift(data.url)
    return urls.length > 0 ? urls : [fallbackImage(mealName)]
  } catch (err) {
    console.error("Food image lookup failed", err)
    return [fallbackImage(mealName)]
  }
}
