import type { WorkoutType } from "./workoutMeta"
import { workoutFallback } from "./workoutImageFallbacks"

/**
 * Workout imagery — goes through our own /api/workout-image proxy so the
 * Unsplash access key stays server-side. NEVER the food-image endpoint:
 * that runs the dish learning loop and food fallbacks, which is how a
 * workout once showed a food photo.
 */
/**
 * Fetch several workout photo options so the user can pick the one they
 * like (swipe/chevrons, like the meal photo picker). The route rotates
 * query variants and result pages per request, so repeated calls surface
 * different photos — the old single-top-hit behavior is what made the
 * same workout image show for weeks.
 */
export async function getWorkoutImages(type: WorkoutType): Promise<string[]> {
  try {
    // No q param: the route rotates per-type query variants itself, so
    // repeated calls surface different photos (that's the variety fix).
    const res = await fetch(`/api/workout-image?type=${encodeURIComponent(type)}`)

    if (!res.ok) return [workoutFallback(type)]

    const data = await res.json()
    const list: unknown = data.candidates
    if (data.fallback || !Array.isArray(list) || list.length === 0) {
      return [workoutFallback(type)]
    }
    const urls = list.filter((u): u is string => typeof u === "string" && u.length > 0)
    return urls.length > 0 ? urls : [workoutFallback(type)]
  } catch (err) {
    console.error("Workout images failed", err)
    return [workoutFallback(type)]
  }
}

export async function getWorkoutImage(type: WorkoutType): Promise<string> {
  const images = await getWorkoutImages(type)
  return images[0]
}
