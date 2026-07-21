import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)

    if (!body) {
    console.error("NO BODY RECEIVED")
    return NextResponse.json({ error: "No body" }, { status: 400 })
    }

    const { mealId, recipientEmail, message, senderName } = body

    // 1. Save to DB
    const { data, error } = await supabase
      .from("shared_meals")
      .insert([
        {
          meal_id: mealId,
          recipient_email: recipientEmail,
          message,
          sender_name: senderName,
        },
      ])
      .select()
      .single()

    if (error) throw error

    const shareId = data.id

    // 2. Create link
    const link = `${process.env.NEXT_PUBLIC_APP_URL}/share/${shareId}`

    // 3. Send email
    const safeSenderName = escapeHtml(senderName)
    const safeMessage = message ? escapeHtml(message) : ""

    const emailRes = await resend.emails.send({
      from: "FoodTracker <onboarding@resend.dev>",
      to: recipientEmail,
      subject: `${senderName} shared a meal with you`,
      html: `
        <p><strong>${safeSenderName}</strong> shared a meal with you</p>
        ${safeMessage ? `<p>“${safeMessage}”</p>` : ""}
        <a href="${link}">View meal</a>
      `,
    })

    console.log("EMAIL RESULT:", emailRes)

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error("SHARE ERROR:", err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}