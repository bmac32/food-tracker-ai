"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const router = useRouter()

  // 🔁 AUTO REDIRECT IF ALREADY LOGGED IN
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        router.push("/")
      }
    }

    checkUser()
  }, [router])

  const handleLogin = async () => {
    if (!email) return

    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL,
      },
    })

    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0F1115] text-[#E6E8EC] flex items-center justify-center px-4 overflow-hidden">

      {/* ✨ ANIMATED GLOW BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <div className="absolute w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full top-[-100px] left-[-100px] animate-pulse" />
        <div className="absolute w-[400px] h-[400px] bg-purple-500/10 blur-[120px] rounded-full bottom-[-100px] right-[-100px] animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">

        {/* HEADER */}
        <div className="text-center space-y-2">
          <div className="text-xs tracking-widest text-[#6B7280]">
            AI NUTRITION
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            Track smarter. Eat better.
          </h1>

          <p className="text-sm text-[#A0A4AE]">
            Snap a meal. Get instant nutrition insights.
          </p>
        </div>

        {/* CARD */}
        <div className="bg-[#171A21]/80 backdrop-blur border border-[#232734] rounded-2xl p-6 space-y-4 shadow-xl">

          {!sent ? (
            <>
              <div className="space-y-1">
                <label className="text-sm text-[#A0A4AE]">
                  Email
                </label>

                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#232734] rounded-xl px-3 py-3 text-sm outline-none focus:border-white/40 transition"
                />
              </div>

              {/* ✨ SHIMMER BUTTON */}
              <button
                onClick={handleLogin}
                disabled={loading}
                className="relative w-full bg-white text-black rounded-xl py-3 font-medium overflow-hidden transition-all duration-200 hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed"
              >
                {loading && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.2s_infinite]" />
                )}
                <span className="relative z-10">
                  {loading ? "Sending link..." : "Continue with email"}
                </span>
              </button>

              <p className="text-xs text-[#6B7280] text-center">
                No password needed — secure magic link login
              </p>
            </>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-sm">
                Check your email ✨
              </p>
              <p className="text-xs text-[#6B7280]">
                Click the link to log in securely
              </p>
            </div>
          )}
        </div>

        {/* VALUE PROPS */}
        <div className="text-center text-xs text-[#6B7280] space-y-1">
          <p>• AI analyzes your meals instantly</p>
          <p>• Track calories, protein, carbs, and fat</p>
          <p>• Build consistent, healthy habits</p>
        </div>
      </div>

      {/* ✨ SHIMMER KEYFRAMES */}
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}