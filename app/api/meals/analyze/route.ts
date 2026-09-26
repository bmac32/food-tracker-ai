import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getRouteUser } from "@/lib/supabaseServer"
import { usdaMacrosFor } from "@/lib/usda"

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
 "foods": [{"item": "grilled chicken breast", "grams": 150, "protein": 46, "carbs": 0, "fat": 5}, {"item": "roasted carrots", "grams": 100, "protein": 1, "carbs": 10, "fat": 4}],
 "image_query": "3-6 word stock-photo search describing this dish as plated, e.g. 'fluffy scrambled eggs on toast'. If the meal is several separate items rather than one cooked dish (snack plate, crackers with dips, etc.), describe it as a plate, e.g. 'hummus cheese crackers snack plate'"
}
List EVERY distinct food you can identify as its own item — a meal with steak and carrots is two items, not one. Plain item names, no quantities in the name.`

/**
 * Hybrid accuracy: the model identifies foods and estimates PORTION GRAMS
 * (its best macro guess rides along as fallback). The server then verifies
 * each item against USDA FoodData Central lab data and uses the lab values
 * whenever they exist — the AI only does portion math, never macro invention.
 * Calories are DERIVED via Atwater 4/4/9 so nothing can contradict itself.
 */
const ESTIMATION_RULES = `For each food: give a plain item name (no quantities in the name), your best estimate of grams for a standard home-cooked portion (not restaurant-sized unless the user says so), and your best macro guess per that portion. Only count oils, butter, dressings, or sauces if the user mentions them or they are clearly visible in the photo; never assume hidden fats. The server verifies every item against the USDA database and uses lab-measured values when found — your grams do the portion math, your macros are only the fallback.`

type FoodItem = {
  item: string
  grams: number
  protein: number
  carbs: number
  fat: number
}

/** Normalize the model's foods array (objects now; tolerate legacy strings). */
function toFoodItems(raw: any, fallbackFoods: string[]): FoodItem[] {
  const list = Array.isArray(raw?.foods) ? raw.foods : []
  const items: FoodItem[] = []
  for (const f of list) {
    if (typeof f === "string") {
      const item = f.trim()
      if (item) items.push({ item, grams: 0, protein: 0, carbs: 0, fat: 0 })
    } else if (f && typeof f === "object") {
      const item = String(f.item || "").trim()
      if (!item) continue
      items.push({
        item,
        grams: Number(f.grams) || 0,
        protein: Number(f.protein) || 0,
        carbs: Number(f.carbs) || 0,
        fat: Number(f.fat) || 0,
      })
    }
  }
  if (!items.length) {
    for (const s of fallbackFoods) {
      const item = String(s || "").trim()
      if (item) items.push({ item, grams: 0, protein: 0, carbs: 0, fat: 0 })
    }
  }
  return items.slice(0, 8)
}

async function finalize(raw: any, fallbackFoods: string[] = []) {
  const items = toFoodItems(raw, fallbackFoods)
  const foods = cleanFoods(items.map((i) => i.item))
  const imageQuery =
    typeof raw?.image_query === "string" ? raw.image_query.slice(0, 60).trim() : ""

  // Hybrid: USDA lab values per item when found, AI guess otherwise.
  // Per-item results are kept so the client can offer portion refinement
  // (grams editing) and recompute macros without another round trip.
  let protein = 0
  let carbs = 0
  let fat = 0
  let usdaVerified = 0
  const foodItems: {
    item: string
    grams: number
    protein: number
    carbs: number
    fat: number
    per100: { protein: number; carbs: number; fat: number } | null
  }[] = []
  const r1 = (n: number) => Math.round(n * 10) / 10
  await Promise.all(
    items.map(async (it) => {
      const per100 = await usdaMacrosFor(it.item)
      let p: number
      let c: number
      let f: number
      if (per100 && it.grams > 0) {
        const k = it.grams / 100
        p = per100.protein * k
        c = per100.carbs * k
        f = per100.fat * k
        usdaVerified += 1
      } else {
        p = it.protein
        c = it.carbs
        f = it.fat
      }
      protein += p
      carbs += c
      fat += f
      foodItems.push({
        item: it.item,
        grams: it.grams,
        protein: r1(p),
        carbs: r1(c),
        fat: r1(f),
        per100: per100
          ? {
              protein: r1(per100.protein),
              carbs: r1(per100.carbs),
              fat: r1(per100.fat),
            }
          : null,
      })
    })
  )
  protein = Math.round(protein * 10) / 10
  carbs = Math.round(carbs * 10) / 10
  fat = Math.round(fat * 10) / 10

  // Atwater 4/4/9 — derived, never independently estimated, so the macros
  // and calories always agree with each other.
  const calories = Math.round(protein * 4 + carbs * 4 + fat * 9)
  return {
    meal_name: raw?.meal_name || "Meal",
    foods,
    food_items: foodItems,
    primary_food: getPrimaryFood(foods),
    image_query: imageQuery,
    protein,
    carbs,
    fat,
    calories,
    usda_verified: usdaVerified,
    usda_items: items.length,
  }
}

// ---------------------------------------------------------------------------
// Text mode — 1 cheap call
// ---------------------------------------------------------------------------
async function analyzeText(text: string) {
  const res = await getAnthropic().messages.create({
    model: TEXT_MODEL,
    max_tokens: 700,
    messages: [
      {
        role: "user",
        content: `You are a nutrition expert. A user described their meal as: "${text}". Infer realistic ingredients and portion sizes.\n\n${JSON_INSTRUCTION}\n\n${ESTIMATION_RULES}`,
      },
    ],
  })

  const content = res.content[0]
  const responseText = content?.type === "text" ? content.text : ""
  return finalize(extractJson(responseText))
}

/** Photo prompt — one version per photo count. Multi-photo mode tells the
 *  model the shots are the SAME meal and to merge, never double-count. */
function photoPrompt(count: number): string {
  const multi =
    `These ${count} photos are all the SAME meal (different angles or dishes of one meal). ` +
    `They are labeled Photo 1 of ${count} through Photo ${count} of ${count} below. ` +
    `IMPORTANT: you must consider EVERY photo, not just the first. First, silently note in a short phrase what each photo shows. ` +
    `Then identify every visible food across ALL photos with realistic portion sizes, and estimate macros for the whole meal as one. ` +
    `Merge everything into a single ingredient list — if the same food appears in more than one photo, count it only once.`
  const single =
    `Look at this meal photo. Identify every visible food with realistic portion sizes, then estimate macros.`
  return `You are a nutrition expert. ${count > 1 ? multi : single}\n\n${JSON_INSTRUCTION}\n\n${ESTIMATION_RULES}`
}

// ---------------------------------------------------------------------------
// Photo mode — Gemini Flash single structured pass (cheap)
// ---------------------------------------------------------------------------
async function analyzePhotoWithGemini(base64Images: string[]) {
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
                text: photoPrompt(base64Images.length),
              },
              // Labeled, interleaved images: "Photo 1 of N" labels force the
              // model to attend to every photo instead of fixating on the first.
              // NOTE: the Gemini REST field is camelCase `inlineData`
              // (snake_case `inline_data` silently fails).
              ...base64Images.flatMap((data, i) => [
                { text: `Photo ${i + 1} of ${base64Images.length}:` },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data,
                  },
                },
              ]),
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
async function analyzePhotoWithClaude(base64Images: string[]) {
  const res = await getAnthropic().messages.create({
    model: VISION_FALLBACK_MODEL,
    max_tokens: 900,
    messages: [
      {
        role: "user",
        content: [
          ...base64Images.flatMap((data, i) => [
            {
              type: "text" as const,
              text: `Photo ${i + 1} of ${base64Images.length}:`,
            },
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: "image/jpeg" as const,
                data,
              },
            },
          ]),
          {
            type: "text" as const,
            text: photoPrompt(base64Images.length),
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
    const { imageUrl, imageUrls, text } = await req.json()

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
    // Accepts imageUrls (up to 4, analyzed as ONE meal) or legacy imageUrl.
    let urls: string[] = []
    if (Array.isArray(imageUrls)) urls = imageUrls.map(String)
    else if (imageUrl) urls = [String(imageUrl)]
    urls = urls.filter(Boolean).slice(0, 4)

    if (urls.length === 0 || !urls.every(isAllowedImageUrl)) {
      return NextResponse.json(
        { error: "A valid meal photo is required." },
        { status: 400 }
      )
    }

    let base64Images: string[]
    try {
      base64Images = await Promise.all(
        urls.map(async (u) => {
          const imageResponse = await fetch(u)
          if (!imageResponse.ok) throw new Error(`Image fetch ${imageResponse.status}`)
          return Buffer.from(await imageResponse.arrayBuffer()).toString("base64")
        })
      )
    } catch (err) {
      console.error("IMAGE FETCH FAILED:", err)
      return NextResponse.json(
        { error: "Couldn't load the photo — please try again." },
        { status: 500 }
      )
    }

    // Pass 1: cheap Gemini structured pass
    try {
      const result = await analyzePhotoWithGemini(base64Images)
      return NextResponse.json({ ...result, photos_analyzed: urls.length })
    } catch (err) {
      console.error("GEMINI PHOTO FAILED:", err)
    }

    // Pass 2: cheap Claude vision fallback
    try {
      const result = await analyzePhotoWithClaude(base64Images)
      return NextResponse.json({ ...result, photos_analyzed: urls.length })
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
