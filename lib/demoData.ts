export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

export const demoUserEmail = "demo@foodtracker.ai"

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString()

export const demoGoals = {
  calories: 2200,
  protein: 160,
  carbs: 220,
  fat: 75,
}

export const demoMeals = [
  {
    id: "demo-meal-1",
    created_at: hoursAgo(1),
    photo_url:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80",
    note: "Post-workout lunch",
    ai_analysis: {
      meal_name: "Grilled Chicken Bowl",
      foods: ["grilled chicken", "brown rice", "broccoli", "avocado"],
      calories: 620,
      protein: 52,
      carbs: 58,
      fat: 18,
    },
    calories: 620,
    protein: 52,
    carbs: 58,
    fat: 18,
    shared_meals: [],
  },
  {
    id: "demo-meal-2",
    created_at: hoursAgo(5),
    photo_url:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80",
    note: null,
    ai_analysis: {
      meal_name: "Greek Yogurt & Berries",
      foods: ["greek yogurt", "blueberries", "honey", "granola"],
      calories: 310,
      protein: 20,
      carbs: 42,
      fat: 7,
    },
    calories: 310,
    protein: 20,
    carbs: 42,
    fat: 7,
    shared_meals: [
      { id: "share-1", reply_message: "Nice protein hit for breakfast! 💪" },
    ],
  },
  {
    id: "demo-meal-3",
    created_at: hoursAgo(9),
    photo_url:
      "https://images.unsplash.com/photo-1550317138-10000687a72b?w=800&q=80",
    note: "Quick breakfast before the gym",
    ai_analysis: {
      meal_name: "Avocado Toast & Eggs",
      foods: ["sourdough toast", "avocado", "fried egg", "chili flakes"],
      calories: 430,
      protein: 18,
      carbs: 36,
      fat: 24,
    },
    calories: 430,
    protein: 18,
    carbs: 36,
    fat: 24,
    shared_meals: [],
  },
]

export const demoWorkouts = [
  {
    id: "demo-workout-1",
    created_at: hoursAgo(3),
    workout_type: "weightlifting",
    duration_minutes: 45,
    calories_burned: 310,
    photo_url: null,
    note: "Upper body + core",
  },
]

export const demoTotals = demoMeals.reduce(
  (acc, m) => {
    acc.calories += m.ai_analysis.calories
    acc.protein += m.ai_analysis.protein
    acc.carbs += m.ai_analysis.carbs
    acc.fat += m.ai_analysis.fat
    return acc
  },
  { calories: 0, protein: 0, carbs: 0, fat: 0 }
)
