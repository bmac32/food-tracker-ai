import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"

/**
 * POST /api/coach/review
 * Authenticated. No body needed.
 *
 * Looks back up to 14 days and reviews only the days the user actually
 * logged meals — a single day gets a day review, more days get a wider
 * one. The persona is a warm, Apple-Health-calm nutrition coach: never
 * shaming, never moralizing about food, sensitive to people with a
 * complicated relationship with eating. Every claim must tie to the
 * stats — no invented meals or numbers.
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
      { error: "Please wait a bit, then try again." },
      { status: 429 }
    )
  }

  try {
    // Adaptive scope: look back up to 14 days, review the days with meals.
    const LOOKBACK_DAYS = 14
    const since = new Date()
    since.setDate(since.getDate() - (LOOKBACK_DAYS - 1))
    since.setHours(0, 0, 0, 0)

    const supabase = await createServerSupabase()

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
        { error: "Log a meal to get your first review." },
        { status: 422 }
      )
    }

    const avg = (f: (d: DayStat) => number) =>
      Math.round(dayStats.reduce((s, d) => s + f(d), 0) / n)
    const stats = {
      days_with_meals: n,
      avg_calories: avg((d) => d.calories),
      avg_protein: avg((d) => d.protein),
      avg_carbs: avg((d) => d.carbs),
      avg_fat: avg((d) => d.fat),
      avg_meals_per_day: Math.round((dayStats.reduce((s, d) => s + d.meals, 0) / n) * 10) / 10,
      protein_goal_hit_days: daysWithMeals.filter((d) => d.protein >= goals.protein * 0.8).length,
      fat_above_target_days: daysWithMeals.filter((d) => d.fat > goals.fat).length,
      total_workouts: (workouts || []).length,
      workout_days: dayStats.filter((d) => d.workouts > 0).length,
      total_workout_minutes: totalWorkoutMinutes,
      workout_types: [...new Set(workoutTypes)].slice(0, 6),
      recent_meals: mealNames.slice(-10),
      daily_totals: daysWithMeals.map(
        (d) => `${d.date}: ${d.calories} cal, ${d.protein}g protein, ${d.carbs}g carbs, ${d.fat}g fat (${d.meals} meals)`
      ),
    }

    const scopeSentence =
      n === 1
        ? `today — 1 day logged (${daysWithMeals[0].date})`
        : `${n} days with meals logged, out of the last ${LOOKBACK_DAYS} days`

    // ---- The coach's review ----
    // Warm, calm, Apple-Health tone. Never shaming, never moralizing about
    // food, sensitive to disordered eating. Additive suggestions only —
    // nothing restrictive.
    const prompt = `You are a warm, knowledgeable nutrition coach reviewing a client's food log. Think calm and respectful, like Apple Health — plain-spoken, encouraging, zero hype.

CRITICAL — FOOD SENSITIVITY: this person may have a complicated relationship with food. Never shame, scold, or moralize. Never label foods "good", "bad", "clean", "cheat", or "guilty". Never praise eating very little. Never suggest eating less, skipping meals, fasting, or "making up for" anything. If intake looks consistently very low, mention gently — as care, not criticism — that eating too little can leave you low on energy, and suggest checking in with a professional if it continues.

Every claim must come from the data below; never invent meals, workouts, or numbers.

CLIENT DATA — ${scopeSentence}:
- Calories: target ${goals.calories}/day · logged ${stats.avg_calories}/day
- Protein: target ${goals.protein}g/day · logged ${stats.avg_protein}g/day (hit 80%+ of target on ${stats.protein_goal_hit_days} of ${n} days)
- Fat: target ${goals.fat}g/day · logged ${stats.avg_fat}g/day (above target on ${stats.fat_above_target_days} of ${n} days)
- Carbs: target ${goals.carbs}g/day · logged ${stats.avg_carbs}g/day
- Meals logged per day: ${stats.avg_meals_per_day}
- Workouts: ${stats.total_workouts} total across ${stats.workout_days} days (${stats.total_workout_minutes} min). Types: ${stats.workout_types.join(", ") || "none logged"}
- Daily totals: ${stats.daily_totals.join(" | ")}
- Recent meals: ${stats.recent_meals.join("; ") || "none"}

IMPORTANT CONTEXT: this tracker only records calories, protein, carbs, and fat — no fiber, sugar, sodium, vitamins, or water. If the meal names suggest low fruit/vegetable variety, you may note it as a likely observation (say "looks like"), never as a measured fact.

Write the review as JSON, no markdown fences. Keep every line short and human:
{
  "headline": "one warm, specific sentence — the takeaway of ${n === 1 ? "today" : "this period"}",
  "highlights": ["2-3 specific things going well, with their numbers"],
  "ideas": [
    { "idea": "a small, kind, practical suggestion", "why": "why it could help, one gentle line", "try": "one concrete way to try it" }
  ],
  "next_steps": ["2-3 small next steps — additive ('add', 'try', 'keep'), never restrictive"]
}
Maximum 3 ideas — pick the ones that matter most. No grades, no verdicts on the person, no "missing" or "failing" language.`

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
        { error: "Couldn't put the review together — please try again." },
        { status: 500 }
      )
    }

    const clean = {
      headline: str(review.headline, 220),
      highlights: (Array.isArray(review.highlights) ? review.highlights : []).map((w: any) => str(w, 220)).filter(Boolean).slice(0, 4),
      ideas: (Array.isArray(review.ideas) ? review.ideas : [])
        .map((it: any) => ({
          idea: str(it?.idea, 160),
          why: str(it?.why, 220),
          try: str(it?.try, 220),
        }))
        .filter((it: any) => it.idea)
        .slice(0, 3),
      next_steps: (Array.isArray(review.next_steps) ? review.next_steps : []).map((w: any) => str(w, 220)).filter(Boolean).slice(0, 4),
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
