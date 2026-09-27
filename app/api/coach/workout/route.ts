import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"

/**
 * GET /api/coach/workout?type=running&minutes=30&start=ISO&end=ISO
 * Fitness coach: after a workout is logged, it acknowledges the movement
 * and opens the loop on TOMORROW's movement — the mirror of the food
 * coach ("your next meal" → "how you'll move tomorrow").
 *
 * Movement-first by design: food is demoted to a single quiet line, only
 * when there's a genuine post-workout fuel gap. Rest is a first-class
 * recommendation, short workouts count, and nothing is ever framed as
 * calorie punishment or "making up for" anything.
 */
function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured")
  return new Anthropic({ apiKey })
}

const TEXT_MODEL = process.env.AI_TEXT_MODEL ?? "claude-haiku-4-5"

// Light rate limit: guidance is per-workout, not per-keystroke.
const RATE_LIMIT = 30
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
  const cleaned = text.replace(/```json|```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("No JSON object found")
  return JSON.parse(cleaned.slice(start, end + 1))
}

const num = (v: unknown) => {
  const n = Number(v)
  return isNaN(n) ? 0 : Math.round(n * 10) / 10
}

type Intensity = "light" | "moderate" | "hard"

/** How demanding a workout was — drives the recovery vs. nudge framing. */
function intensity(type: string, minutes: number): Intensity {
  if (type === "weightlifting" || type === "hiit" || type === "sports") return "hard"
  if (type === "walking" || type === "yoga") return minutes >= 45 ? "moderate" : "light"
  if (minutes >= 45) return "hard"
  if (minutes < 20) return "light"
  return "moderate"
}

