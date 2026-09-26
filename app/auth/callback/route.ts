import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabaseServer"

/**
 * Completes the magic-link sign-in.
 *
 * Supabase redirects here after the user clicks the email link, carrying
 * either a PKCE `code` or a legacy `token_hash` + `type`. We exchange it
 * for a session (stored in cookies) and send the user home. Without this
 * route the code was never redeemed, so users landed on `/` with no
 * session and bounced back to `/login` in an infinite loop.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const next = searchParams.get("next") ?? "/"

  // Only allow relative redirect targets.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/"

  const supabase = await createServerSupabase()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "magiclink" | "email",
    })
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
