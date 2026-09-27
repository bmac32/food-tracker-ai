import { NextResponse } from "next/server"
import { getRouteUser } from "@/lib/supabaseServer"

/**
 * GET /api/workout-image?q=<query>&type=<workoutType>
 * Workout photos live here — NOT in /api/food-image. The food endpoint
 * runs the dish learning loop and food fallbacks, which is exactly how
 * a workout ended up showing a food photo. This route is workouts only:
 *   1. Unsplash search, if UNSPLASH_ACCESS_KEY is set.
 *   2. Openverse (api.openverse.org) — free, no key.
 *   3. { fallback: true } — the client uses the curated per-type set in
 *      lib/workoutImageFallbacks.ts (every ID visually verified).
 */
function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return { signal: ctrl.signal, done: () => clearTimeout(t) }
}

async function alive(url: string): Promise<boolean> {
  const { signal, done } = withTimeout(4000)
  try {
    const res = await fetch(url, { method: "HEAD", signal, redirect: "follow" })
    return res.ok
  } catch {
    return false
  } finally {
    done()
  }
}

async function unsplashSearch(q: string, accessKey: string): Promise<string[]> {
  try {
    const { signal, done } = withTimeout(8000)
    let data: any
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
          q
        )}&per_page=8&orientation=landscape&content_filter=high`,
        { headers: { Authorization: `Client-ID ${accessKey}` }, signal }
      )
      if (!res.ok) return []
      data = await res.json()
    } finally {
      done()
    }
    const organic = (data.results || []).filter((r: any) => !r.sponsorship)
    const pool = organic.length > 0 ? organic : data.results || []
    const out: string[] = []
    const seen = new Set<string>()
    for (const r of pool) {
      const u: unknown = r?.urls?.regular
      if (typeof u !== "string" || !u.length || seen.has(u)) continue
      seen.add(u)
      out.push(u)
      if (out.length >= 4) break
    }
    return out
  } catch (err) {
    console.error("WORKOUT UNSPLASH SEARCH FAILED:", err)
    return []
  }
}

async function openverseSearch(q: string): Promise<string[]> {
  try {
    const params = new URLSearchParams({ q, page_size: "8", filter_dead: "true" })
    const { signal, done } = withTimeout(8000)
    let data: any
    try {
      const res = await fetch(`https://api.openverse.org/v1/images/?${params.toString()}`, {
        signal,
      })
      if (!res.ok) return []
      data = await res.json()
    } finally {
      done()
    }
    const out: string[] = []
    const seen = new Set<string>()
    for (const r of data?.results || []) {
      const u: unknown = r?.url
      if (typeof u !== "string" || !/^https:\/\//.test(u) || seen.has(u)) continue
      seen.add(u)
      out.push(u)
      if (out.length >= 4) break
    }
    return out
  } catch (err) {
    console.error("WORKOUT OPENVERSE SEARCH FAILED:", err)
    return []
  }
}

export async function GET(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response

  const params = new URL(req.url).searchParams
  const q = (params.get("q") || "workout fitness").trim().slice(0, 80)

  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (accessKey) {
    const urls = await unsplashSearch(q, accessKey)
    for (const url of urls) {
      if (await alive(url)) return NextResponse.json({ url })
    }
  }

  const ovUrls = await openverseSearch(q)
  for (const url of ovUrls) {
    if (await alive(url)) return NextResponse.json({ url })
  }

  return NextResponse.json({ fallback: true })
}
