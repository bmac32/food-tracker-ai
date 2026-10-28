"use client"

import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { normalizeFoodKey } from "@/lib/foodTruth"
import type { Usual } from "@/lib/usuals"

/**
 * Same as usual (Feature 2) — the Coast interaction.
 *
 * Renders the usuals list ONLY: the page owns the chrome (the "Log a
 * meal" chooser button opens this inside a modal). Rows are her most
 * repeated meals (3+ logs in 60 days, top 3). Tapping Log replays the
 * meal's latest analysis and photo through the page's save path — no
 * review card, no typing, no photo.
 *
 * Self-contained on purpose: it fetches its own usuals and the viewed
 * day's meals (to mark what's already logged) instead of plumbing
 * through MealFeed. On fetch failure it renders a quiet empty line —
 * a shortcut must never break the log flow.
 */
export default function UsualsCard({
  viewedDate,
  refreshTrigger,
  onLog,
}: {
  viewedDate: Date
  refreshTrigger: number
  onLog: (usual: Usual) => Promise<void>
}) {
  const [usuals, setUsuals] = useState<Usual[] | null>(null)
  const [loggedNames, setLoggedNames] = useState<Set<string>>(new Set())
  const [loggedKeys, setLoggedKeys] = useState<Set<string>>(new Set())
  const [loggingKey, setLoggingKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/meals/usuals")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setUsuals(Array.isArray(d?.usuals) ? d.usuals : [])
      })
      .catch(() => {
        if (!cancelled) setUsuals([])
      })
    return () => {
      cancelled = true
    }
  }, [refreshTrigger])

  // What's already on the viewed day, so the list never offers a meal
  // she already ate today. Refetches after every save via refreshTrigger.
  useEffect(() => {
    let cancelled = false
    const start = new Date(viewedDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(viewedDate)
    end.setHours(23, 59, 59, 999)
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!user || cancelled) return null
        return supabase
          .from("meals")
          .select("ai_analysis")
          .eq("user_id", user.id)
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .limit(100)
      })
      .then((res: any) => {
        if (cancelled || !res || res.error) return
        const names = new Set<string>()
        for (const row of res.data || []) {
          try {
            const ai =
              typeof row.ai_analysis === "string"
                ? JSON.parse(row.ai_analysis)
                : row.ai_analysis
            const key = normalizeFoodKey(String(ai?.meal_name || ""))
            if (key) names.add(key)
          } catch {
            // Skip unparseable rows — they can't match a usual anyway.
          }
        }
        setLoggedNames(names)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [viewedDate, refreshTrigger])

  const handleLog = async (usual: Usual) => {
    const key = normalizeFoodKey(usual.meal_name)
    setLoggingKey(key)
    try {
      await onLog(usual)
      setLoggedKeys((prev) => new Set(prev).add(key))
    } catch {
      // Page already reported the error; the row just stays tappable.
    } finally {
      setLoggingKey(null)
    }
  }

  if (usuals === null) {
    return <p className="text-sm text-ink-dim">Loading your usuals...</p>
  }

  if (usuals.length === 0) {
    return (
      <p className="text-sm text-ink-dim leading-relaxed">
        No repeats yet — log a meal 3 times and it&apos;ll show up here.
      </p>
    )
  }

  return (
    <div>
      {usuals.map((u) => {
        const key = normalizeFoodKey(u.meal_name)
        const done = loggedKeys.has(key) || loggedNames.has(key)
        const busy = loggingKey === key
        return (
          <div
            key={key}
            className="flex gap-3 items-center py-3 border-t border-hair first:border-t-0 first:pt-0"
          >
            {u.photo_url && (
              <img
                src={u.photo_url}
                alt=""
                className="w-14 h-14 rounded-xl object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink truncate">
                {u.meal_name}
              </div>
              <div className="text-xs text-ink-dim mt-0.5">
                {u.calories} cal · {u.protein}p / {u.carbs}c / {u.fat}f
              </div>
              <div className="text-xs text-ink-dim mt-0.5">
                Logged {u.times_logged}x
              </div>
            </div>
            <button
              disabled={done || busy}
              onClick={() => handleLog(u)}
              className={`min-w-[68px] h-11 px-4 rounded-full text-sm font-bold shrink-0 transition-all active:scale-[0.97] ${
                done || busy
                  ? "bg-surface-2 text-ink-faint cursor-default"
                  : "bg-ink text-ground hover:bg-ink/90"
              }`}
            >
              {done ? "Logged ✓" : busy ? "Logging..." : "Log"}
            </button>
          </div>
        )
      })}
    </div>
  )
}
