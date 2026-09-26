import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getRouteUser } from "@/lib/supabaseServer"

/**
 * POST /api/meals/analyze
 * Authenticated. Analyzes a meal from text or a photo URL.
 *
 * Cost design (deliberately cheap):
 *  - Text mode: 1 cheap Claude call.
 *  - Photo mode: 1 Gemini Flash call (structured JSON, single pass),
 *    falling back to 1 cheap Claude vision call.
 *  - No fake data: if every pass fails, returns an honest 500 error.
 *
 * Model names are env-configurable — verify the exact model IDs in your
 * provider dashboards, because wrong IDs 404 and names change often.
 *
 * API clients are created lazily per-request so a missing env var fails
 * the request (with a clear error) instead of crashing the route module
 * at import/build time.
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

// ---------------------------------------------------------------------------
// Per-user rate limit: protects the AI quota from runaway clients.
// (In-memory — good enough for a single-instance/small deployment.)
// ---------------------------------------------------------------------------
const RATE_LIMIT = 30 // analyses per window
const WINDOW_MS = 60 * 60 * 1000 // 1 hour
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

// ---------------------------------------------------------------------------
// imageUrl validation — the route fetches this URL server-side, so lock it
// down: https only, and only from this app's own Supabase storage host.
// This blocks SSRF probes against internal services.
// ---------------------------------------------------------------------------
function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== "https:") return false

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      return u.hostname === new URL(supabaseUrl).hostname
    }
    return true // https-only fallback if env is missing
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cleanFoods(foods: string[]): string[] {
  const GENERIC = ["protein", "vegetables", "grain", "food", "meal"]

  return foods
    .map((f) =>
      f
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .trim()
    )
    .filter((f) => f.length > 2 && !GENERIC.includes(f))
    .slice(0, 5)
}

function getPrimaryFood(foods: string[]) {
  if (!foods.length) return "food"

  const PRIORITY = [
    "chicken",
    "steak",
    "salmon",
    "shrimp",
    "egg",
    "pasta",
    "burger",
    "pizza",
    "rice",
    "avocado",
  ]

  for (const p of PRIORITY) {
    const match = foods.find((f) => f.includes(p))
    if (match) return match
  }

  return foods[0]
}

/** Extract a JSON object from an LLM response that may include fences. */
function extractJson(text: string): any {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("No JSON object found")
  return JSON.parse(cleaned.slice(start, end + 1))
}

const JSON_INSTRUCTION = `Return ONLY valid JSON, no markdown fences:
{
 "meal_name": "",
 "foods": ["specific foods only"],
 "protein": number,
 "carbs": number,
 "fat": number,
 "calories": number,
 "image_query": "3-6 word stock-photo search describing this dish as plated, e.g. 'fluffy scrambled eggs on toast'"
}`

function finalize(raw: any, fallbackFoods: string[] = []) {
  const foods = cleanFoods(raw?.foods?.length ? raw.foods : fallbackFoods)
  const imageQuery =
    typeof raw?.image_query === "string" ? raw.image_query.slice(0, 60).trim() : ""
  return {
    meal_name: raw?.meal_name || "Meal",
    foods,
    primary_food: getPrimaryFood(foods),
    image_query: imageQuery,
    protein: Number(raw?.protein) || 0,
    carbs: Number(raw?.carbs) || 0,
    fat: Number(raw?.fat) || 0,
    calories: Number(raw?.calories) || 0,
  }
}

// ---------------------------------------------------------------------------
// Text mode — 1 cheap call
// ---------------------------------------------------------------------------
async function analyzeText(text: string) {
  const res = await getAnthropic().messages.create({
    model: TEXT_MODEL,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `You are a nutrition expert. A user described their meal as: "${text}". Infer realistic ingredients and portion sizes.\n\n${JSON_INSTRUCTION}`,
      },
    ],
  })

  const content = res.content[0]
  const responseText = content?.type === "text" ? content.text : ""
  return finalize(extractJson(responseText))
}

// ---------------------------------------------------------------------------
// Photo mode — Gemini Flash single structured pass (cheap)
// ---------------------------------------------------------------------------
async function analyzePhotoWithGemini(base64Image: string) {
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
              {
                text: `You are a nutrition expert. Look at this meal photo. Identify every visible food with realistic portion sizes, then estimate macros.\n\n${JSON_INSTRUCTION}`,
              },
              {
                // NOTE: the Gemini REST field is camelCase `inlineData`
                // (snake_case `inline_data` silently fails).
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Image,
                },
              },
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

  return finalize(extractJson(text))
}

// ---------------------------------------------------------------------------
// Photo fallback — 1 cheap Claude vision call (single structured pass)
// ---------------------------------------------------------------------------
async function analyzePhotoWithClaude(base64Image: string) {
  const res = await getAnthropic().messages.create({
    model: VISION_FALLBACK_MODEL,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `You are a nutrition expert. Look at this meal photo. Identify every visible food with realistic portion sizes, then estimate macros.\n\n${JSON_INSTRUCTION}`,
          },
        ],
      },
    ],
  })

  const content = res.content[0]
  const text = content?.type === "text" ? content.text : ""
  return finalize(extractJson(text))
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response

  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: "Too many analyses — please try again in a bit." },
      { status: 429 }
    )
  }

  try {
    const { imageUrl, text } = await req.json()

    // ---------------- TEXT MODE ----------------
    if (text) {
      try {
        return NextResponse.json(await analyzeText(String(text)))
      } catch (err) {
        console.error("TEXT MODE FAILED:", err)
        return NextResponse.json(
          { error: "AI analysis failed — please try again." },
          { status: 500 }
        )
      }
    }

    // ---------------- PHOTO MODE ----------------
    if (!imageUrl || !isAllowedImageUrl(String(imageUrl))) {
      return NextResponse.json(
        { error: "A valid meal photo is required." },
        { status: 400 }
      )
    }

    let base64Image: string
    try {
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) throw new Error(`Image fetch ${imageResponse.status}`)
      base64Image = Buffer.from(await imageResponse.arrayBuffer()).toString("base64")
    } catch (err) {
      console.error("IMAGE FETCH FAILED:", err)
      return NextResponse.json(
        { error: "Couldn't load the photo — please try again." },
        { status: 500 }
      )
    }

    // Pass 1: cheap Gemini structured pass
    try {
      return NextResponse.json(await analyzePhotoWithGemini(base64Image))
    } catch (err) {
      console.error("GEMINI PHOTO FAILED:", err)
    }

    // Pass 2: cheap Claude vision fallback
    try {
      return NextResponse.json(await analyzePhotoWithClaude(base64Image))
    } catch (err) {
      console.error("CLAUDE VISION FAILED:", err)
    }

    // No fake data — ever. An honest error beats invented macros.
    return NextResponse.json(
      { error: "AI analysis failed — please try again." },
      { status: 500 }
    )
  } catch (error) {
    console.error("ANALYZE ROUTE ERROR:", error)
    return NextResponse.json(
      { error: "AI analysis failed — please try again." },
      { status: 500 }
    )
  }
}
