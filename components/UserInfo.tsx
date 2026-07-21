"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../lib/supabase"

export default function UserInfo() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.email) {
        setEmail(user.email)
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