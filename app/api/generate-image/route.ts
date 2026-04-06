import { NextResponse } from "next/server"

// 🔥 EXPANDED FOOD IMAGE SYSTEM (NO RANDOMNESS)
function getImage(prompt: string) {
  const lower = prompt.toLowerCase()

  // -------------------------
  // 🥗 SPECIFIC COMBINATIONS
  // -------------------------
  if (lower.includes("cheese") && lower.includes("cracker")) {
    return "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80"
  }

  if (lower.includes("celery") && lower.includes("ranch")) {
    return "https://images.unsplash.com/photo-wn2Gqyvq2ts?w=800&q=80"
  }

  // -------------------------
  // 🍽️ BREAKFAST / COMMON FOODS
  // -------------------------
  if (lower.includes("oatmeal") || lower.includes("oats")) {
    return "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800&q=80"
  }

  if (lower.includes("egg")) {
    return "https://images.unsplash.com/photo-1506089676908-3592f7389d4d?w=800&q=80"
  }

  if (lower.includes("toast")) {
    return "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80"
  }

  if (lower.includes("smoothie")) {
    return "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=800&q=80"
  }

  // -------------------------
  // 🥗 LUNCH / DINNER
  // -------------------------
  if (lower.includes("salad")) {
    return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80"
  }

  if (lower.includes("chicken")) {
    return "https://images.unsplash.com/photo-1604908554027-5b0f1d0c5c90?w=800&q=80"
  }

  if (lower.includes("rice")) {
    return "https://images.unsplash.com/photo-1512058564366-c9e3e046c88c?w=800&q=80"
  }

  if (lower.includes("pasta")) {
    return "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&q=80"
  }

  // -------------------------
  // 🧀 SINGLE INGREDIENTS
  // -------------------------
  if (lower.includes("cheese")) {
    return "https://images.unsplash.com/photo-1559561853-08451507cbe7?w=800&q=80"
  }

  if (lower.includes("cracker")) {
    return "https://images.unsplash.com/photo-1585238342028-4f8c0d3b0f9b?w=800&q=80"
  }

  if (lower.includes("celery")) {
    return "https://images.unsplash.com/photo-wn2Gqyvq2ts?w=800&q=80"
  }

  if (lower.includes("apple")) {
    return "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=800&q=80"
  }

  if (lower.includes("banana")) {
    return "https://images.unsplash.com/photo-1574226516831-e1dff420e37f?w=800&q=80"
  }

  // -------------------------
  // 🔥 FINAL FALLBACK (CONTROLLED)
  // -------------------------
  return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()

    console.log("🧠 IMAGE PROMPT:", prompt)

    const imageUrl = getImage(prompt)

    console.log("🖼️ SELECTED IMAGE:", imageUrl)

    return NextResponse.json({ imageUrl })
  } catch (err) {
    console.error("❌ IMAGE ROUTE ERROR:", err)

    return NextResponse.json({
      imageUrl:
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
    })
  }
}