import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      photo_url,
      meal_name,
      foods,
      calories,
      protein,
      carbs,
      fat,
      insight,
      meal_type
    } = body

    const { data, error } = await supabase
      .from("meals")
      .insert([
        {
          photo_url,
          meal_name,
          foods,
          calories,
          protein,
          carbs,
          fat,
          insight,
          meal_type
        }
      ])
      .select()
      .single()

    if (error) {
      console.error(error)
      return NextResponse.json(
        { error: "Failed to create meal" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error(err)

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    )
  }
}