"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"

function AuthErrorNotice() {
  const searchParams = useSearchParams()
  const failed = searchParams.get("error") === "auth_callback_failed"
  if (!failed) return null
  return (
    <p className="text-xs text-center text-red-500">
      That login link didn&apos;t work — it may have expired. Request a new one below.
    </p>
  )
}

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
        // Point the magic link at the callback route that redeems the
        // code for a session. Using the page's own origin means this
        // works on production and preview deployments without relying
        // on an env var being set correctly.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
    <div className="relative min-h-screen bg-ground text-ink flex items-center justify-center px-4 overflow-hidden">

      {/* ✨ ANIMATED GLOW BACKGROUND */}
      <div className="absolute inset-0 z-0">
        <div className="absolute w-[500px] h-[500px] bg-carb/10 blur-[120px] rounded-full top-[-100px] left-[-100px] animate-pulse" />
        <div className="absolute w-[400px] h-[400px] bg-fat/10 blur-[120px] rounded-full bottom-[-100px] right-[-100px] animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">

        {/* HEADER */}
        <div className="text-center space-y-2">
          <div className="text-xs tracking-widest text-ink-faint">
            AI NUTRITION
          </div>

          <h1 className="text-2xl font-bold tracking-tight">
            Track smarter. Eat better.
          </h1>

          <p className="text-sm text-ink-dim">
            Snap a meal. Get instant nutrition insights.
          </p>
        </div>

        {/* CARD */}
        <div className="bg-surface/80 backdrop-blur border border-hair rounded-[22px] p-6 space-y-4 shadow-xl">

          <Suspense fallback={null}>
            <AuthErrorNotice />
          </Suspense>

          {!sent ? (
            <>
              <div className="space-y-1">
                <label className="text-sm text-ink-dim">
                  Email
                </label>

                <input
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-ground border border-hair rounded-xl px-3 py-3 text-sm text-ink outline-none focus:border-ink/40 transition"
                />
              </div>

              {/* ✨ SHIMMER BUTTON */}
              <button
                onClick={handleLogin}
                disabled={loading}
                className="relative w-full bg-ink text-ground rounded-xl py-3 font-bold overflow-hidden transition-all duration-200 ease-spring hover:bg-ink/90 active:scale-[0.98] disabled:cursor-not-allowed"
              >
                {loading && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-transparent animate-[shimmer_1.2s_infinite]" />
                )}
                <span className="relative z-10">
                  {loading ? "Sending link..." : "Continue with email"}
                </span>
              </button>

              <p className="text-xs text-ink-faint text-center">
                No password needed — secure magic link login
              </p>
            </>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-sm text-ink">
                Check your email ✨
              </p>
              <p className="text-xs text-ink-faint">
                Click the link to log in securely
              </p>
            </div>
          )}
        </div>

        {/* VALUE PROPS */}
        <div className="text-center text-xs text-ink-faint space-y-1">
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