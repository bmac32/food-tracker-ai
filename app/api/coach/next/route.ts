import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"

/**
 * GET /api/coach/next?start=ISO&end=ISO&hour=13
 * Live coach: after a meal is logged, looks at what she's eaten SO FAR
 * today vs her goals and suggests what to prioritize for the NEXT meal —
 * guidance in the moment, not a post-mortem.
 *
 * Shame-free and ED-sensitive by construction: everything is framed as
 * what to add, never what to avoid. No moralizing, no restriction talk.
 */
function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured")
  return new Anthropic({ apiKey })
}

const TEXT_MODEL = process.env.AI_TEXT_MODEL ?? "claude-haiku-4-5"

// Light rate limit: guidance is per-meal, not per-keystroke.
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

function nextMealLabel(hour: number): string {
  if (hour < 10) return "breakfast"
  if (hour < 14) return "lunch"
  if (hour < 21) return "dinner"
  return "tomorrow's breakfast"
}

export async function GET(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response
  if (isRateLimited(user.id)) {
    return NextResponse.json({ tip: null })
  }

  const params = new URL(req.url).searchParams
  const start = params.get("start")
  const end = params.get("end")
  const hour = Math.min(23, Math.max(0, parseInt(params.get("hour") || "12", 10) || 12))
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
  const mealLines: string[] = []
  for (const m of meals || []) {
    const ai =
      typeof m.ai_analysis === "string" ? JSON.parse(m.ai_analysis) : m.ai_analysis
    totals.calories += num(ai?.calories)
    totals.protein += num(ai?.protein)
    totals.carbs += num(ai?.carbs)
    totals.fat += num(ai?.fat)
    const name = ai?.meal_name || "meal"
    mealLines.push(
      `${name} (${num(ai?.calories)} cal, ${num(ai?.protein)}p/${num(ai?.carbs)}c/${num(ai?.fat)}f)`
    )
  }
  for (const k of Object.keys(totals) as (keyof typeof totals)[]) {
    totals[k] = Math.round(totals[k] * 10) / 10
  }

  if (!mealLines.length) return NextResponse.json({ tip: null })

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

  const remaining = {
    calories: Math.max(0, Math.round(goals.calories - totals.calories)),
    protein: Math.max(0, Math.round((goals.protein - totals.protein) * 10) / 10),
    carbs: Math.max(0, Math.round((goals.carbs - totals.carbs) * 10) / 10),
    fat: Math.max(0, Math.round((goals.fat - totals.fat) * 10) / 10),
  }

  const nextMeal = nextMealLabel(hour)

  let tip: any = null
  try {
    const res = await getAnthropic().messages.create({
      model: TEXT_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are a calm, encouraging nutrition coach inside a food-tracking app. The user just logged a meal. Based ONLY on what she's eaten so far today versus her goals, give short guidance for her next meal (${nextMeal}).

CRITICAL — FOOD SENSITIVITY: she may have a complicated relationship with food. Never shame, scold, or moralize. Never label foods "good", "bad", "clean", "cheat", or "guilty". Never praise eating very little. Never suggest eating less, skipping meals, fasting, or "making up for" anything. Frame everything as what TO add and enjoy, not what to avoid. Every claim must come from the data below — never invent meals or numbers.

DATA:
- Daily goals: ${goals.calories} cal, ${goals.protein}g protein, ${goals.carbs}g carbs, ${goals.fat}g fat
- Eaten so far today (${mealLines.length} meal${mealLines.length === 1 ? "" : "s"}): ${totals.calories} cal, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fat}g fat
- Remaining today: ${remaining.calories} cal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat
- Meals today: ${mealLines.join("; ")}
- Foods she eats often: ${usual.join("; ") || "unknown"}

TASK: Write like a friendly dietitian texting her — plain-spoken, warm, brief, zero judgment. Subtle, not coachy.
- "headline": casual and short, like "grab some protein at lunch". No hype, no exclamation marks.
- "detail": exactly one sentence, conversational. If relevant, tie it to how she'll feel (energy, hunger) rather than the numbers. Never say she's "behind", "low", or "lacking" — just note what she hasn't had much of yet. At most one number, ideally none.
- "suggestions": 3 specific, simple foods or small meals that fill the gap — prefer her usual foods when they fit. Keep each under 5 words.
- The whole thing must read in 3 seconds. If she's on track across the board, say so warmly in one line (e.g. "you're eating well today — keep doing what you're doing") with 3 easy, balanced suggestions.

Return ONLY valid JSON, no markdown fences:
{
  "headline": "short, casual, like 'grab some protein at lunch'",
  "focus": "protein" | "carbs" | "fat" | "balanced",
  "detail": "1-2 sentences tying it to what she ate today; name the meal",
  "suggestions": ["specific food 1", "specific food 2", "specific food 3"]
}`,
        },
      ],
    })
    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    const parsed = extractJson(text)
    if (parsed?.headline && Array.isArray(parsed?.suggestions)) {
      tip = {
        headline: String(parsed.headline).slice(0, 120),
        focus: ["protein", "carbs", "fat", "balanced"].includes(parsed.focus)
          ? parsed.focus
          : "balanced",
        detail: String(parsed.detail || "").slice(0, 300),
        suggestions: parsed.suggestions
          .map((s: any) => String(s).slice(0, 80))
          .filter(Boolean)
          .slice(0, 3),
      }
    }
  } catch (err) {
    console.error("COACH NEXT FAILED:", err)
  }

  return NextResponse.json({ tip, nextMeal, mealsLogged: mealLines.length })
}
