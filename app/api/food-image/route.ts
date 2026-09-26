import { NextResponse } from "next/server"
import { getRouteUser } from "@/lib/supabaseServer"

/**
 * GET /api/food-image?q=<query>&exclude=<csv>
 * Authenticated server-side food-photo search.
 *
 * Chain (first hit wins — all free):
 *   1. Unsplash search, if UNSPLASH_ACCESS_KEY is set (best quality).
 *   2. Openverse (api.openverse.org) — free, no key, real dish photos.
 *   3. { fallback: true } — the client shows a curated category set.
 *
 * The key stays server-side: NEXT_PUBLIC_* keys ship in the browser
 * bundle, and a leaked key can be rate-limited or abused on the quota.
 */
const FALLBACK = "https://images.unsplash.com/photo-1504674900247-0877df9cc836"

/** Extract the stable `photo-<id>` token so we can dedupe/exclude. */
function photoId(url: string): string | null {
  const m = /photo-[a-z0-9-]+/i.exec(url)
  return m ? m[0].toLowerCase() : null
}

function buildExclude(raw: string): Set<string> {
  const set = new Set<string>()
  for (const part of (raw || "").split(",")) {
    const u = part.trim()
    if (!u) continue
    set.add(u)
    const id = photoId(u)
    if (id) set.add(id)
  }
  return set
}

function isExcluded(url: string, exclude: Set<string>): boolean {
  const u = url.trim()
  if (exclude.has(u)) return true
  const id = photoId(u)
  return !!id && exclude.has(id)
}

function withTimeout(ms: number): {
  signal: AbortSignal
  done: () => void
} {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return { signal: ctrl.signal, done: () => clearTimeout(t) }
}

/** Quick liveness check so we never hand the UI a dead image URL. */
async function alive(url: string): Promise<boolean> {
  const { signal, done } = withTimeout(4000)
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal,
      redirect: "follow",
    })
    return res.ok
  } catch {
    return false
  } finally {
    done()
  }
}

/** Unsplash search — only when the key is configured. */
async function unsplashSearch(
  q: string,
  accessKey: string,
  exclude: Set<string>
): Promise<string[]> {
  try {
    const { signal, done } = withTimeout(8000)
    let data: any
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
          q
        )}&per_page=12&orientation=squarish&content_filter=high`,
        {
          headers: { Authorization: `Client-ID ${accessKey}` },
          signal,
        }
      )
      if (!res.ok) return []
      data = await res.json()
    } finally {
      done()
    }

    // Prefer organic results over sponsored ones.
    const organic = (data.results || []).filter((r: any) => !r.sponsorship)
    const pool = organic.length > 0 ? organic : data.results || []

    return [
      ...new Set(
        pool
          .map((r: any) => r.urls?.regular)
          .filter((u: any) => typeof u === "string" && u.length > 0)
          .filter((u: string) => !isExcluded(u, exclude))
      ),
    ].slice(0, 6)
  } catch (err) {
    console.error("UNSPLASH SEARCH FAILED:", err)
    return []
  }
}

/**
 * Openverse — free image search, no key needed. Returns real photos of
 * the actual dish (mostly Flickr). Validated with HEAD so dead links
 * never reach the UI.
 */
async function openverseSearch(
  q: string,
  exclude: Set<string>
): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      q,
      page_size: "12",
      filter_dead: "true",
    })
    const { signal, done } = withTimeout(8000)
    let data: any
    try {
      const res = await fetch(
        `https://api.openverse.org/v1/images/?${params.toString()}`,
        { signal }
      )
      if (!res.ok) return []
      data = await res.json()
    } finally {
      done()
    }

    const candidates = [
      ...new Set(
        (data?.results || [])
          .map((r: any) => r?.url)
          .filter(
            (u: any) =>
              typeof u === "string" &&
              /^https:\/\//.test(u) &&
              !isExcluded(u, exclude)
          )
      ),
    ].slice(0, 8)

    // Liveness check in parallel; keep the survivors, cap at 6.
    const checks = await Promise.all(
      candidates.map(async (u) => ((await alive(u)) ? u : null))
    )
    return checks.filter((u): u is string => !!u).slice(0, 6)
  } catch (err) {
    console.error("OPENVERSE SEARCH FAILED:", err)
    return []
  }
}

export async function GET(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response

  const params = new URL(req.url).searchParams
  const q = params.get("q")?.trim().slice(0, 80)
  if (!q) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 })
  }

  // URLs already shown elsewhere today — exclude them so the day view
  // doesn't repeat the same photo across meals.
  const exclude = buildExclude(params.get("exclude") || "")

  // 1. Unsplash, when configured.
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  let urls: string[] = accessKey
    ? await unsplashSearch(q, accessKey, exclude)
    : []

  // 2. Openverse — free, no key.
  if (!urls.length) urls = await openverseSearch(q, exclude)

  // 3. Client-side curated fallbacks.
  if (!urls.length) {
    return NextResponse.json({ url: FALLBACK, urls: [FALLBACK], fallback: true })
  }

  return NextResponse.json({ url: urls[0], urls, fallback: false })
}
