import { NextResponse } from "next/server"
import { getRouteUser } from "@/lib/supabaseServer"
import type { WorkoutType } from "@/lib/workoutMeta"

/**
 * GET /api/workout-image?q=<query>&type=<workoutType>
 * Workout photos live here — NOT in /api/food-image. The food endpoint
 * runs the dish learning loop and food fallbacks, which is exactly how
 * a workout ended up showing a food photo. This route is workouts only:
 *   1. Unsplash search, if UNSPLASH_ACCESS_KEY is set.
 *   2. Openverse (api.openverse.org) — free, no key.
 *   3. { fallback: true } — the client uses the curated per-type set in
 *      lib/workoutImageFallbacks.ts (every ID visually verified).
 *
 * Returns { candidates: string[] } — several alive-verified photos so the
 * client can show a picker (swipe/chevrons, like the meal photo picker)
 * instead of one fixed image. VARIETY: the same fixed query always returns
 * the same top hits, which is why the same workout photo showed for weeks.
 * Each request rotates through per-type query variants, a random result
 * page, and shuffles the pool before picking — so every log (and every
 * "new photos" tap) sees different options. No AI generation, no metered
 * APIs: stock photos only.
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

// Per-type query variants. One is picked at random per request so repeated
// logs of the same workout type surface different photos.
const QUERY_VARIANTS: Record<WorkoutType, string[]> = {
  running: ["running sunrise outdoor", "trail running mountains", "marathon runners city"],
  walking: ["walking trail outdoor path", "hiking forest trail", "morning walk park"],
  cycling: ["cycling road bike outdoor", "mountain biking trail", "cyclist sunset ride"],
  swimming: ["swimming pool athlete", "open water swimmer", "swimming laps training"],
  weightlifting: ["weightlifting gym strength training", "barbell squat gym", "dumbbell workout"],
  yoga: ["yoga studio calm", "yoga outdoor morning", "yoga pose beach"],
  hiit: ["hiit workout intense training", "battle ropes gym", "kettlebell training"],
  sports: ["sports team athletic action", "soccer player stadium", "tennis player court"],
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const TARGET = 6

async function unsplashSearch(q: string, accessKey: string): Promise<string[]> {
  try {
    const page = 1 + Math.floor(Math.random() * 3) // pages 1-3
    const { signal, done } = withTimeout(8000)
    let data: any
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
          q
        )}&per_page=12&page=${page}&orientation=landscape&content_filter=high`,
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
    for (const r of shuffled<any>(pool)) {
      const u: unknown = r?.urls?.regular
      if (typeof u !== "string" || !u.length || seen.has(u)) continue
      seen.add(u)
      out.push(u)
      if (out.length >= TARGET) break
    }
    return out
  } catch (err) {
    console.error("WORKOUT UNSPLASH SEARCH FAILED:", err)
    return []
  }
}

async function openverseSearch(q: string): Promise<string[]> {
  try {
    const page = 1 + Math.floor(Math.random() * 3) // pages 1-3
    const params = new URLSearchParams({
      q,
      page_size: "12",
      page: String(page),
      filter_dead: "true",
    })
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
    for (const r of shuffled<any>(data?.results || [])) {
      const u: unknown = r?.url
      if (typeof u !== "string" || !/^https:\/\//.test(u) || seen.has(u)) continue
      seen.add(u)
      out.push(u)
      if (out.length >= TARGET) break
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
  const type = (params.get("type") || "walking") as WorkoutType
  const variants = QUERY_VARIANTS[type] || QUERY_VARIANTS.walking
  // Honor an explicit query when given (e.g. from the logger), otherwise
  // rotate variants so the same workout type doesn't always show the same
  // top hits.
  const q = (params.get("q") || "").trim().slice(0, 80) || pick(variants)

  const pool: string[] = []
  const seen = new Set<string>()

  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (accessKey) {
    for (const u of await unsplashSearch(q, accessKey)) {
      if (!seen.has(u)) {
        seen.add(u)
        pool.push(u)
      }
    }
  }

  if (pool.length < TARGET) {
    for (const u of await openverseSearch(q)) {
      if (!seen.has(u)) {
        seen.add(u)
        pool.push(u)
      }
    }
  }

  // Verify aliveness in parallel, keep the first TARGET that load.
  const checks = await Promise.all(pool.map(async (u) => ({ u, ok: await alive(u) })))
  const candidates = checks.filter((c) => c.ok).map((c) => c.u).slice(0, TARGET)

  if (candidates.length === 0) {
    return NextResponse.json({ fallback: true })
  }

  return NextResponse.json({ candidates, url: candidates[0] })
}
