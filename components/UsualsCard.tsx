"use client"

import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { normalizeFoodKey } from "@/lib/foodTruth"
import type { Usual } from "@/lib/usuals"

/**
 * Same as usual (Feature 2) — the Coast interaction, approved mockup
 * 2026-10-28.
 *
 * Shows her most repeated meals (3+ logs in 60 days, top 3) as one-tap
 * log rows. Tapping Log replays the meal's latest analysis and photo
 * through the page's save path — no review card, no typing, no photo.
 *
 * Self-contained on purpose: it fetches its own usuals and the viewed
 * day's meals (to mark what's already logged) instead of plumbing
 * through MealFeed. On any failure it renders nothing — a shortcut must
 * never break the day view. Dismissal is per viewed day, stored locally,
 * with a Show again link.
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
  const [dismissed, setDismissed] = useState(false)

  const dayKey = viewedDate.toDateString()

  useEffect(() => {
    try {
      setDismissed(
        localStorage.getItem(`usuals-dismissed:${dayKey}`) === "1"
      )
    } catch {
      setDismissed(false)
    }
  }, [dayKey])

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

  // What's already on the viewed day, so the card never offers a meal
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

  const dismiss = () => {
    try {
      localStorage.setItem(`usuals-dismissed:${dayKey}`, "1")
    } catch {}
    setDismissed(true)
  }

  const showAgain = () => {
    try {
      localStorage.removeItem(`usuals-dismissed:${dayKey}`)
    } catch {}
    setDismissed(false)
  }

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

  if (dismissed) {
    return (
      <div className="bg-surface border border-hair rounded-[22px] p-4 text-sm text-ink-dim">
        Usuals hidden for today. They&apos;ll be back tomorrow.{" "}
        <button
          onClick={showAgain}
          className="font-bold text-ink underline underline-offset-2"
        >
          Show again
        </button>
      </div>
    )
  }

  if (!usuals || usuals.length === 0) return null

  return (
    <div className="bg-surface border border-hair rounded-[22px] p-4 space-y-3 relative">
      <button
        onClick={dismiss}
        aria-label="Dismiss usuals for today"
        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-ink-dim text-sm hover:bg-surface-2 active:scale-90"
      >
        ✕
      </button>
      <h2 className="text-base font-bold text-ink pr-8">Same as usual?</h2>
      <p className="text-xs text-ink-dim -mt-2 leading-relaxed">
        From meals you&apos;ve logged 3 or more times. One tap logs it, no
        photo or typing needed. Macros come from your last log.
      </p>
      {usuals.map((u) => {
        const key = normalizeFoodKey(u.meal_name)
        const done = loggedKeys.has(key) || loggedNames.has(key)
        const busy = loggingKey === key
        return (
          <div
            key={key}
            className="flex gap-3 items-center pt-3 border-t border-hair"
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
