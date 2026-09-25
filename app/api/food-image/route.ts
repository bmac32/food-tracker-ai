import { NextResponse } from "next/server"
import { getRouteUser } from "@/lib/supabaseServer"

/**
 * GET /api/food-image?q=<query>&orientation=<squarish|landscape>
 * Authenticated server-side proxy for Unsplash search.
 *
 * Why: the Unsplash access key must NOT ship in the browser bundle
 * (NEXT_PUBLIC_* keys are visible to anyone who opens devtools, and a
 * leaked key can be rate-limited or abused on your quota). The key now
 * lives in the server-only `UNSPLASH_ACCESS_KEY` env var.
 */
const FALLBACK =
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352"

export async function GET(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response

  const params = new URL(req.url).searchParams
  const q = params.get("q")?.trim().slice(0, 80)
  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 })
  }
  const orientation =
    params.get("orientation") === "landscape" ? "landscape" : "squarish"

  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    return NextResponse.json({ url: FALLBACK })
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        q
      )}&per_page=10&orientation=${orientation}`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
      }
    )

    if (!res.ok) throw new Error(`Unsplash HTTP ${res.status}`)

    const data = await res.json()
    if (!data.results?.length) throw new Error("No results")

    // Prefer organic results over sponsored ones.
    const organic = data.results.filter((r: any) => !r.sponsorship)
    const pool = organic.length > 0 ? organic : data.results
    const pick = pool[Math.floor(Math.random() * pool.length)]

    return NextResponse.json({ url: pick.urls.regular })
  } catch (err) {
    console.error("UNSPLASH PROXY FAILED:", err)
    return NextResponse.json({ url: FALLBACK })
  }
}
