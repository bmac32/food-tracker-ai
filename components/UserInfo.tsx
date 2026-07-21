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
        className="group flex items-center gap-1"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full border border-white/20 bg-[#0F1115] flex items-center justify-center text-xs font-semibold text-white transition group-hover:border-white/40">
          {initial || "?"}
        </div>

        {/* Chevron (hover only) */}
        <span className="text-xs text-[#6B7280] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          ⌄
        </span>
      </button>

      {/* DROPDOWN */}
      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-[#171A21]/90 backdrop-blur border border-[#232734] rounded-xl shadow-xl overflow-hidden">
          
          {/* Email */}
          <div className="px-3 py-2 text-xs text-[#9CA3AF] border-b border-[#232734] truncate">
            {email}
          </div>

          {/* Settings */}
          <button
            onClick={() => {
              setOpen(false)
              router.push("/settings")
            }}
            className="w-full text-left px-3 py-2 text-sm transition-colors duration-150 hover:bg-[#232734]"
          >
            Settings
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm transition-colors duration-150 hover:bg-[#232734]"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}