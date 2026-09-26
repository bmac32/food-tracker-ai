import { WORKOUT_META_BY_TYPE, type WorkoutType } from "./workoutMeta"

/**
 * Workout imagery — goes through our own /api/food-image proxy so the
 * Unsplash access key stays server-side (see app/api/food-image/route.ts).
 * The old NEXT_PUBLIC_UNSPLASH_ACCESS_KEY env var is no longer used;
 * set server-only UNSPLASH_ACCESS_KEY instead.
 */
export async function getWorkoutImage(type: WorkoutType): Promise<string> {
  try {
    const query = WORKOUT_META_BY_TYPE[type]?.imageQuery || "workout fitness"

    const res = await fetch(
      `/api/food-image?q=${encodeURIComponent(
        query
      )}&orientation=landscape`
    )

    if (!res.ok) return fallbackImage()

    const data = await res.json()
    return data.url || fallbackImage()
  } catch (err) {
    console.error("Unsplash workout image failed", err)
    return fallbackImage()
  }
}

function fallbackImage() {
  return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
}
