import { NextResponse } from "next/server"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"
import { normalizeFoodKey, servingToPer100 } from "@/lib/foodTruth"

/**
 * Save a food correction — "correct once, remembered forever."
 * Body: { food, protein, carbs, fat, grams, note? }
 * Macros are the SERVING's values (what she sees); grams is the AI's
 * portion estimate for that serving. Stored per 100g so future
 * servings of any size scale correctly. Wins over USDA and AI
 * in all future analyses.
 */
export async function POST(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const food_key = normalizeFoodKey(String(body.food || ""))
  if (!food_key) {
    return NextResponse.json({ error: "Food name required." }, { status: 400 })
  }

  const per100 = servingToPer100(
    Number(body.protein) || 0,
    Number(body.carbs) || 0,
    Number(body.fat) || 0,
    Number(body.grams) || 0
  )
  if (!per100) {
    return NextResponse.json(
      { error: "Couldn't determine the serving size." },
      { status: 400 }
    )
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("food_corrections").upsert(
    {
      user_id: user.id,
      food_key,
      protein_per100: per100.protein,
      carbs_per100: per100.carbs,
      fat_per100: per100.fat,
      note:
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim().slice(0, 200)
          : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,food_key" }
  )

  if (error) {
    console.error("FOOD CORRECTION SAVE FAILED:", error)
    return NextResponse.json(
      { error: "Couldn't save that — please try again." },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, food_key, per100 })
}
