"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Send, SlidersHorizontal } from "lucide-react"
import { text } from "stream/consumers"

type Props = {
  currentDate: Date
  refreshTrigger?: number
  optimisticMeals?: any[]
  onDeleteSuccess?: () => void
}

export default function MealFeed({
  currentDate,
  refreshTrigger,
  optimisticMeals = [],
  onDeleteSuccess,
}: Props) {
  const [meals, setMeals] = useState<any[]>([])
  const [deletedIds, setDeletedIds] = useState<number[]>([])
  const [deletingIds, setDeletingIds] = useState<number[]>([])

  const [sharingMeal, setSharingMeal] = useState<any | null>(null)
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [editingMealId, setEditingMealId] = useState<number | null>(null)
  const [editNote, setEditNote] = useState("")
  const [editIngredients, setEditIngredients] = useState<string[]>([])
  const [newIngredient, setNewIngredient] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState("")
  const [shareMessage, setShareMessage] = useState("")
  const [viewedInsights, setViewedInsights] = useState<number[]>([])
  const [shareSent, setShareSent] = useState(false)

  const handleSendShare = async () => {
    if (!sharingMeal || !recipientEmail) return

    // ✅ ADD THIS RIGHT HERE
    console.log("SENDING SHARE:", {
      mealId: sharingMeal?.id,
      recipientEmail,
      message: shareMessage,
    })
    
    try {
      await fetch("/api/share-meal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mealId: sharingMeal.id,
          recipientEmail,
          message: shareMessage,
          senderName: "Bridget",
        }),
      })

      setShareSent(true)

      // delay closing so user sees confirmation
      setTimeout(() => {
        setSharingMeal(null)
        setRecipientEmail("")
        setShareMessage("")
        setShareSent(false)
      }, 900)

    } catch (err) {
      console.error("Share failed", err)
    }
  }

  async function loadMeals() {
    const start = new Date(currentDate)
    start.setHours(0, 0, 0, 0)

    const end = new Date(currentDate)
    end.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from("meals")
      .select(`
        *,
        shared_meals (
          id,
          reply_message
        )
      `)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })

    if (error) {
      console.error("MEALS LOAD ERROR:", error)
      return
    }

    setMeals(data || [])
  }

  useEffect(() => {
    loadMeals()

    const channel = supabase
      .channel("meals-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "meals",
        },
        () => {
          loadMeals()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshTrigger, currentDate])

  const handleDelete = async (meal: any) => {
    if (!meal?.id) return

    setDeletingIds((prev) => [...prev, meal.id])

    if (typeof meal.id !== "string") {
      setTimeout(() => {
        setDeletedIds((prev) => [...prev, meal.id])
        setDeletingIds((prev) => prev.filter((id) => id !== meal.id))
      }, 250)
      return
    }

    try {
      const { error } = await supabase
        .from("meals")
        .delete()
        .eq("id", meal.id)

      if (error) return

      setTimeout(() => {
        setDeletedIds((prev) => [...prev, meal.id])
        setMeals((prev) => prev.filter((m) => m.id !== meal.id))
        setDeletingIds((prev) => prev.filter((id) => id !== meal.id))

        onDeleteSuccess?.()
      }, 250)
    } catch {}
  }

  const [openInsightMealId, setOpenInsightMealId] = useState<number | null>(null)

  const handleShare = (meal: any) => {
    const hasInsight =
      meal.shared_meals?.some(
        (s: any) => s.reply_message && s.reply_message.length > 0
      )

    const isUnseen =
    hasInsight && !viewedInsights.includes(meal.id)

    if (isUnseen) {
      // first tap → show insight
      setOpenInsightMealId((prev) =>
        prev === meal.id ? null : meal.id
      )

      // mark as viewed
      setViewedInsights((prev) =>
        prev.includes(meal.id) ? prev : [...prev, meal.id]
     )

    } else {
      // normal share flow
      setSharingMeal(meal)
    }
  }

  const mergedMeals = [
    ...optimisticMeals,
    ...meals,
  ].filter((meal) => !deletedIds.includes(meal.id))

  return (
    <>
      <div className="mt-8 space-y-6">

        {mergedMeals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-[#6B7280]">
            <p className="text-sm">No meals logged</p>
            <p className="text-xs mt-1 opacity-70">Start by adding a meal above</p>
          </div>
        )}

        {mergedMeals.map((meal) => {
          let ai = null

          try {
            ai =
              typeof meal.ai_analysis === "string"
                ? JSON.parse(meal.ai_analysis)
                : meal.ai_analysis
          } catch {}

          const hasInsight =
            meal.shared_meals?.some(
              (s: any) => s.reply_message && s.reply_message.length > 0
            )

          const isUnseen =
            hasInsight && !viewedInsights.includes(meal.id)

          const imageSrc =
            meal.photo_url ||
            "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80"

          const isDeleting = deletingIds.includes(meal.id)

          return (
            <div
              key={meal.id || meal.created_at}
              className={`bg-[#171A21] border border-[#232734] rounded-2xl overflow-hidden transition-all duration-300 ${
                isDeleting
                  ? "opacity-0 scale-95"
                  : "opacity-100 scale-100 hover:scale-[1.01]"
              }`}
            >
              <div className="relative">
                <img src={imageSrc} className="w-full h-[260px] object-cover" />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                <button
                  onClick={() => {
                    setEditingMealId(meal.id)
                    setEditNote(meal.note || "")
                    
                    const parsed =
                      typeof meal.ai_analysis === "string"
                        ? JSON.parse(meal.ai_analysis)
                        : meal.ai_analysis

                    setEditIngredients(parsed?.foods || [])
                  }}
                  className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white"
                >
                  <SlidersHorizontal size={16} />
                </button>

                <button
                  onClick={() => handleShare(meal)}
                  className={`absolute top-3 right-12 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white transition-all duration-200 ${
                  isUnseen
                    ? "bg-purple-500/40 backdrop-blur-md border border-purple-400/50 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                    : "bg-black/50"
                }`}
                >
                  <Send 
                    size={16}
                    className={hasInsight ? "opacity-100" : "opacity-90"}
                  />
                </button>

                <button
                  onClick={() => handleDelete(meal)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white"
                >
                  ✕
                </button>

                <div className="absolute bottom-3 left-4 right-4">
                  <h2 className="text-white text-base font-semibold">
                    {ai?.meal_name || "Meal"}
                  </h2>
                </div>
              </div>

              <div className="px-4 py-3 space-y-2.5">

                {editingMealId === meal.id ? (
                  <div>
                    {/* INGREDIENT TAGS */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {editIngredients.map((ing, i) => (
                        <span
                          key={i}
                          className="bg-[#232734] px-2 py-1 rounded-full text-xs text-white flex items-center gap-1"
                        >
                          {ing}
                          <button
                            onClick={() =>
                              setEditIngredients((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            className="ml-1"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                    {/* ADD INGREDIENT */}
                    <div className="flex gap-2">
                      <input
                        value={newIngredient}
                        onChange={(e) => setNewIngredient(e.target.value)}
                        placeholder="Add ingredient..."
                        className="flex-1 bg-[#232734] rounded-xl px-3 py-2 text-sm text-white"
                      />
                      <button
                        onClick={() => {
                          if (!newIngredient) return
                          setEditIngredients((prev) => [...prev, newIngredient])
                          setNewIngredient("")
                        }}
                        className="px-3 rounded-xl bg-white text-black text-sm"
                      >
                        Add
                      </button>
                    </div>
                    <div className="border-t border-[#2A2F3A]/60 mt-5 mb-3" />
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="w-full bg-[#232734] rounded-xl p-3 text-sm text-white mt-4"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          if (isSavingEdit) return
                          setIsSavingEdit(true)
                          
                          // ✅ allow UI to update BEFORE heavy async work
                          await new Promise((resolve) => setTimeout(resolve, 50))

                            // ✅ ADD IT HERE (BEFORE try)
                          setMeals((prev) =>
                            prev.map((m) =>
                              m.id === meal.id
                                ? {
                                    ...m,
                                    note: editNote,
                                    ai_analysis: {
                                      ...(typeof m.ai_analysis === "string"
                                        ? JSON.parse(m.ai_analysis)
                                        : m.ai_analysis),
                                      foods: editIngredients,
                                    },
                                  }
                                : m
                            )
                          )

                          // ✅ ADD THIS
                          setEditingMealId(null)

                          try {
                          const res = await fetch("/api/meals/analyze", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              text: editIngredients.join(","),
                              imageURL: null,
                            }),
                          })

                          let updatedAI = null

                          try {
                            const json = await res.json()
                            updatedAI = json.data || json
                          } catch (e) {
                            console.error("JSON ERROR:", e)
                            setIsSavingEdit(false)
                            return
                          }
                          console.log("AI RESULT:", updatedAI)
                          await supabase
                            .from("meals")
                            .update({
                              note: editNote,
                              ai_analysis: updatedAI,
                            })
                            .eq("id", meal.id)
                          setMeals((prev) =>
                            prev.map((m) =>
                              m.id === meal.id 
                                ? { ...m, note: editNote, ai_analysis: updatedAI }
                                : m
                            )
                          )

                          onDeleteSuccess?.()
                          setSaveSuccess(true)
                          
                          setTimeout(() => {
                            setSaveSuccess(false)
                          }, 1500)

                          } catch (e) {
                            console.error(e)
                          } finally {
                            setIsSavingEdit(false)
                          }

                        }}
                        className={`
                          flex-1 py-2 rounded-lg text-sm transition-all duration-200
                          ${isSavingEdit 
                            ? "bg-[#2A2F3A] text-[#6B7280]" 
                            : "bg-white text-black active:scale-[0.97]"
                          }
                        `}
                        disabled={isSavingEdit}                      >
                        {isSavingEdit ? "Saving..." : "Save"}
                      </button>

                      <button
                        onClick={() => setEditingMealId(null)}
                        className="flex-1 py-2 rounded-lg bg-[#232734] text-white text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ai?.foods?.slice(0, 6).map((food: string, i: number) => (
                        <span key={i} className="bg-[#232734] px-2 py-[3px] rounded-full text-[11px]">
                          {food}
                        </span>
                      ))}
                    </div>

                    {meal.note && <p className="text-sm text-white">{meal.note}</p>}
                    
                    {openInsightMealId === meal.id && (
                      <div className="mt-2 p-3 rounded-xl bg-[#0F1115] text-sm text-white border border-[#232734]">
                        {
                          meal.shared_meals?.find(
                            (s: any) => s.reply_message && s.reply_message.length > 0
                          )?.reply_message
                        }
                      </div>
                    )}

                    <div className="flex justify-between text-[11px] text-[#9AA3B2] pt-1.5">
                      <span>{ai?.calories || 0} cal</span>
                      <span>{ai?.protein || 0} p</span>
                      <span>{ai?.carbs || 0} c</span>
                      <span>{ai?.fat || 0} f</span>
                    </div>

                    {hasInsight && (
                      <div className="text-[11px] text-[#9AA3B2] pt-2 italic">
                        Insight received
                      </div>
                    )}

                    <div className="text-[10px] text-right pt-1">
                      {new Date(meal.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )
        })}
      </div>

      {sharingMeal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="w-full bg-[#171A21] rounded-t-3xl p-6 text-white relative">

            {/* ✅ ADD THIS BUTTON RIGHT HERE */}
            <button
              onClick={() => setSharingMeal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#232734] flex items-center justify-center text-[#9AA3B2] active:scale-[0.95]"
            >
              ✕
            </button>
          
            <p className="text-sm text-[#9AA3B2] mb-3">
              Share with someone
            </p>

            <input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Enter email"
              className="w-full p-3 rounded-xl bg-[#0F1115] text-white placeholder-[#6B7280] mb-3"
            />

            <textarea
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              placeholder="Add a note (optional)"
              className="w-full p-3 rounded-xl bg-[#0F1115] text-white placeholder-[#6B7280] mb-4"
            />

            <button
              onClick={handleSendShare}
              disabled={!recipientEmail}
              className={`w-full py-2 rounded-xl transition-all duration-200 ${
                shareSent
                  ? "bg-white/80 text-black scale-[0.98]"
                  : recipientEmail
                  ? "bg-white text-black active:scale-[0.98]"
                  : "bg-[#232734] text-[#6B7280]"
              }`}
            >
              {shareSent ? "Sent" : "Send"}
            </button>

          </div>
        </div>
      )}
    </>
  )
}