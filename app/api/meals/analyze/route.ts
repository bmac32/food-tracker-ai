import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const CLAUDE = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// 🔥 CLEAN + NORMALIZE FOODS
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

// 🔥 PICK PRIMARY FOOD (for better images)
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

export async function POST(req: Request) {
  try {
    const { imageUrl, text } = await req.json()

    // -------------------------
    // 🔥 TEXT MODE
    // -------------------------
    if (text) {
      try {
        const res = await CLAUDE.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `
You are a nutrition expert.

A user described their meal as:
"${text}"

Infer realistic ingredients and portion sizes.

Return ONLY JSON:
{
 "meal_name": "",
 "foods": ["specific foods only"],
 "protein": number,
 "carbs": number,
 "fat": number,
 "calories": number
}
`,
            },
          ],
        })

        let responseText =
          res.content[0]?.type === "text"
            ? res.content[0].text
            : ""

        responseText = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim()

        const start = responseText.indexOf("{")
        const end = responseText.lastIndexOf("}")

        let final = JSON.parse(responseText.slice(start, end + 1))

        // ✅ CLEAN + ENHANCE
        final.foods = cleanFoods(final.foods || [])
        final.primary_food = getPrimaryFood(final.foods)

        return NextResponse.json(final)

      } catch (err) {
        console.error("TEXT MODE FAILED:", err)
      }
    }

    // -------------------------
    // 🖼 IMAGE MODE
    // -------------------------

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image or text provided" },
        { status: 400 }
      )
    }

    const imageResponse = await fetch(imageUrl)
    const buffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(buffer).toString("base64")

    // -------------------------
    // GEMINI (FAST PASS)
    // -------------------------

    let foodsArray: string[] = []

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: "List the EXACT foods visible. No categories. Comma separated only.",
                  },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
          }),
        }
      )

      const geminiData = await geminiRes.json()

      const rawText =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ""

      foodsArray = rawText
        .toLowerCase()
        .replace(/\n/g, ",")
        .replace(/\./g, "")
        .split(",")
        .map((f: string) => f.trim())
        .filter((f: string) => f.length > 2)

    } catch (e) {
      console.error("GEMINI FAILED", e)
    }

    // -------------------------
    // CLAUDE VISION FALLBACK
    // -------------------------

    if (!foodsArray.length) {
      try {
        const res = await CLAUDE.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 200,
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
                  text: "List the EXACT foods visible. No categories. Comma separated only.",
                },
              ],
            },
          ],
        })

        const text =
          res.content[0]?.type === "text"
            ? res.content[0].text
            : ""

        foodsArray = text
          .toLowerCase()
          .split(",")
          .map((f: string) => f.trim())
          .filter((f: string) => f.length > 2)

      } catch (e) {
        console.error("CLAUDE VISION FAILED", e)
      }
    }

    // -------------------------
    // CLEAN FOODS
    // -------------------------

    foodsArray = cleanFoods(foodsArray)

    // -------------------------
    // DESCRIPTION
    // -------------------------

    let descriptionText = foodsArray.join(", ")

    try {
      const res = await CLAUDE.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 300,
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
                text: "Describe this meal in detail. List all visible foods specifically.",
              },
            ],
          },
        ],
      })

      descriptionText =
        res.content[0]?.type === "text"
          ? res.content[0].text
          : descriptionText

    } catch (e) {
      console.error("DESCRIPTION FAILED", e)
    }

    // -------------------------
    // STRUCTURE
    // -------------------------

    let final = null

    try {
      const res = await CLAUDE.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `
Given this meal:

${descriptionText}

Return ONLY JSON:
{
 "meal_name": "",
 "foods": [],
 "protein": number,
 "carbs": number,
 "fat": number,
 "calories": number
}
`,
          },
        ],
      })

      let text =
        res.content[0]?.type === "text"
          ? res.content[0].text
          : ""

      text = text.replace(/```json/g, "").replace(/```/g, "").trim()

      const start = text.indexOf("{")
      const end = text.lastIndexOf("}")

      final = JSON.parse(text.slice(start, end + 1))

      // ✅ CLEAN + ENHANCE
      final.foods = cleanFoods(final.foods || foodsArray)
      final.primary_food = getPrimaryFood(final.foods)

    } catch (e) {
      console.error("STRUCTURE FAILED", e)
    }

    // -------------------------
    // FINAL FALLBACK
    // -------------------------

    if (!final) {
      const fallbackFoods = cleanFoods(foodsArray)

      final = {
        meal_name: "Meal",
        foods: fallbackFoods.length ? fallbackFoods : ["meal"],
        primary_food: getPrimaryFood(fallbackFoods),
        protein: 30,
        carbs: 40,
        fat: 15,
        calories: 400,
      }
    }

    return NextResponse.json(final)

  } catch (error) {
    console.error("🚨 FULL PIPELINE ERROR:", error)

    return NextResponse.json({
      meal_name: "Meal",
      foods: ["meal"],
      primary_food: "meal",
      protein: 30,
      carbs: 40,
      fat: 15,
      calories: 400,
    })
  }
}