import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const { mealId, recipientEmail, message, senderName } = await req.json()

    // 1. Save share
    const { data, error } = await supabase
      .from("shared_meals")
      .insert([
        {
          meal_id: mealId,
          recipient_email: recipientEmail,
          message,
        },
      ])
      .select()
      .single()

    if (error) throw error

    const shareId = data.id

    // 2. Create link
    const link = `${process.env.NEXT_PUBLIC_APP_URL}/share/${shareId}`

    // 3. Send email
    await resend.emails.send({
      from: "FoodTracker <onboarding@resend.dev>",
      to: recipientEmail,
      subject: `${senderName} shared a meal with you`,
      html: `
        <div style="font-family: sans-serif;">
          <p><strong>${senderName}</strong> shared a meal with you</p>
          ${message ? `<p>“${message}”</p>` : ""}
          <a href="${link}">View meal</a>
        </div>
      `,
    })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}