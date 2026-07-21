import {
  Activity,
  Footprints,
  Bike,
  Waves,
  Dumbbell,
  Flower,
  Zap,
  Trophy,
  type LucideIcon,
} from "lucide-react"

export type WorkoutType =
  | "running"
  | "walking"
  | "cycling"
  | "swimming"
  | "weightlifting"
  | "yoga"
  | "hiit"
  | "sports"

type WorkoutMeta = {
  value: WorkoutType
  label: string
  met: number
  icon: LucideIcon
  imageQuery: string
}

export const WORKOUT_TYPES: WorkoutMeta[] = [
  {
    value: "running",
    label: "Running",
    met: 9.8,
    icon: Activity,
    imageQuery: "running sunrise outdoor",
  },
  {
    value: "walking",
    label: "Walking",
    met: 3.5,
    icon: Footprints,
    imageQuery: "walking trail outdoor path",
  },
  {
    value: "cycling",
    label: "Cycling",
    met: 7.5,
    icon: Bike,
    imageQuery: "cycling road bike outdoor",
  },
  {
    value: "swimming",
    label: "Swimming",
    met: 8.3,
    icon: Waves,
    imageQuery: "swimming pool athlete",
  },
  {
    value: "weightlifting",
    label: "Weightlifting",
    met: 5.0,
    icon: Dumbbell,
    imageQuery: "weightlifting gym strength training",
  },
  {
    value: "yoga",
    label: "Yoga",
    met: 2.5,
    icon: Flower,
    imageQuery: "yoga studio calm",
  },
  {
    value: "hiit",
    label: "HIIT",
    met: 8.0,
    icon: Zap,
    imageQuery: "hiit workout intense training",
  },
  {
    value: "sports",
    label: "Sports",
    met: 7.0,
    icon: Trophy,
    imageQuery: "sports team athletic action",
  },
]

export const WORKOUT_META_BY_TYPE: Record<WorkoutType, WorkoutMeta> =
  Object.fromEntries(WORKOUT_TYPES.map((w) => [w.value, w])) as Record<
    WorkoutType,
    WorkoutMeta
  >

const DEFAULT_WEIGHT_KG = 70

export function estimateCaloriesBurned(
  type: WorkoutType,
  durationMinutes: number,
  weightKg?: number | null
): number {
  const met = WORKOUT_META_BY_TYPE[type]?.met ?? 5.0
  const weight = weightKg && weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG
  const calories = met * weight * (durationMinutes / 60)
  return Math.max(0, Math.round(calories))
}
