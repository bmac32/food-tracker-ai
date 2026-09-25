/**
 * Food photo lookup — goes through our own /api/food-image proxy so the
 * Unsplash access key stays server-side (see app/api/food-image/route.ts).
 * The old NEXT_PUBLIC_UNSPLASH_ACCESS_KEY env var is no longer used;
 * set server-only UNSPLASH_ACCESS_KEY instead.
 */
export async function getSmartFoodImage(mealName: string, foods?: string[]) {
  const urls = await getSmartFoodImages(mealName, foods)
  return urls[0] || fallbackImage()
}

/**
 * Returns up to 6 candidate photo URLs so the UI can offer a swipeable
 * picker when the first pick doesn't match the meal.
 */
export async function getSmartFoodImages(
  mealName: string,
  foods?: string[]
): Promise<string[]> {
  try {
    const queryParts = foods?.length
      ? foods.slice(0, 3)
      : mealName.split(" ").slice(0, 3)

    const query = queryParts.join(" ")

    const res = await fetch(
      `/api/food-image?q=${encodeURIComponent(query + " food")}`
    )

    if (!res.ok) return [fallbackImage()]

    const data = await res.json()
    const urls = Array.isArray(data.urls)
      ? data.urls.filter((u: any) => typeof u === "string")
      : []
    if (data.url && !urls.includes(data.url)) urls.unshift(data.url)
    return urls.length > 0 ? urls : [fallbackImage()]
  } catch (err) {
    console.error("Food image lookup failed", err)
    return [fallbackImage()]
  }
}

function fallbackImage() {
  return "https://images.unsplash.com/photo-1498837167922-ddd27525d352"
}
