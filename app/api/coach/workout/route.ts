import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"

/**
 * GET /api/coach/workout?type=running&minutes=30&start=ISO&end=ISO
 * Workout coach: after a workout is logged, gives short recovery guidance
 * for the next meal — based on the workout AND what she's already eaten
 * today, so it never nags her to overeat.
 *
 * Shame-free and ED-sensitive by construction: everything is framed as
 * fueling recovery, never compensating, "earning" food, or eating less.
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

// What kind of recovery each workout asks for.
function recoveryFocus(type: string, minutes: number): "protein" | "carbs" | "balanced" {
  if (type === "weightlifting") return "protein"
  if (
    (type === "running" || type === "cycling" || type === "swimming" || type === "hiit") &&
    minutes >= 45
  )
    return "carbs"
  return "balanced"
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

  const [{ data: meals }, { data: goalRows }, { data: recentMeals }] =
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
        .from("meals")
        .select("ai_analysis")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60),
    ])

  const goals = goalRows?.[0] || { calories: 2000, protein: 150, carbs: 200, fat: 70 }

  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  for (const m of meals || []) {
    const ai =
      typeof m.ai_analysis === "string" ? JSON.parse(m.ai_analysis) : m.ai_analysis
    totals.calories += num(ai?.calories)
    totals.protein += num(ai?.protein)
    totals.carbs += num(ai?.carbs)
    totals.fat += num(ai?.fat)
  }
  for (const k of Object.keys(totals) as (keyof typeof totals)[]) {
    totals[k] = Math.round(totals[k] * 10) / 10
  }

  const remaining = {
    calories: Math.max(0, Math.round(goals.calories - totals.calories)),
    protein: Math.max(0, Math.round((goals.protein - totals.protein) * 10) / 10),
    carbs: Math.max(0, Math.round((goals.carbs - totals.carbs) * 10) / 10),
    fat: Math.max(0, Math.round((goals.fat - totals.fat) * 10) / 10),
  }

  // Distinct meal names from recent history — so suggestions can reference
  // foods she actually eats.
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
      if (usual.length >= 30) break
    }
  }

  const workoutLabel = WORKOUT_LABELS[type] || "workout"
  const focus = recoveryFocus(type, minutes)

  // She's already eaten enough today to cover recovery — don't push more
  // food. The client shows a quiet "you're covered" card instead. This also
  // skips the model call entirely.
  const covered =
    remaining.protein <= Math.max(12, goals.protein * 0.15) &&
    remaining.carbs <= Math.max(25, goals.carbs * 0.15) &&
    remaining.fat <= Math.max(10, goals.fat * 0.15)
  if (covered) {
    return NextResponse.json({ tip: null, covered: true, workoutLabel, remaining })
  }

  let tip: any = null
  try {
    const res = await getAnthropic().messages.create({
      model: TEXT_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are a calm, encouraging nutrition coach inside a food-tracking app. The user just finished a ${minutes}-minute ${workoutLabel}. Based on the workout AND what she's eaten so far today versus her goals, give short recovery guidance for her next meal.

CRITICAL — FOOD SENSITIVITY: she may have a complicated relationship with food. Never shame, scold, or moralize. Never label foods "good", "bad", "clean", "cheat", or "guilty". Never praise eating very little. Never suggest eating less, skipping meals, fasting, "earning" food, working out to burn off food, or "making up for" anything. Frame everything as fueling her recovery — what her body gets to have, not what it must pay back. Never do calorie math ("you burned X so eat X"). Every claim must come from the data below — never invent meals or numbers.

DATA:
- Workout: ${minutes}-minute ${workoutLabel} (recovery priority: ${focus})
- Daily goals: ${goals.calories} cal, ${goals.protein}g protein, ${goals.carbs}g carbs, ${goals.fat}g fat
- Eaten so far today: ${totals.calories} cal, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fat}g fat
- Remaining today: ${remaining.calories} cal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat
- Foods she eats often: ${usual.join("; ") || "unknown"}

TASK: Write like a friendly dietitian texting her — plain-spoken, warm, brief, zero judgment. Subtle, not coachy.
- "headline": casual and short, like "a little protein will help those muscles recover". No hype, no exclamation marks. Never name a meal (no breakfast/lunch/dinner) — always say "next meal".
- "detail": exactly one sentence, conversational. Tie it to recovery and how she'll feel (not sore tomorrow, steady energy), never to numbers. Never say she's "behind", "low", or "lacking" — just note what would help most now.
- "suggestions": 3 specific, simple recovery-friendly foods or small meals — prefer her usual foods when they fit. Keep each under 5 words.
- "hydration": one short, casual reminder to drink water (e.g. "get some water in too"). Keep it under 10 words.
- The whole thing must read in 3 seconds. If what she's already eaten covers recovery well, say so warmly instead of pushing more food.

Return ONLY valid JSON, no markdown fences:
{
  "headline": "short, casual recovery guidance",
  "focus": "protein" | "carbs" | "balanced",
  "detail": "1-2 sentences on recovery; never name the meal — always say 'next meal'",
  "suggestions": ["specific food 1", "specific food 2", "specific food 3"],
  "hydration": "short water reminder"
}`,
        },
      ],
    })
    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    const parsed = extractJson(text)
    if (parsed?.headline && Array.isArray(parsed?.suggestions)) {
      tip = {
        headline: String(parsed.headline).slice(0, 120),
        focus: ["protein", "carbs", "balanced"].includes(parsed.focus)
          ? parsed.focus
          : "balanced",
        detail: String(parsed.detail || "").slice(0, 300),
        suggestions: parsed.suggestions
          .map((s: any) => String(s).slice(0, 80))
          .filter(Boolean)
          .slice(0, 3),
        hydration: String(parsed.hydration || "").slice(0, 120) || null,
      }
    }
  } catch (err) {
    console.error("COACH WORKOUT FAILED:", err)
  }

  return NextResponse.json({ tip, covered: false, workoutLabel, remaining })
}
