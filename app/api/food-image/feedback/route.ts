import { NextResponse } from "next/server"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"

/**
 * POST /api/food-image/feedback
 * Records a photo verdict for the learning loop.
 * Body: { dish_key, meal_name?, foods?, photo_url, verdict: 'chosen'|'liked'|'disliked' }
 * The user_id always comes from the session — never the body.
 */
const VERDICTS = new Set(["chosen", "liked", "disliked"])

export async function POST(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 })
  }

  const dish_key = String(body?.dish_key || "").trim().slice(0, 200)
  const photo_url = String(body?.photo_url || "").trim().slice(0, 2000)
  const verdict = String(body?.verdict || "")

  if (!dish_key || !photo_url || !VERDICTS.has(verdict)) {
    return NextResponse.json(
      { error: "dish_key, photo_url, and a valid verdict are required" },
      { status: 400 }
    )
  }

  const foods = Array.isArray(body?.foods)
    ? body.foods
        .map((f: any) => (typeof f === "string" ? f : f?.item || "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : []

  const supabase = await createServerSupabase()
  const { error } = await supabase.from("photo_feedback").insert([
    {
      user_id: user.id,
      dish_key,
      meal_name: String(body?.meal_name || "").slice(0, 200) || null,
      foods: foods.length ? foods : null,
      photo_url,
      verdict,
    },
  ])

  if (error) {
    console.error("PHOTO FEEDBACK INSERT FAILED:", error)
    return NextResponse.json({ error: "Could not save" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
