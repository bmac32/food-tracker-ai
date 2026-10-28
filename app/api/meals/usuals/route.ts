import { NextResponse } from "next/server"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"
import { computeUsuals } from "@/lib/usuals"

/**
 * GET /api/meals/usuals — the meals she actually repeats.
 *
 * Authenticated. Groups the last 60 days of her meals by meal name and
 * returns up to 3 meals logged 3+ times, each with its latest instance's
 * analysis and photo so the client can re-log it in one tap.
 *
 * Never errors the day view: on any failure it returns an empty list
 * and the card simply doesn't render. Usuals are a shortcut, not a
 * load-bearing feature.
 */
export async function GET() {
  const { user, response } = await getRouteUser()
  if (!user) return response

  try {
    const supabase = await createServerSupabase()
    const since = new Date(
      Date.now() - 60 * 24 * 60 * 60 * 1000
    ).toISOString()
    const { data, error } = await supabase
      .from("meals")
      .select("ai_analysis, photo_url, created_at")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500)
    if (error) return NextResponse.json({ usuals: [] })
    return NextResponse.json({ usuals: computeUsuals(data || []) })
  } catch {
    return NextResponse.json({ usuals: [] })
  }
}
