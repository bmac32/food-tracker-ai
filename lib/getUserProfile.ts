import { supabase } from "./supabase"

export type UserProfile = {
  user_id: string
  weight: number | null // lbs
  height: number | null // inches
  age: number | null
  activity_level: string | null
  goal: string | null
}

export function lbsToKg(lbs: number): number {
  return lbs * 0.453592
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    console.error("PROFILE LOAD ERROR:", error)
    return null
  }

  return data
}
