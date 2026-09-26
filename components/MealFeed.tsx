"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Send, SlidersHorizontal, UtensilsCrossed } from "lucide-react"
import PortionBalance from "./PortionBalance"
import { getSmartFoodImages, fallbackImage } from "@/lib/getSmartFoodImage"
import MealImageCarousel from "./MealImageCarousel"
import WorkoutCard from "./WorkoutCard"

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
  const [workouts, setWorkouts] = useState<any[]>([])
  const [deletedIds, setDeletedIds] = useState<(number | string)[]>([])
  const [deletingIds, setDeletingIds] = useState<(number | string)[]>([])

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
          // senderName is derived server-side from the user's profile
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

  async function loadWorkouts() {
    const start = new Date(currentDate)
    start.setHours(0, 0, 0, 0)

    const end = new Date(currentDate)
    end.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })

    if (error) {
      console.error("WORKOUTS LOAD ERROR:", error)
      return
    }

    setWorkouts(data || [])
  }

  useEffect(() => {
    loadMeals()
    loadWorkouts()

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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workouts",
        },
        () => {
          loadWorkouts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refreshTrigger, currentDate])

  const handleDelete = async (item: any) => {
    if (!item?.id) return

    const table = item.__kind === "workout" ? "workouts" : "meals"

    setDeletingIds((prev) => [...prev, item.id])

    if (typeof item.id !== "string") {
      setTimeout(() => {
        setDeletedIds((prev) => [...prev, item.id])
        setDeletingIds((prev) => prev.filter((id) => id !== item.id))
      }, 250)
      return
    }

    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", item.id)

      if (error) return

      setTimeout(() => {
        setDeletedIds((prev) => [...prev, item.id])

        if (table === "workouts") {
          setWorkouts((prev) => prev.filter((w) => w.id !== item.id))
        } else {
          setMeals((prev) => prev.filter((m) => m.id !== item.id))
        }

        setDeletingIds((prev) => prev.filter((id) => id !== item.id))

        onDeleteSuccess?.()
      }, 250)
    } catch {}
  }

  const handleUpdateWorkout = async (id: string, updates: any) => {
    const { error } = await supabase
      .from("workouts")
      .update(updates)
      .eq("id", id)

    if (error) {
      console.error("WORKOUT UPDATE ERROR:", error)
      return
    }

    setWorkouts((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    )
  }

  const [openInsightMealId, setOpenInsightMealId] = useState<number | null>(null)

  // ---- Swipeable photo candidates -------------------------------------
  // New meals save a `photo_candidates` array; older meals fall back to
  // their single photo_url. The selected index is derived from where
  // photo_url sits inside the candidates, so no extra state is needed.
  const getCandidates = (meal: any): string[] => {
    const c = meal.photo_candidates
    if (Array.isArray(c) && c.length > 0) {
      return c.filter((u: any) => typeof u === "string" && u.length > 0)
    }
    let mealName = ""
    try {
      const ai =
        typeof meal.ai_analysis === "string"
          ? JSON.parse(meal.ai_analysis)
          : meal.ai_analysis
      mealName = ai?.meal_name || ""
    } catch {}
    return [meal.photo_url || fallbackImage(mealName)]
  }

  const getPhotoIndex = (meal: any): number => {
    const c = getCandidates(meal)
    const i = c.indexOf(meal.photo_url)
    return i >= 0 ? i : 0
  }

  const handlePhotoChange = async (meal: any, i: number) => {
    const candidates = getCandidates(meal)
    const url = candidates[i]
    if (!url || url === meal.photo_url) return

    setMeals((prev) =>
      prev.map((m) => (m.id === meal.id ? { ...m, photo_url: url } : m))
    )

    // Optimistic (unsaved) meals sync on save; only persist real rows.
    if (typeof meal.id !== "string") return
    const { error } = await supabase
      .from("meals")
      .update({ photo_url: url })
      .eq("id", meal.id)
    if (error) console.error("PHOTO UPDATE ERROR:", error)
  }

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
    ...optimisticMeals.map((m) => ({ ...m, __kind: "meal" })),
    ...meals.map((m) => ({ ...m, __kind: "meal" })),
    ...workouts.map((w) => ({ ...w, __kind: "workout" })),
  ]
    .filter((item) => !deletedIds.includes(item.id))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

  return (
    <>
      <div className="mt-8 space-y-6">

        {mergedMeals.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center rounded-[22px] border border-dashed border-hair-strong bg-surface/40 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center">
              <UtensilsCrossed size={20} className="text-ink-faint" />
            </div>
            <div>
              <p className="text-sm text-ink font-medium">No meals or workouts logged yet</p>
              <p className="text-xs text-ink-faint mt-1">Log a meal or a workout above to get started</p>
            </div>
          </div>
        )}

        {mergedMeals.map((meal) => {
          if (meal.__kind === "workout") {
            return (
              <WorkoutCard
                key={meal.id}
                workout={meal}
                isDeleting={deletingIds.includes(meal.id)}
                onDelete={() => handleDelete(meal)}
                onUpdate={(updates) => handleUpdateWorkout(meal.id, updates)}
              />
            )
          }

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

          const candidates = getCandidates(meal)
          const photoIdx = getPhotoIndex(meal)

          const isDeleting = deletingIds.includes(meal.id)

          return (
            <div key={meal.id || meal.created_at} className="relative">
              {/* subtle ambient glow behind the card, echoing the cal ring */}
              <div className="absolute -inset-2 rounded-[26px] bg-cal/15 blur-xl opacity-60 pointer-events-none" />

              <div
                className={`relative bg-surface border border-hair rounded-[22px] overflow-hidden transition-all duration-300 ease-spring animate-fade-slide-up ${
                  isDeleting
                    ? "opacity-0 scale-95"
                    : "opacity-100 scale-100 hover:scale-[1.01] active:scale-[0.99] hover:border-hair-strong hover:shadow-lg hover:shadow-black/20"
                }`}
              >
              <div className="relative">
                <MealImageCarousel
                  images={candidates}
                  index={photoIdx}
                  onChange={(i) => handlePhotoChange(meal, i)}
                  className="h-[260px]"
                  alt={ai?.meal_name || "Meal"}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

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
                  className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink transition-all duration-150 ease-spring hover:bg-black/60 active:scale-90"
                >
                  <SlidersHorizontal size={16} />
                </button>

                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <button
                    onClick={() => handleShare(meal)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-ink transition-all duration-200 ease-spring active:scale-90 ${
                    isUnseen
                      ? "bg-purple-500/40 backdrop-blur-md border border-purple-400/50 shadow-[0_0_10px_rgba(168,85,247,0.4)] hover:bg-purple-500/50"
                      : "bg-black/45 backdrop-blur-md border border-white/10 hover:bg-cal/25 hover:border-cal/40"
                  }`}
                  >
                    <Send
                      size={16}
                      className={hasInsight ? "opacity-100" : "opacity-90"}
                    />
                  </button>

                  <button
                    onClick={() => handleDelete(meal)}
                    className="w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/10 flex items-center justify-center text-ink transition-all duration-150 ease-spring hover:bg-burn/30 hover:border-burn/50 active:scale-90"
                  >
                    ✕
                  </button>
                </div>

                <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
                  <h2 className="text-ink text-base font-bold tracking-tight">
                    {ai?.meal_name || "Meal"}
                  </h2>
                </div>
              </div>

              <div className="p-4 space-y-3">

                {editingMealId === meal.id ? (
                  <div>
                    {/* INGREDIENT TAGS */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {editIngredients.map((ing, i) => (
                        <span
                          key={i}
                          className="bg-surface-2 px-2 py-1 rounded-full text-xs text-ink flex items-center gap-1 transition-colors duration-150 hover:bg-white/10"
                        >
                          {ing}
                          <button
                            onClick={() =>
                              setEditIngredients((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            className="ml-1 text-ink-dim transition-all duration-150 ease-spring hover:text-ink active:scale-90"
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
                        className="flex-1 bg-surface-2 rounded-xl px-3 py-2 text-sm text-ink outline-none transition focus:ring-1 focus:ring-ink/30"
                      />
                      <button
                        onClick={() => {
                          if (!newIngredient) return
                          setEditIngredients((prev) => [...prev, newIngredient])
                          setNewIngredient("")
                        }}
                        className="px-3 rounded-xl bg-ink text-ground text-sm transition-all duration-150 ease-spring hover:bg-ink/90 active:scale-[0.97]"
                      >
                        Add
                      </button>
                    </div>
                    <div className="border-t border-hair mt-5 mb-3" />
                    <textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="w-full bg-surface-2 rounded-xl p-3 text-sm text-ink mt-4 outline-none transition focus:ring-1 focus:ring-ink/30"
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
                          let analysisFailed = false

                          try {
                            const json = await res.json()

                            // Honest failure: keep the existing analysis rather
                            // than saving an error payload as nutrition data.
                            if (!res.ok || json?.error) {
                              console.error("RE-ANALYZE FAILED:", json?.error)
                              analysisFailed = true
                            } else {
                              updatedAI = json.data || json
                            }
                          } catch (e) {
                            console.error("JSON ERROR:", e)
                            setIsSavingEdit(false)
                            return
                          }
                          console.log("AI RESULT:", updatedAI)
                          await supabase
                            .from("meals")
                            .update(
                              analysisFailed
                                ? { note: editNote } // keep existing ai_analysis
                                : { note: editNote, ai_analysis: updatedAI }
                            )
                            .eq("id", meal.id)
                          setMeals((prev) =>
                            prev.map((m) =>
                              m.id === meal.id
                                ? {
                                    ...m,
                                    note: editNote,
                                    ai_analysis: analysisFailed
                                      ? m.ai_analysis
                                      : updatedAI,
                                  }
                                : m
                            )
                          )

                          onDeleteSuccess?.()
                          setSaveSuccess(true)

                          if (analysisFailed) {
                            alert(
                              "Couldn't re-analyze the ingredients — your note was saved with the previous nutrition info."
                            )
                          }
                          
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
                          flex-1 py-2 rounded-lg text-sm transition-all duration-200 ease-spring
                          ${isSavingEdit
                            ? "bg-surface-2 text-ink-faint cursor-not-allowed"
                            : "bg-ink text-ground hover:bg-ink/90 active:scale-[0.97]"
                          }
                        `}
                        disabled={isSavingEdit}                      >
                        {isSavingEdit ? "Saving..." : "Save"}
                      </button>

                      <button
                        onClick={() => setEditingMealId(null)}
                        className="flex-1 py-2 rounded-lg bg-surface-2 text-ink text-sm transition-all duration-150 ease-spring hover:bg-white/10 active:scale-[0.97]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ai?.foods?.slice(0, 6).map((food: string, i: number) => (
                        <span key={i} className="bg-surface-2 px-2 py-[3px] rounded-full text-[11px] text-ink-dim">
                          {food}
                        </span>
                      ))}
                    </div>

                    {meal.note && <p className="text-sm text-ink">{meal.note}</p>}

                    {openInsightMealId === meal.id && (
                      <div className="mt-2 p-3 rounded-xl bg-ground text-sm text-ink border border-hair">
                        {
                          meal.shared_meals?.find(
                            (s: any) => s.reply_message && s.reply_message.length > 0
                          )?.reply_message
                        }
                      </div>
                    )}

                    <div className="flex justify-between text-[11px] font-semibold tabular-nums pt-1.5">
                      <span className="text-cal">{ai?.calories || 0} cal</span>
                      <span className="text-protein">{ai?.protein || 0} p</span>
                      <span className="text-carb">{ai?.carbs || 0} c</span>
                      <span className="text-fat">{ai?.fat || 0} f</span>
                    </div>

                    {/* Portion balance — breakdown of the totals above */}
                    {Array.isArray(ai?.food_items) && ai.food_items.length > 0 && (
                      <PortionBalance items={ai.food_items} className="pt-2" />
                    )}

                    {hasInsight && (
                      <div className="text-[11px] text-ink-faint pt-2 italic">
                        Insight received
                      </div>
                    )}

                    <div className="text-[10px] text-ink-faint text-right pt-1">
                      {new Date(meal.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                )}

              </div>
              </div>
            </div>
          )
        })}
      </div>

      {sharingMeal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end animate-fade-in">
          <div className="w-full bg-surface border-t border-hair rounded-t-[28px] p-6 text-ink relative animate-fade-slide-up">

            {/* ✅ ADD THIS BUTTON RIGHT HERE */}
            <button
              onClick={() => setSharingMeal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-ink-dim transition-all duration-150 ease-spring hover:bg-white/10 hover:text-ink active:scale-[0.9]"
            >
              ✕
            </button>

            <p className="text-sm text-ink-dim mb-3">
              Share with someone
            </p>

            <input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Enter email"
              className="w-full p-3 rounded-xl bg-ground border border-hair text-ink placeholder-ink-faint mb-3 outline-none transition focus:border-ink/40"
            />

            <textarea
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              placeholder="Add a note (optional)"
              className="w-full p-3 rounded-xl bg-ground border border-hair text-ink placeholder-ink-faint mb-4 outline-none transition focus:border-ink/40"
            />

            <button
              onClick={handleSendShare}
              disabled={!recipientEmail}
              className={`w-full py-2 rounded-xl transition-all duration-200 ease-spring ${
                shareSent
                  ? "bg-ink/80 text-ground scale-[0.98]"
                  : recipientEmail
                  ? "bg-ink text-ground hover:bg-ink/90 active:scale-[0.98]"
                  : "bg-surface-2 text-ink-faint cursor-not-allowed"
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