const WORKOUT_LABELS: Record<string, string> = {
  running: "run",
  walking: "walk",
  cycling: "ride",
  swimming: "swim",
  weightlifting: "lift",
  yoga: "yoga session",
  hiit: "HIIT session",
  sports: "game",
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export async function GET(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response
  if (isRateLimited(user.id)) {
    return NextResponse.json({ tip: null })
  }

  const params = new URL(req.url).searchParams
  const type = params.get("type") || "walking"
  const minutes = Math.max(1, Math.round(Number(params.get("minutes")) || 20))
  const start = params.get("start")
  const end = params.get("end")
  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 })
  }

  const supabase = await createServerSupabase()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: meals }, { data: goalRows }, { data: weekWorkouts }, { data: recentMeals }] =
    await Promise.all([
      supabase
        .from("meals")
        .select("ai_analysis, created_at")
        .eq("user_id", user.id)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: true }),
      supabase
        .from("user_goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("workouts")
        .select("workout_type, duration_minutes, created_at")
        .eq("user_id", user.id)
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false }),
      supabase
        .from("meals")
        .select("ai_analysis")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60),
    ])

  const goals = goalRows?.[0] || { calories: 2000, protein: 150, carbs: 200, fat: 70 }

  let caloriesToday = 0
  for (const m of meals || []) {
    const ai =
      typeof m.ai_analysis === "string" ? JSON.parse(m.ai_analysis) : m.ai_analysis
    caloriesToday += num(ai?.calories)
  }

  // --- Movement pattern over the last 7 days ---
  const todayIntensity = intensity(type, minutes)
  const byDay = new Map<string, Intensity[]>()
  for (const w of weekWorkouts || []) {
    const k = dayKey(new Date(w.created_at))
    const list = byDay.get(k) || []
    list.push(intensity(String(w.workout_type), Number(w.duration_minutes) || 0))
    byDay.set(k, list)
  }
  const today = new Date()
  let hardStreak = todayIntensity === "hard" ? 1 : 0
  for (let back = 1; back < 7; back++) {
    const d = new Date(today)
    d.setDate(d.getDate() - back)
    const list = byDay.get(dayKey(d)) || []
    if (list.includes("hard")) hardStreak += 1
    else break
  }
  let quietDays = 0
  for (let back = 0; back < 7; back++) {
    const d = new Date(today)
    d.setDate(d.getDate() - back)
    if (!(byDay.get(dayKey(d)) || []).length) quietDays += 1
  }

  const mode: "rest" | "standard" = hardStreak >= 3 ? "rest" : "standard"

  // Genuine fuel gap only: hard workout + clearly light eating day.
  // Anything softer stays silent — the food coach owns food guidance.
  const fuelGap =
    todayIntensity === "hard" && caloriesToday < goals.calories * 0.7

  // Distinct meal names from recent history — only used for the optional
  // one-line food note, so it can name something she actually eats.
  const usual: string[] = []
  const seen = new Set<string>()
  for (const m of recentMeals || []) {
    const ai =
      typeof m.ai_analysis === "string" ? JSON.parse(m.ai_analysis) : m.ai_analysis
    const name = String(ai?.meal_name || "").trim()
    const key = name.toLowerCase()
    if (name && !seen.has(key)) {
      seen.add(key)
      usual.push(name)
      if (usual.length >= 20) break
    }
  }

  const workoutLabel = WORKOUT_LABELS[type] || "workout"

  let tip: any = null
  try {
    const res = await getAnthropic().messages.create({
      model: TEXT_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are a calm, encouraging fitness coach inside a food-tracking app. The user just finished a ${minutes}-minute ${workoutLabel} (${todayIntensity} intensity). Your job: acknowledge the movement, then open the loop on TOMORROW's movement — like a good coach would.

CRITICAL — SENSITIVITY: she may have a complicated relationship with food and exercise. Never shame, scold, or moralize. Never praise or judge workout length, intensity, or calories burned — a short walk COUNTS. Never suggest working out to "burn off" food, "earn" food, or "make up for" anything. Never do calorie math. Never compare to yesterday or imply she should have done more. Rest is a legitimate, good recommendation. Every claim must come from the data below — never invent workouts or numbers.

DATA:
- Today: ${minutes}-minute ${workoutLabel} (${todayIntensity})
- Pattern: ${hardStreak} hard day(s) in a row including today; ${quietDays} of the last 7 days had no workout
- Mode: ${mode} ${mode === "rest" ? "(she's stacked hard days — rest or easy movement is the right call)" : ""}
- Fuel gap: ${fuelGap ? "YES — hard workout on a light eating day" : "no"}
${fuelGap ? `- Foods she eats often: ${usual.join("; ") || "unknown"}` : ""}

TASK: Write like a friendly coach texting her — plain-spoken, warm, brief, zero judgment. No exclamation marks. The whole thing must read in 3 seconds.
- "headline": acknowledge today's effort casually, e.g. "good lift" energy but in your own words. Short. If mode is rest, the headline should honor the work AND set up rest.
- "tomorrow": ONE specific, small suggestion for tomorrow's movement. Recovery-aware: after a hard day suggest easy movement or full rest ("rest is the workout today" framing when mode is rest); after a light day, gently nudge something a touch more intentional tomorrow — but frame even a walk as a win ("walking helps recovery"). After quiet days, suggest the smallest possible re-entry. Never prescribe a workout plan.
- "foodNote": ${fuelGap ? "ONE quiet line noting a little refuel would help recovery — name one of her usual foods if one fits, no numbers, no pressure." : "null — no food guidance today, the food coach owns that."}

Return ONLY valid JSON, no markdown fences:
{
  "headline": "short, warm acknowledgment",
  "tomorrow": "one specific small suggestion for tomorrow",
  "foodNote": "one quiet line" | null
}`,
        },
      ],
    })
    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    const parsed = extractJson(text)
    if (parsed?.headline && parsed?.tomorrow) {
      tip = {
        headline: String(parsed.headline).slice(0, 120),
        tomorrow: String(parsed.tomorrow).slice(0, 200),
        foodNote:
          fuelGap && parsed.foodNote ? String(parsed.foodNote).slice(0, 160) : null,
      }
    }
  } catch (err) {
    console.error("COACH WORKOUT FAILED:", err)
  }

  return NextResponse.json({ tip, mode, workoutLabel })
}
