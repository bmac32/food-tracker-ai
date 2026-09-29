import { NextResponse } from "next/server"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"
import {
  normalizeFoodKey,
  servingToPer100,
  getPortionProfile,
  findProfileEntry,
} from "@/lib/foodTruth"

/**
 * Save a food correction — "correct once, remembered forever."
 * Body: { food, protein, carbs, fat, grams, note? }
 * Macros are the SERVING's values (what she sees); grams is the AI's
 * portion estimate for that serving. Stored per 100g so future
 * servings of any size scale correctly. Wins over USDA and AI
 * in all future analyses.
 *
 * Grams sanity check: her macros are trusted, but the portion they're
 * attached to is the AI's one-off guess — the flaky input. Before baking
 * it in forever, check it against her own history: if she has a real
 * usual for this food (2+ sightings) and the guess falls outside a 2x
 * band around it, the guess is suspect and the correction is anchored to
 * her usual instead. Her history (N consistent observations) beats one
 * AI guess — a bad portion estimate must never poison the "forever"
 * correction. The response says what happened (gramsUsed, adjusted).
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

  const protein = Number(body.protein) || 0
  const carbs = Number(body.carbs) || 0
  const fat = Number(body.fat) || 0
  const aiGrams = Number(body.grams) || 0

  const supabase = await createServerSupabase()

  // --- Grams sanity check (see header) ---
  let gramsUsed = aiGrams
  let adjusted = false
  let typicalGrams = 0
  try {
    const profile = await getPortionProfile(supabase, user.id, 200)
    const entry = findProfileEntry(String(body.food || ""), profile)
    const usual = Number(entry?.typical_grams) || 0
    const samples = Number(entry?.samples) || 0
    if (
      usual > 0 &&
      samples >= 2 &&
      aiGrams > 0 &&
      (aiGrams < usual / 2 || aiGrams > usual * 2)
    ) {
      gramsUsed = usual
      adjusted = true
      typicalGrams = usual
    }
  } catch (e) {
    // Never fail the correction on the sanity check — worst case the
    // portion is stored unchecked, exactly like before.
    console.error("PORTION SANITY CHECK FAILED:", e)
  }

  const per100 = servingToPer100(protein, carbs, fat, gramsUsed)
  if (!per100) {
    return NextResponse.json(
      { error: "Couldn't determine the serving size." },
      { status: 400 }
    )
  }

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

  // Silent portion learning: a teach is a strong portion signal — she
  // engaged with this food, so its shown portion feeds her usual-portion
  // profile. Best-effort; never fails the correction itself. Records the
  // sanity-checked grams, so a suspect AI guess can't pollute her usual.
  try {
    const label = String(body.food || "").trim()
    if (gramsUsed > 0 && label) {
      await supabase.rpc("record_portion", {
        p_food_key: food_key,
        p_food_label: label.slice(0, 80),
        p_grams: gramsUsed,
        p_taught: true,
      })
    }
  } catch (e) {
    console.error("PORTION RECORD FAILED:", e)
  }

  return NextResponse.json({
    ok: true,
    food_key,
    per100,
    gramsUsed,
    adjusted,
    typicalGrams,
  })
}
