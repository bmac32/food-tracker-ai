import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getRouteUser, createServerSupabase } from "@/lib/supabaseServer"

/**
 * POST /api/fridge/suggest
 * Authenticated. Body: { imageUrl } — a photo of the fridge interior,
 * uploaded to this app's own Supabase storage (same flow as meal photos).
 *
 * What it does:
 *  1. Vision pass: identify visible foods/ingredients (Gemini Flash,
 *     Claude vision fallback).
 *  2. Server-side: sum today's macros + goals + workouts → remaining gaps.
 *  3. Text pass: suggest 3 fridge-based meals that close the biggest gaps.
 *
 * Cost: 2 cheap calls per snap. No fake data — honest errors if any
 * pass fails or no food is visible.
 */
function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured")
  return new Anthropic({ apiKey })
}

const TEXT_MODEL = process.env.AI_TEXT_MODEL ?? "claude-haiku-4-5"
const VISION_FALLBACK_MODEL =
  process.env.AI_VISION_FALLBACK_MODEL ?? "claude-haiku-4-5"
const PHOTO_MODEL = process.env.AI_PHOTO_MODEL ?? "gemini-1.5-flash"
const GOOGLE_KEY = process.env.GOOGLE_AI_API_KEY

// Fridge snaps are heavier (2 calls) — tighter quota than meal analysis.
const RATE_LIMIT = 15
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

// Same SSRF guard as /api/meals/analyze — only our own storage host.
function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:") return false
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      return u.hostname === new URL(supabaseUrl).hostname
    }
    return true
  } catch {
    return false
  }
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

// ---------------------------------------------------------------------------
// Vision: what's in the fridge?
// ---------------------------------------------------------------------------
const FRIDGE_VISION_PROMPT = `Look at this photo of the inside of a refrigerator. List every identifiable food or ingredient you can see, with an approximate quantity for each. Be specific ("eggs", "greek yogurt", "chicken breast" — not "dairy" or "food"). Ignore non-food items, blurry unidentifiable blobs, and condiments you can't name.

Return ONLY valid JSON, no markdown fences:
{
 "ingredients": [{ "item": "", "amount": "" }]
}`

async function identifyFridgeWithGemini(base64Image: string) {
  if (!GOOGLE_KEY) throw new Error("GOOGLE_AI_API_KEY not configured")
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${PHOTO_MODEL}:generateContent?key=${GOOGLE_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: FRIDGE_VISION_PROMPT },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } },
            ],
          },
        ],
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
  if (!text) throw new Error("Gemini returned no text")
  return extractJson(text)
}

async function identifyFridgeWithClaude(base64Image: string) {
  const res = await getAnthropic().messages.create({
    model: VISION_FALLBACK_MODEL,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: base64Image },
          },
          { type: "text", text: FRIDGE_VISION_PROMPT },
        ],
      },
    ],
  })
  const content = res.content[0]
  const text = content?.type === "text" ? content.text : ""
  return extractJson(text)
}

