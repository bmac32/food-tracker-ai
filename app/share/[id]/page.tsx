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
      <div className="min-h-screen flex items-center justify-center text-[#9AA3B2]">
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
    <div className="min-h-screen bg-[#0F1115] text-white p-5 space-y-5">

      {/* IMAGE */}
      {meal?.photo_url && (
        <img
          src={meal.photo_url}
          className="w-full h-[180px] object-cover rounded-2xl"
        />
      )}

      {/* MACROS */}
      {analysis && (
        <div className="flex justify-between text-sm">

          <div className="text-center">
            <p className="text-lg font-semibold">{analysis.calories}</p>
            <p className="text-[#9AA3B2] text-xs">cal</p>
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold">{analysis.protein}g</p>
            <p className="text-[#9AA3B2] text-xs">protein</p>
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold">{analysis.carbs}g</p>
            <p className="text-[#9AA3B2] text-xs">carbs</p>
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold">{analysis.fat}g</p>
            <p className="text-[#9AA3B2] text-xs">fat</p>
          </div>

        </div>
      )}

      {/* INGREDIENTS */}
      {analysis?.foods && (
        <div className="space-y-1">

          <p className="text-xs text-[#6B7280]">
            Ingredients
          </p>

          <div className="flex flex-wrap gap-1.5">
            {analysis.foods.map((food: string, i: number) => (
              <div
                key={i}
                className="px-2 py-0.5 rounded-full bg-[#171A21] text-xs text-[#9AA3B2]"
              >
                {food}
              </div>
            ))}
          </div>

        </div>
      )}

      {/* MESSAGE */}
      {data.message && (
        <div className="pt-2 border-t border-[#232734]">
          <p className="text-xs text-[#9AA3B2] mb-1">
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
        <div className="bg-[#171A21] rounded-xl p-3">
          <p className="text-xs text-[#6FCF97] mb-1">
            Insight received
          </p>
          <p className="text-sm">
            {data.reply_message}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#9AA3B2]">
            Reply to {data.sender_name || "sender"}
          </p>
          
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Add your insight..."
            className="w-full p-3 rounded-xl bg-[#171A21] text-white placeholder-[#6B7280]"
          />

          <button
            onClick={handleReply}
            disabled={!reply}
            className={`w-full py-2 rounded-xl transition ${
              reply
                ? "bg-white text-black active:scale-[0.98]"
                : "bg-[#232734] text-[#6B7280]"
            }`}
          >
            Send insight
          </button>

          {submitted && (
            <p className="text-xs text-center text-[#9AA3B2]">
              Insight sent
            </p>
          )}
        </>
      )}
</div>
    </div>
  )
}