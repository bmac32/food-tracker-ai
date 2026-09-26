import { NextResponse } from "next/server"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"
import { normalizeFoodKey } from "@/lib/foodTruth"

/**
 * PATCH /api/meals/[id] — apply a food correction to an already-saved meal.
 * Body: { item, protein, carbs, fat } (serving-level macros for that item).
 * Rewrites the item inside ai_analysis and recomputes the meal totals, so
 * a correction made from the feed fixes that meal too — not just the future.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response } = await getRouteUser()
  if (!user) return response
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "Meal id required." }, { status: 400 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const target = normalizeFoodKey(String(body.item || ""))
  if (!target) {
    return NextResponse.json({ error: "Food name required." }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const { data: meal, error } = await supabase
    .from("meals")
    .select("id, ai_analysis")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !meal) {
    return NextResponse.json({ error: "Meal not found." }, { status: 404 })
  }

  let ai: any
  try {
    ai =
      typeof meal.ai_analysis === "string"
        ? JSON.parse(meal.ai_analysis)
        : meal.ai_analysis
  } catch {
    return NextResponse.json({ error: "Meal not found." }, { status: 404 })
  }

  const items = Array.isArray(ai?.food_items) ? ai.food_items : []
  const r1 = (n: number) => Math.round(n * 10) / 10
  let found = false
  let protein = 0
  let carbs = 0
  let fat = 0
  for (const it of items) {
    if (normalizeFoodKey(String(it.item || "")) === target) {
      it.protein = r1(Number(body.protein) || 0)
      it.carbs = r1(Number(body.carbs) || 0)
      it.fat = r1(Number(body.fat) || 0)
      it.source = "yours"
      found = true
    }
    protein += Number(it.protein) || 0
    carbs += Number(it.carbs) || 0
    fat += Number(it.fat) || 0
  }
  if (!found) {
    return NextResponse.json({ error: "Food not in this meal." }, { status: 404 })
  }

  protein = r1(protein)
  carbs = r1(carbs)
  fat = r1(fat)
  ai.food_items = items
  ai.protein = protein
  ai.carbs = carbs
  ai.fat = fat
  ai.calories = Math.round(protein * 4 + carbs * 4 + fat * 9)
  ai.estimated = items.some((it: any) => it.source === "ai")

  const { error: updateError } = await supabase
    .from("meals")
    .update({ ai_analysis: ai })
    .eq("id", meal.id)
    .eq("user_id", user.id)

  if (updateError) {
    console.error("MEAL CORRECTION UPDATE FAILED:", updateError)
    return NextResponse.json(
      { error: "Couldn't update that meal — please try again." },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, ai_analysis: ai })
}
