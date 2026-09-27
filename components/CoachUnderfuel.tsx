"use client"

import { Eye, X } from "lucide-react"

export type UnderfuelCard = {
  headline: string
  body: string
  source: string
}

/**
 * Under-fueling opinion card (backlog #10) — the dietitian's honest take
 * on a multi-day under-eating pattern. Lives in the coach, same voice as
 * the meal cards — never a separate warning UI.
 *
 * Fires at most once per 7 days (client-side cooldown), only on a real
 * pattern (4+ of the last 7 logged days under 80% of goal) — never a
 * single light day. The X is the opt-out for now; the master coach
 * toggle (backlog #8) will subsume it.
 */
export default function CoachUnderfuel({
  card,
  onClose,
}: {
  card: UnderfuelCard
  onClose: () => void
}) {
  return (
    <div className="relative bg-surface border border-hair rounded-[22px] p-4 overflow-hidden animate-fade-slide-up">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-ink-faint text-xs transition-all duration-150 hover:bg-black/50 hover:text-ink active:scale-90"
        aria-label="Dismiss"
      >
        ✕
      </button>

      <div className="relative space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-surface-2 border border-hair flex items-center justify-center shrink-0">
            <Eye size={12} className="text-ink-faint" />
          </span>
          <p className="text-[11px] font-semibold tracking-wide text-ink-faint">
            Something I&apos;ve noticed
          </p>
        </div>

        <h3 className="text-[15px] font-bold tracking-tight text-ink">
          {card.headline}
        </h3>

        <p className="text-[13px] text-ink-dim leading-relaxed">{card.body}</p>

        {card.source && (
          <p className="text-[11px] text-ink-faint pt-0.5">
            Grounded in {card.source}
          </p>
        )}
      </div>
    </div>
  )
}