// ---------------------------------------------------------------------------
// Text: what should they make?
// ---------------------------------------------------------------------------
async function suggestMeals(
  ingredients: { item: string; amount: string }[],
  remaining: { calories: number; protein: number; carbs: number; fat: number },
  eaten: { calories: number; protein: number; carbs: number; fat: number }
) {
  const ingredientList = ingredients
    .map((i) => (i.amount ? `${i.item} (${i.amount})` : i.item))
    .join(", ")

  const prompt = `You are a practical nutrition coach. A user doesn't know what to eat and photographed their fridge.

Visible fridge ingredients: ${ingredientList}

Their day so far: ${eaten.calories} cal, ${eaten.protein}g protein, ${eaten.carbs}g carbs, ${eaten.fat}g fat eaten.
Still needed today: ${remaining.calories} cal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat.

Assume common pantry staples (cooking oil, salt, pepper, basic spices, common condiments). Suggest exactly 3 DIFFERENT meals that:
1. Are made mostly from the visible fridge ingredients (say which ones each uses),
2. Prioritize closing the biggest remaining macro gaps — lead with protein if protein is the largest gap,
3. Are realistic to actually cook (15-30 min), with a 1-2 sentence method.

Keep estimates honest and realistic for one serving.

Return ONLY valid JSON, no markdown fences:
{
 "suggestions": [
   {
     "name": "",
     "uses": ["fridge ingredient", "..."],
     "description": "1-2 sentences: what it is and how to make it",
     "calories": number,
     "protein": number,
     "carbs": number,
     "fat": number,
     "why": "one short line tying it to their gaps, e.g. 'Adds 34g protein toward your remaining 41g'"
   }
 ]
}`

  const res = await getAnthropic().messages.create({
    model: TEXT_MODEL,
    max_tokens: 900,
    messages: [{ role: "user", content: prompt }],
  })
  const content = res.content[0]
  const text = content?.type === "text" ? content.text : ""
  return extractJson(text)
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response

  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: "Too many fridge scans — please try again in a bit." },
      { status: 429 }
    )
  }

  try {
    const { imageUrl } = await req.json()

    if (!imageUrl || !isAllowedImageUrl(String(imageUrl))) {
      return NextResponse.json(
        { error: "A valid fridge photo is required." },
        { status: 400 }
      )
    }

    // ---- Fetch the photo ----
    let base64Image: string
    try {
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) throw new Error(`Image fetch ${imageResponse.status}`)
      base64Image = Buffer.from(await imageResponse.arrayBuffer()).toString("base64")
    } catch (err) {
      console.error("FRIDGE IMAGE FETCH FAILED:", err)
      return NextResponse.json(
        { error: "Couldn't load the photo — please try again." },
        { status: 500 }
      )
    }

    // ---- Vision: identify ingredients (Gemini, Claude fallback) ----
    let identified: any = null
    try {
      identified = await identifyFridgeWithGemini(base64Image)
    } catch (err) {
      console.error("FRIDGE GEMINI FAILED:", err)
    }
    if (!identified) {
      try {
        identified = await identifyFridgeWithClaude(base64Image)
      } catch (err) {
        console.error("FRIDGE CLAUDE VISION FAILED:", err)
      }
    }
    if (!identified) {
      return NextResponse.json(
        { error: "Couldn't read that photo — please try again." },
        { status: 500 }
      )
    }

    const ingredients = (Array.isArray(identified.ingredients)
      ? identified.ingredients
      : []
    )
      .map((i: any) => ({
        item: String(i?.item || "").trim(),
        amount: String(i?.amount || "").trim(),
      }))
      .filter((i: any) => i.item.length > 1)
      .slice(0, 20)

    if (ingredients.length === 0) {
      return NextResponse.json(
        {
          error:
            "Couldn't spot any food in that photo — try a clearer shot of the inside of your fridge.",
        },
        { status: 422 }
      )
    }

    // ---- Server-side: today's totals vs goals → remaining gaps ----
    // RLS scopes these to the authenticated user; never trust client math.
    const supabase = await createServerSupabase()
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const [{ data: meals }, { data: goalRows }, { data: workouts }] =
      await Promise.all([
        supabase
          .from("meals")
          .select("ai_analysis")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString()),
        supabase
          .from("user_goals")
          .select("calories, protein, carbs, fat")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("workouts")
          .select("calories_burned")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString()),
      ])

    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    for (const m of meals || []) {
      let ai: any = null
      try {
        ai =
          typeof m.ai_analysis === "string"
            ? JSON.parse(m.ai_analysis)
            : m.ai_analysis
      } catch {}
      totals.calories += num(ai?.calories)
      totals.protein += num(ai?.protein)
      totals.carbs += num(ai?.carbs)
      totals.fat += num(ai?.fat)
    }

    const burned = (workouts || []).reduce(
      (s: number, w: any) => s + num(w?.calories_burned),
      0
    )
    const netCalories = Math.max(0, totals.calories - burned)

    const g = goalRows?.[0]
    const goals = {
      calories: num(g?.calories) || 2000,
      protein: num(g?.protein) || 150,
      carbs: num(g?.carbs) || 200,
      fat: num(g?.fat) || 70,
    }

    const remaining = {
      calories: Math.max(0, goals.calories - netCalories),
      protein: Math.max(0, goals.protein - totals.protein),
      carbs: Math.max(0, goals.carbs - totals.carbs),
      fat: Math.max(0, goals.fat - totals.fat),
    }

    // ---- Text: suggest gap-closing meals ----
    let suggested: any = null
    try {
      suggested = await suggestMeals(ingredients, remaining, totals)
    } catch (err) {
      console.error("FRIDGE SUGGEST FAILED:", err)
    }
    if (!suggested) {
      return NextResponse.json(
        { error: "Couldn't come up with suggestions — please try again." },
        { status: 500 }
      )
    }

    const suggestions = (Array.isArray(suggested.suggestions)
      ? suggested.suggestions
      : []
    )
      .slice(0, 3)
      .map((s: any) => ({
        name: String(s?.name || "Fridge meal").slice(0, 80),
        uses: (Array.isArray(s?.uses) ? s.uses : [])
          .map((u: any) => String(u).trim())
          .filter((u: string) => u.length > 0)
          .slice(0, 8),
        description: String(s?.description || "").slice(0, 300),
        calories: num(s?.calories),
        protein: num(s?.protein),
        carbs: num(s?.carbs),
        fat: num(s?.fat),
        why: String(s?.why || "").slice(0, 160),
      }))
      .filter((s: any) => s.name.length > 0)

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: "Couldn't come up with suggestions — please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({ ingredients, remaining, suggestions })
  } catch (error) {
    console.error("FRIDGE ROUTE ERROR:", error)
    return NextResponse.json(
      { error: "Something went wrong — please try again." },
      { status: 500 }
    )
  }
}
