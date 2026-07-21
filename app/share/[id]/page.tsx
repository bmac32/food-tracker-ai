"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "../../../lib/supabase"

export default function SharePage() {
  const params = useParams()
  const id = params.id as string

  const [data, setData] = useState<any>(null)
  const [reply, setReply] = useState("")
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    loadShare()
  }, [])

  async function loadShare() {
    const { data, error } = await supabase
      .from("shared_meals")
      .select(`
        *,
        meals (*)
      `)
      .eq("id", id)
      .single()

    if (error) {
      console.error(error)
      return
    }

    setData(data)
  }
  // ✅ ADD THIS RIGHT HERE
  async function handleReply() {
    if (!reply) return

    await supabase
      .from("shared_meals")
      .update({ reply_message: reply })
      .eq("id", id)

    setSubmitted(true)
    setReply("")
    loadShare()
  }


  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ground text-ink-dim">
        Loading...
      </div>
    )
  }

  const meal = data?.meals

  const analysis =
    typeof meal?.ai_analysis === "string"
      ? JSON.parse(meal.ai_analysis)
      : meal?.ai_analysis

  return (
    <div className="min-h-screen bg-ground text-ink p-5 space-y-5">

      {/* IMAGE */}
      {meal?.photo_url && (
        <img
          src={meal.photo_url}
          className="w-full h-[180px] object-cover rounded-[22px]"
        />
      )}

      {/* MACROS */}
      {analysis && (
        <div className="flex justify-between text-sm font-semibold tabular-nums">

          <div className="text-center">
            <p className="text-lg text-cal">{analysis.calories}</p>
            <p className="text-ink-faint text-xs font-normal">cal</p>
          </div>

          <div className="text-center">
            <p className="text-lg text-protein">{analysis.protein}g</p>
            <p className="text-ink-faint text-xs font-normal">protein</p>
          </div>

          <div className="text-center">
            <p className="text-lg text-carb">{analysis.carbs}g</p>
            <p className="text-ink-faint text-xs font-normal">carbs</p>
          </div>

          <div className="text-center">
            <p className="text-lg text-fat">{analysis.fat}g</p>
            <p className="text-ink-faint text-xs font-normal">fat</p>
          </div>

        </div>
      )}

      {/* INGREDIENTS */}
      {analysis?.foods && (
        <div className="space-y-1">

          <p className="text-xs text-ink-faint">
            Ingredients
          </p>

          <div className="flex flex-wrap gap-1.5">
            {analysis.foods.map((food: string, i: number) => (
              <div
                key={i}
                className="px-2 py-0.5 rounded-full bg-surface text-xs text-ink-dim"
              >
                {food}
              </div>
            ))}
          </div>

        </div>
      )}

      {/* MESSAGE */}
      {data.message && (
        <div className="pt-2 border-t border-hair">
          <p className="text-xs text-ink-faint mb-1">
            Shared with you
          </p>
          <p className="text-lg leading-snug">
            “{data.message}”
          </p>
        </div>
      )}
      {/* REPLY */}
      <div className="space-y-2 pt-2">

      {data.reply_message ? (
        <div className="bg-surface rounded-xl p-3">
          <p className="text-xs text-protein mb-1">
            Insight received
          </p>
          <p className="text-sm text-ink">
            {data.reply_message}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-faint">
            Reply to {data.sender_name || "sender"}
          </p>

          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Add your insight..."
            className="w-full p-3 rounded-xl bg-surface border border-hair text-ink placeholder-ink-faint outline-none transition focus:border-ink/40"
          />

          <button
            onClick={handleReply}
            disabled={!reply}
            className={`w-full py-2 rounded-xl transition-all duration-200 ease-spring active:scale-[0.98] ${
              reply
                ? "bg-ink text-ground hover:bg-ink/90"
                : "bg-surface-2 text-ink-faint cursor-not-allowed"
            }`}
          >
            Send insight
          </button>

          {submitted && (
            <p className="text-xs text-center text-ink-faint animate-fade-in">
              Insight sent
            </p>
          )}
        </>
      )}
</div>
    </div>
  )
}