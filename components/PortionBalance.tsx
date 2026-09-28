"use client"

import { useState, useRef } from "react"
import { ChevronDown, ChartPie, Pencil, Check } from "lucide-react"

// Collapsible "where your macros come from" breakdown. Read-only and
// shame-free: it informs the portion balance, never instructs.
// Used on the review card and on saved meals in the feed.
//
// Teach-the-app: when `teachable`, tapping a food opens a small editor to
// correct its macros ("pickles = 0 fat"). The correction is saved as the
// food's truth and wins over USDA/AI in all future analyses — correct once,
// remembered forever. Framed as teaching the app about the FOOD, never as
// fixing the meal or the person.
export type PortionShareItem = {
  item: string
  protein: number
  carbs: number
  fat: number
  /** Serving grams the macros above describe (needed to store per-100g). */
  grams?: number
  /** "yours" | "usda" | "ai" — drives the honest "~" on estimates. */
  source?: string
  /** "hers" once she confirms the portion — until then the AI guessed it. */
  gramsSource?: string
  /** Per-100g reference values when known (USDA / her correction). */
  per100?: { protein: number; carbs: number; fat: number } | null
}

export type TeachMacros = { protein: number; carbs: number; fat: number }

type Props = {
  items: PortionShareItem[]
  className?: string
  /** Show the teach affordance on rows that have a known serving size. */
  teachable?: boolean
  /** Called after the correction is saved; caller updates its own state.
   *  gramsConfirmed is true only when she actually touched the amount field —
   *  an untouched AI portion stays an estimate even after a macro correction. */
  onTeach?: (
    item: string,
    grams: number,
    macros: TeachMacros,
    gramsConfirmed: boolean
  ) => Promise<void>
}

type ShareMode = "calories" | "protein" | "carbs" | "fat"
const SHARE_MODES: ShareMode[] = ["calories", "protein", "carbs", "fat"]

// Muted editorial segment colors for the share bar.
const SEGMENT_COLORS = [
  "#c98f4e",
  "#7ba05b",
  "#5b8dc9",
  "#c96a5b",
  "#9b7fc9",
  "#5bc9b0",
  "#c95b85",
  "#7f8dc9",
]

const calsOf = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9
const r1 = (n: number) => Math.round(n * 10) / 10

