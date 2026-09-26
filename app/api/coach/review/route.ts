import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"

/**
 * POST /api/coach/review
 * Authenticated. Body: { days?: number } (default 7, max 14).
 *
 * Pulls the user's recent meals + workouts + goals, computes honest
 * per-day stats server-side, then asks a "fitness instructor" persona
 * for a structured review: what's working, what's missing, and what
 * to do next week. Every claim the model makes must tie to the stats
 * it's given — no invented meals or numbers.
 */
function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured")
  return new Anthropic({ apiKey })
}

const TEXT_MODEL = process.env.AI_TEXT_MODEL ?? "claude-haiku-4-5"

const RATE_LIMIT = 10
const WINDOW_MS = 60 * 60 * 1000
const hits = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const entry = hits.get(userId)
  if (!entry || now > entry.resetAt) {
    hits.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT
}

function extractJson(text: string): any {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("No JSON object found")
  return JSON.parse(cleaned.slice(start, end + 1))
}

const num = (v: any) => {
  const n = Number(v)
  return isNaN(n) ? 0 : Math.round(n)
}

const str = (v: any, max = 200) => String(v || "").slice(0, max)

export async function POST(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response

  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: "Coach is catching their breath — try again in a bit." },
      { status: 429 }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const days = Math.min(Math.max(num(body.days) || 7, 1), 14)

    const supabase = await createServerSupabase()
    const since = new Date()
    since.setDate(since.getDate() - (days - 1))
    since.setHours(0, 0, 0, 0)

    const [{ data: meals }, { data: workouts }, { data: goalRows }] =
      await Promise.all([
        supabase
          .from("meals")
          .select("meal_name, ai_analysis, created_at")
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("workouts")
          .select("workout_type, duration_minutes, calories_burned, created_at")
          .gte("created_at", since.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("user_goals")
          .select("calories, protein, carbs, fat")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1),
      ])

    const g = goalRows?.[0]
    const goals = {
      calories: num(g?.calories) || 2000,
      protein: num(g?.protein) || 150,
      carbs: num(g?.carbs) || 200,
      fat: num(g?.fat) || 70,
    }

    // ---- Per-day aggregation (RLS already scoped everything to the user) ----
    type DayStat = {
      date: string
      calories: number
      protein: number
      carbs: number
      fat: number
      meals: number
      workouts: number
    }
    const byDay = new Map<string, DayStat>()
    const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10)
    const ensure = (k: string): DayStat => {
      let d = byDay.get(k)
      if (!d) {
        d = { date: k, calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0, workouts: 0 }
        byDay.set(k, d)
      }
      return d
    }

    const mealNames: string[] = []
    for (const m of meals || []) {
      const d = ensure(dayKey(m.created_at))
      let ai: any = null
      try {
        ai = typeof m.ai_analysis === "string" ? JSON.parse(m.ai_analysis) : m.ai_analysis
      } catch {}
      d.calories += num(ai?.calories)
      d.protein += num(ai?.protein)
      d.carbs += num(ai?.carbs)
      d.fat += num(ai?.fat)
      d.meals += 1
      if (m.meal_name) mealNames.push(String(m.meal_name))
    }

    const workoutTypes: string[] = []
    let totalWorkoutMinutes = 0
    for (const w of workouts || []) {
      const d = ensure(dayKey(w.created_at))
      d.workouts += 1
      if (w.workout_type) workoutTypes.push(String(w.workout_type))
      totalWorkoutMinutes += num(w.duration_minutes)
    }

    const dayStats = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
    const daysWithMeals = dayStats.filter((d) => d.meals > 0)
    const n = daysWithMeals.length

    if (n === 0) {
      return NextResponse.json(
        { error: "Log a few meals first — your coach needs something to review." },
        { status: 422 }
      )
    }

    const avg = (f: (d: DayStat) => number) =>
      Math.round(dayStats.reduce((s, d) => s + f(d), 0) / n)
    const stats = {
      days_analyzed: days,
      days_with_meals: n,
      avg_calories: avg((d) => d.calories),
      avg_protein: avg((d) => d.protein),
      avg_carbs: avg((d) => d.carbs),
      avg_fat: avg((d) => d.fat),
      avg_meals_per_day: Math.round((dayStats.reduce((s, d) => s + d.meals, 0) / n) * 10) / 10,
      protein_goal_hit_days: daysWithMeals.filter((d) => d.protein >= goals.protein * 0.8).length,
      fat_over_days: daysWithMeals.filter((d) => d.fat > goals.fat).length,
      total_workouts: (workouts || []).length,
      workout_days: dayStats.filter((d) => d.workouts > 0).length,
      total_workout_minutes: totalWorkoutMinutes,
      workout_types: [...new Set(workoutTypes)].slice(0, 6),
      recent_meals: mealNames.slice(-10),
    }

    // ---- The coach's review ----
    const prompt = `You are an experienced, no-nonsense fitness instructor reviewing a client's food log. Be direct and encouraging like a real coach — specific numbers, zero fluff, no generic advice. Every claim must come from the data below; never invent meals, workouts, or numbers.

CLIENT DATA — last ${days} days (${n} days with meals logged):
- Calorie goal: ${goals.calories}/day | avg eaten: ${stats.avg_calories}
- Protein goal: ${goals.protein}g/day | avg: ${stats.avg_protein}g | hit 80%+ of goal on ${stats.protein_goal_hit_days} of ${n} days
- Fat goal: ${goals.fat}g/day | avg: ${stats.avg_fat}g | OVER goal on ${stats.fat_over_days} of ${n} days
- Carb goal: ${goals.carbs}g/day | avg: ${stats.avg_carbs}g
- Avg meals logged per day: ${stats.avg_meals_per_day}
- Workouts: ${stats.total_workouts} total across ${stats.workout_days} days (${stats.total_workout_minutes} min). Types: ${stats.workout_types.join(", ") || "none logged"}
- Recent meals: ${stats.recent_meals.join("; ") || "none"}

IMPORTANT CONTEXT: this tracker only records calories, protein, carbs, and fat — no fiber, sugar, sodium, vitamins, or water. If the meal names suggest low vegetable/fruit variety or a likely fiber gap, you may flag it as a likely gap (say "likely"), but don't state unmeasured nutrients as fact.

Tell them what they're missing. Return ONLY valid JSON, no markdown fences:
{
  "headline": "one direct sentence verdict in coach voice",
  "grade": "a letter grade like B+",
  "wins": ["2-3 specific things they're doing right, with their numbers"],
  "gaps": [
    { "gap": "what's missing or off", "why": "why it matters, one line", "fix": "one concrete fix for next week" }
  ],
  "next_week": ["2-3 concrete actions for the coming week"]
}
Maximum 3 gaps — pick the ones that matter most.`

    let review: any = null
    try {
      const res = await getAnthropic().messages.create({
        model: TEXT_MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      })
      const content = res.content[0]
      const text = content?.type === "text" ? content.text : ""
      review = extractJson(text)
    } catch (err) {
      console.error("COACH REVIEW FAILED:", err)
    }

    if (!review || !review.headline) {
      return NextResponse.json(
        { error: "Coach couldn't write up the review — please try again." },
        { status: 500 }
      )
    }

    const clean = {
      headline: str(review.headline, 220),
      grade: str(review.grade, 4) || "—",
      wins: (Array.isArray(review.wins) ? review.wins : []).map((w: any) => str(w, 220)).filter(Boolean).slice(0, 4),
      gaps: (Array.isArray(review.gaps) ? review.gaps : [])
        .map((gp: any) => ({
          gap: str(gp?.gap, 160),
          why: str(gp?.why, 220),
          fix: str(gp?.fix, 220),
        }))
        .filter((gp: any) => gp.gap)
        .slice(0, 3),
      next_week: (Array.isArray(review.next_week) ? review.next_week : []).map((w: any) => str(w, 220)).filter(Boolean).slice(0, 4),
    }

    return NextResponse.json({ goals, stats, review: clean })
  } catch (error) {
    console.error("COACH ROUTE ERROR:", error)
    return NextResponse.json(
      { error: "Something went wrong — please try again." },
      { status: 500 }
    )
  }
}
