import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {

  const today = new Date()
  today.setHours(0,0,0,0)

  const { data } = await supabase
    .from("meals")
    .select("*")
    .gte("created_at", today.toISOString())

  let calories = 0
  let protein = 0
  let carbs = 0
  let fat = 0

  data?.forEach((meal: any) => {
    calories += Number(meal.calories) || 0
    protein += Number(meal.protein) || 0
    carbs += Number(meal.carbs) || 0
    fat += Number(meal.fat) || 0
  })

  return Response.json({
    calories,
    protein,
    carbs,
    fat
  })
}