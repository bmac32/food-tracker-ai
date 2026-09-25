import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      throw new Error(
        "Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) are not configured."
      )
    }
    client = createBrowserClient(url, key)
  }
  return client
}

/**
 * Browser Supabase client. Lazily created on first use (via Proxy) so that
 * importing this module during prerender/SSR — where env vars may not be
 * set — doesn't crash. In the browser the env vars are always present.
 *
 * Usage is unchanged: `supabase.auth.getUser()`, `supabase.from(...)`, etc.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>
    const value = c[prop]
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(c)
      : value
  },
})
