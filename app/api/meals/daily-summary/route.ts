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

  data?.forEach((meal:any) => {

    const text = meal.ai_analysis?.nutrition_insight || ""

    const match = text.match(/\d+/)

    if (match) {
      calories += parseInt(match[0])
    }

  })

  return Response.json({
    calories,
    protein: 0,
    carbs: 0,
    fat: 0
  })
}