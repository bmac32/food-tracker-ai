import type { WorkoutType } from "./workoutMeta"

/**
 * Curated workout imagery — every ID below was visually verified
 * (2026-09-26) to actually show that workout, because the old fallback
 * was a food photo and the old pipeline searched the FOOD image index.
 * Used when the live search APIs come back empty.
 */
const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=80`

export const WORKOUT_FALLBACKS: Record<WorkoutType, string> = {
  running: u("1552674605-db6ffd4facb5"), // runners silhouetted at dawn
  walking: u("1551632811-561732d1e306"), // hikers on a mountain trail
  cycling: u("1485965120184-e220f721d03e"), // road bike
  swimming: u("1530549387789-4c1017266635"), // butterfly swimmer
  weightlifting: u("1517836357463-d25dfeac3438"), // barbell deadlift
  yoga: u("1544367567-0f2fcb009e0b"), // yoga pose at sunset
  hiit: u("1574680096145-d05b474e2155"), // battle ropes
  sports: u("1538805060514-97d9cc17730c"), // stadium stair run
}

export function workoutFallback(type: WorkoutType): string {
  return WORKOUT_FALLBACKS[type] || WORKOUT_FALLBACKS.walking
}
