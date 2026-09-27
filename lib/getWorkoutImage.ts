import { WORKOUT_META_BY_TYPE, type WorkoutType } from "./workoutMeta"
import { workoutFallback } from "./workoutImageFallbacks"

/**
 * Workout imagery — goes through our own /api/workout-image proxy so the
 * Unsplash access key stays server-side. NEVER the food-image endpoint:
 * that runs the dish learning loop and food fallbacks, which is how a
 * workout once showed a food photo.
 */
export async function getWorkoutImage(type: WorkoutType): Promise<string> {
  try {
    const query = WORKOUT_META_BY_TYPE[type]?.imageQuery || "workout fitness"

    const res = await fetch(
      `/api/workout-image?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`
    )

    if (!res.ok) return workoutFallback(type)

    const data = await res.json()
    if (data.fallback || !data.url) return workoutFallback(type)
    return data.url
  } catch (err) {
    console.error("Workout image failed", err)
    return workoutFallback(type)
  }
}
