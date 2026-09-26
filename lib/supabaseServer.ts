import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

/**
 * Server-side Supabase client for API routes. Reads the user's session
 * from cookies — never trust a user_id sent in the request body.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called outside a context that allows setting cookies — safe to ignore.
          }
        },
      },
    }
  )
}

type RouteUser =
  | { user: User; response: null }
  | { user: null; response: NextResponse }

/**
 * Returns the authenticated user for an API route, or a 401 response.
 * Usage:
 *   const { user, response } = await getRouteUser()
 *   if (!user) return response
 */
export async function getRouteUser(): Promise<RouteUser> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Unauthorized — please log in." },
        { status: 401 }
      ),
    }
  }

  return { user, response: null }
}
