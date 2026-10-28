/**
 * Same as usual (Feature 2) — the Coast interaction.
 *
 * A "usual" is a meal logged 3+ times in the last 60 days, grouped by
 * normalized meal name. The re-log reuses the latest instance's analysis
 * and photo wholesale — no new AI call, no typing, no photo needed.
 *
 * This module is pure (no Supabase, no fetch) so the grouping rules are
 * unit-testable. The route supplies rows newest-first; the first row per
 * group is therefore the latest instance, and its analysis and photo are
 * what a one-tap log replays.
 */
import { normalizeFoodKey } from "./foodWords"

export type UsualMealRow = {
  ai_analysis: any
  photo_url: string | null
  created_at: string
}

export type Usual = {
  meal_name: string
  times_logged: number
  last_logged_at: string
  photo_url: string | null
  /** The latest instance's full analysis — replayed verbatim on re-log. */
  analysis: any
  calories: number
  protein: number
  carbs: number
  fat: number
}

const num = (n: any): number => {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

function parseAnalysis(raw: any): any | null {
  try {
    const ai = typeof raw === "string" ? JSON.parse(raw) : raw
    if (!ai || typeof ai !== "object") return null
    return ai
  } catch {
    return null
  }
}

export function computeUsuals(
  rows: UsualMealRow[],
  options: { minCount?: number; limit?: number } = {}
): Usual[] {
  const minCount = options.minCount ?? 3
  const limit = options.limit ?? 3
  if (!Array.isArray(rows)) return []

  type Group = {
    name: string
    count: number
    analysis: any
    photo_url: string | null
    created_at: string
  }
  const groups = new Map<string, Group>()
  for (const row of rows) {
    const ai = parseAnalysis(row?.ai_analysis)
    if (!ai) continue
    const name = String(ai.meal_name || "").trim()
    const key = normalizeFoodKey(name)
    if (!key) continue
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
    } else {
      groups.set(key, {
        name,
        count: 1,
        analysis: ai,
        photo_url: row?.photo_url ?? null,
        created_at: String(row?.created_at || ""),
      })
    }
  }

  return [...groups.values()]
    .filter((g) => g.count >= minCount)
    .sort(
      (a, b) =>
        b.count - a.count ||
        (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : 0)
    )
    .slice(0, limit)
    .map((g) => ({
      meal_name: g.name,
      times_logged: g.count,
      last_logged_at: g.created_at,
      photo_url: g.photo_url,
      analysis: g.analysis,
      calories: Math.round(num(g.analysis.calories)),
      protein: num(g.analysis.protein),
      carbs: num(g.analysis.carbs),
      fat: num(g.analysis.fat),
    }))
}