export default function PortionBalance({
  items,
  className = "",
  teachable = false,
  onTeach,
}: Props) {
  const [open, setOpen] = useState(false)
  const [shareMode, setShareMode] = useState<ShareMode>("calories")
  // Teach-the-app editor state.
  const [teaching, setTeaching] = useState<number | null>(null)
  const [draft, setDraft] = useState<TeachMacros>({ protein: 0, carbs: 0, fat: 0 })
  const [draftGrams, setDraftGrams] = useState(0)
  const [gramsDirty, setGramsDirty] = useState(false)
  // Grams the draft macros were last scaled from — rescaling is always
  // relative to the previous draft, never compounded off the original.
  const scaledFromRef = useRef(0)
  const [savingTeach, setSavingTeach] = useState(false)
  const [taught, setTaught] = useState<string | null>(null)

  if (!items || items.length === 0) return null

  // Honest "~": a number is exact only when the per-100g values AND the
  // portion are both trusted. The AI's portion guess keeps the "~" even
  // on USDA-backed items — she clears it by confirming the amount.
  const isEstimated = (it: PortionShareItem) =>
    (it.source !== "yours" && it.source !== "usda") || it.gramsSource !== "hers"
  const anyEstimated = items.some(isEstimated)
  const canTeach = (it: PortionShareItem) =>
    teachable && !!onTeach && (it.grams ?? 0) > 0

  const startTeaching = (index: number) => {
    const it = items[index]
    setDraft({
      protein: Math.round(it.protein * 10) / 10,
      carbs: Math.round(it.carbs * 10) / 10,
      fat: Math.round(it.fat * 10) / 10,
    })
    setDraftGrams(it.grams ?? 0)
    scaledFromRef.current = it.grams ?? 0
    setGramsDirty(false)
    setTeaching(index)
    setTaught(null)
  }

  // Changing the amount rescales the macros live: from per-100g values when
  // known, otherwise proportionally from the previous draft amount.
  const changeGrams = (g: number) => {
    if (teaching === null) return
    const grams = Math.max(0, g || 0)
    const it = items[teaching]
    const from = scaledFromRef.current
    setDraftGrams(grams)
    setGramsDirty(true)
    if (it.per100 && grams > 0) {
      const k = grams / 100
      setDraft({
        protein: r1(it.per100.protein * k),
        carbs: r1(it.per100.carbs * k),
        fat: r1(it.per100.fat * k),
      })
      scaledFromRef.current = grams
    } else if (from > 0 && grams > 0) {
      const k = grams / from
      setDraft((d) => ({
        protein: r1(d.protein * k),
        carbs: r1(d.carbs * k),
        fat: r1(d.fat * k),
      }))
      scaledFromRef.current = grams
    }
  }

  const saveTeaching = async () => {
    if (teaching === null || !onTeach) return
    const it = items[teaching]
    const grams = draftGrams > 0 ? draftGrams : it.grams ?? 0
    if (grams <= 0) return
    setSavingTeach(true)
    try {
      await onTeach(
        it.item,
        grams,
        {
          protein: Math.max(0, draft.protein || 0),
          carbs: Math.max(0, draft.carbs || 0),
          fat: Math.max(0, draft.fat || 0),
        },
        gramsDirty
      )
      setTaught(it.item)
    } finally {
      setSavingTeach(false)
      setTeaching(null)
    }
  }

  const shareValues = items.map((it) =>
    shareMode === "calories"
      ? calsOf(it.protein, it.carbs, it.fat)
      : it[shareMode]
  )
  const shareTotal = shareValues.reduce((s, v) => s + v, 0)
  const shares = shareValues.map((v) =>
    shareTotal > 0 ? Math.round((v / shareTotal) * 100) : 0
  )

  return (
    <div className={className}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 bg-surface-2 border border-hair rounded-xl px-3 py-2.5 text-xs text-ink transition-all duration-150 ease-spring hover:bg-white/10 active:scale-[0.99]"
      >
        <ChartPie size={14} className="text-protein shrink-0" />
        <span className="flex-1 text-left font-medium">
          {open ? "My portions" : "View my portions"}
        </span>
        <ChevronDown
          size={14}
          className={`text-ink-faint shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-2 animate-fade-in">
          {/* mode toggle */}
          <div className="flex bg-surface-2 rounded-full p-0.5 text-[11px] mb-2">
            {SHARE_MODES.map((mode) => (
              <button
                key={mode}
                onClick={() => setShareMode(mode)}
                className={`flex-1 px-1 py-0.5 rounded-full capitalize transition-all duration-150 active:scale-95 ${
                  shareMode === mode
                    ? "bg-ground text-ink"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* stacked share bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-2 mb-1">
            {items.map((it, i) =>
              shares[i] > 0 ? (
                <div
                  key={i}
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${shares[i]}%`,
                    backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                  }}
                />
              ) : null
            )}
          </div>

          {/* per-ingredient shares */}
          <div className="divide-y divide-hair/50">
            {items.map((it, i) => {
              const teachableRow = canTeach(it)
              const row = (
                <>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                    }}
                  />
                  <span className="flex-1 truncate text-xs text-ink">
                    {it.item}
                  </span>
                  {taught === it.item ? (
                    <span className="flex items-center gap-1 text-[11px] text-protein shrink-0">
                      <Check size={12} /> Remembered
                    </span>
                  ) : (
                    <>
                      {teachableRow && (
                        <Pencil
                          size={11}
                          className="text-ink-faint/60 shrink-0"
                        />
                      )}
                      <span className="text-[11px] text-ink-faint tabular-nums shrink-0">
                        {shares[i]}%
                      </span>
                    </>
                  )}
                </>
              )
              return (
                <div key={i}>
                  {teachableRow ? (
                    <button
                      onClick={() => {
                        if (teaching === i) setTeaching(null)
                        else startTeaching(i)
                      }}
                      className="w-full flex items-center gap-2 py-1.5 text-left active:opacity-70"
                      title={`Teach the app about ${it.item}`}
                    >
                      {row}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 py-1.5">{row}</div>
                  )}

                  {/* teach-the-app editor */}
                  {teaching === i && (
                    <div className="pb-3 pt-1 px-1 animate-fade-in">
                      <p className="text-xs font-medium text-ink">
                        Teach the app about {it.item}
                      </p>
                      <p className="text-[11px] text-ink-faint mt-0.5 mb-2">
                        {isEstimated(it) ? "This was an estimate (~). " : ""}
                        What should I remember for next time?
                      </p>
                      <label className="block mb-2">
                        <span className="block text-[10px] text-ink-faint mb-1">
                          Amount (g){it.gramsSource !== "hers" ? " — the AI guessed this" : ""}
                        </span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={draftGrams || ""}
                          placeholder={String(it.grams ?? 0)}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => changeGrams(Number(e.target.value))}
                          className="w-full bg-ground border border-hair rounded-lg px-2 py-1.5 text-xs text-ink tabular-nums outline-none transition focus:border-ink/40"
                        />
                      </label>
                      <div className="flex gap-2">
                        {(
                          [
                            ["protein", "Protein"],
                            ["carbs", "Carbs"],
                            ["fat", "Fat"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="flex-1">
                            <span className="block text-[10px] text-ink-faint mb-1">
                              {isEstimated(it) ? "~" : ""}
                              {label} (g)
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              value={draft[key]}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  [key]: Number(e.target.value),
                                }))
                              }
                              className="w-full bg-ground border border-hair rounded-lg px-2 py-1.5 text-xs text-ink tabular-nums outline-none transition focus:border-ink/40"
                            />
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setTeaching(null)}
                          className="flex-1 py-2 rounded-lg text-xs text-ink-faint active:scale-[0.98]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveTeaching}
                          disabled={savingTeach}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-ink text-ground active:scale-[0.98] disabled:opacity-50"
                        >
                          {savingTeach ? "Remembering…" : "Remember"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* honesty footnote — explains the "~" and teaches the gesture */}
          {teachable && anyEstimated && (
            <p className="text-[10px] text-ink-faint pt-2 leading-relaxed">
              Numbers marked ~ are estimates. Tap any food to teach the app
              its macros and portion, and it will remember.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
