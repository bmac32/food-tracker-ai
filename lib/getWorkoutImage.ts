import { WORKOUT_META_BY_TYPE, type WorkoutType } from "./workoutMeta"

export async function getWorkoutImage(type: WorkoutType): Promise<string> {
  try {
    const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY

    if (!accessKey) {
      console.error("Missing Unsplash key")
      return fallbackImage()
    }

    const query = WORKOUT_META_BY_TYPE[type]?.imageQuery || "workout fitness"

    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        query
      )}&per_page=6&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
      }
    )

    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return fallbackImage()
    }

    // Skip any sponsored/promoted results and pick from the rest of the
    // top few so it's not always the very first hit.
    const organic = data.results.filter((r: any) => !r.sponsorship)
    const pool = organic.length > 0 ? organic : data.results

    const pick = pool[Math.floor(Math.random() * pool.length)]

    return pick.urls.regular
  } catch (err) {
    console.error("Unsplash workout image failed", err)
    return fallbackImage()
  }
}

function fallbackImage() {
  return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
}
