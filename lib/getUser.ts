import { supabase } from "./supabase"

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error("Auth error:", error.message)
    return null
  }

  return user
}