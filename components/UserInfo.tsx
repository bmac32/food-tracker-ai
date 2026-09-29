"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../lib/supabase"

export default function UserInfo() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // Coach kill switch (backlog #8): master opt-out of coach suggestions.
  // Defaults on; synced across devices via user_profiles.coach_enabled.
  const [coachOn, setCoachOn] = useState(true)

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.email) {
        setEmail(user.email)
      }

      if (user) {
        const { data } = await supabase
          .from("user_profiles")
          .select("coach_enabled")
          .eq("user_id", user.id)
          .maybeSingle()
        if (typeof data?.coach_enabled === "boolean") {
          setCoachOn(data.coach_enabled)
        }
      }
    }

    loadUser()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  // Flip the master coach switch. Optimistic; reverts if the save fails
  // (e.g. the coach_toggle.sql migration hasn't been run yet). The main
  // page listens for the event and hides any visible coach cards.
  const toggleCoach = async () => {
    const next = !coachOn
    setCoachOn(next)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("no user")
      const { error } = await supabase.from("user_profiles").upsert(
        {
          user_id: user.id,
          coach_enabled: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      if (error) throw error
      window.dispatchEvent(
        new CustomEvent("coach-enabled-changed", { detail: next })
      )
    } catch (e) {
      console.error("COACH TOGGLE ERROR:", e)
      setCoachOn(!next)
    }
  }

  const initial = email?.charAt(0).toUpperCase()

  return (
    <div ref={ref} className="relative">
      {/* PROFILE BUTTON */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="group flex items-center gap-1 active:scale-90 transition-transform duration-150 ease-spring"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full border border-hair-strong bg-surface-2 flex items-center justify-center text-xs font-bold text-ink-dim transition-colors group-hover:border-ink-faint group-hover:text-ink">
          {initial || "?"}
        </div>

        {/* Chevron (hover only) */}
        <span className="text-xs text-ink-faint opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          ⌄
        </span>
      </button>

      {/* DROPDOWN */}
      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-surface/90 backdrop-blur border border-hair rounded-xl shadow-xl overflow-hidden animate-fade-scale-in">

          {/* Email */}
          <div className="px-3 py-2 text-xs text-ink-dim border-b border-hair truncate">
            {email}
          </div>

          {/* Coach kill switch (backlog #8): total opt-out of suggestions.
              The X on each card dismisses one card; this silences the coach
              entirely. Flipping it back on is the way back in. */}
          <button
            onClick={toggleCoach}
            className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-ink transition-colors duration-150 hover:bg-surface-2"
            aria-pressed={coachOn}
          >
            <span className="text-left">
              <span className="block">Coach suggestions</span>
              <span className="block text-[11px] text-ink-faint">
                Next-meal tips after you log
              </span>
            </span>
            <span
              className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
                coachOn ? "bg-ink" : "bg-surface-2 border border-hair-strong"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                  coachOn ? "left-[18px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          {/* Settings */}
          <button
            onClick={() => {
              setOpen(false)
              router.push("/settings")
            }}
            className="w-full text-left px-3 py-2 text-sm text-ink transition-colors duration-150 hover:bg-surface-2"
          >
            Settings
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-ink transition-colors duration-150 hover:bg-surface-2"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}