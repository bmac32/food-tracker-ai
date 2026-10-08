import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { getRouteUser } from "@/lib/supabaseServer"

/**
 * POST /api/share-meal
 * Authenticated. The caller must own the meal being shared.
 * The sender name is derived server-side from the user's profile —
 * never trust a client-supplied name.
 */

// Service-role client: bypasses RLS, so every query below is manually
// scoped to the authenticated user. Created lazily per-request so a
// missing env var fails the request (with a clear error) instead of
// crashing the route module at import/build time.
function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase server env vars not configured")
  return createClient(url, key)
}

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error("RESEND_API_KEY not configured")
  return new Resend(key)
}

// Sender override lives in Vercel env (RESEND_FROM_EMAIL); the fallback
// below matches the verified domain.
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Foodency <login@foodency.com>"

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Best available display name: profile setting → email handle → fallback. */
async function resolveSenderName(
  userId: string,
  email: string | undefined
): Promise<string> {
  try {
    const { data } = await getAdmin()
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle()

    if (data?.display_name) return String(data.display_name).slice(0, 60)
  } catch {
    // fall through to email-based fallback
  }

  if (email) {
    const handle = email.split("@")[0]
    if (handle) return handle
  }

  return "A friend"
}

export async function POST(req: Request) {
  const { user, response } = await getRouteUser()
  if (!user) return response

  try {
    const body = await req.json().catch(() => null)
    const { mealId, recipientEmail, message } = body ?? {}

    if (!mealId || typeof mealId !== "string") {
      return NextResponse.json({ error: "A meal is required." }, { status: 400 })
    }

    if (!recipientEmail || !EMAIL_RE.test(String(recipientEmail))) {
      return NextResponse.json(
        { error: "A valid recipient email is required." },
        { status: 400 }
      )
    }

    const safeMessage =
      typeof message === "string" ? message.slice(0, 500) : ""

    // Verify the meal belongs to the caller (service role bypasses RLS,
    // so this check is the authorization).
    const { data: meal, error: mealError } = await getAdmin()
      .from("meals")
      .select("id")
      .eq("id", mealId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (mealError || !meal) {
      return NextResponse.json(
        { error: "Meal not found." },
        { status: 404 }
      )
    }

    const senderName = await resolveSenderName(user.id, user.email)

    const { data, error } = await getAdmin()
      .from("shared_meals")
      .insert([
        {
          meal_id: mealId,
          recipient_email: recipientEmail,
          message: safeMessage || null,
          sender_name: senderName,
        },
      ])
      .select()
      .single()

    if (error) throw error

    const link = `${process.env.NEXT_PUBLIC_APP_URL}/share/${data.id}`

    const emailRes = await getResend().emails.send({
      from: FROM_EMAIL,
      to: recipientEmail,
      subject: `${senderName} shared a meal with you`,
      html: `
        <p><strong>${escapeHtml(senderName)}</strong> shared a meal with you</p>
        ${safeMessage ? `<p>&ldquo;${escapeHtml(safeMessage)}&rdquo;</p>` : ""}
        <a href="${escapeHtml(link)}">View meal</a>
      `,
    })

    console.log("EMAIL RESULT:", emailRes)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("SHARE ERROR:", err)
    return NextResponse.json({ error: "Couldn't share the meal." }, { status: 500 })
  }
}
