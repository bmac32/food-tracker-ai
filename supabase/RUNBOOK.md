# Supabase Runbook — AI Food Tracker

Everything in this folder has to be applied by **you** in the Supabase
dashboard. The code can't touch your live project (that's by design).

## 1. Apply the security fixes (5 minutes)

1. Go to your Supabase project → **SQL Editor** → **New query**.
2. Open `supabase/fix_existing_table_rls.sql` in this repo, copy the
   whole file, paste it, and hit **Run**.
3. What it does:
   - Replaces the wide-open `meals` policies (`USING (true)` — anyone
     could read/write everyone's meals) with per-user policies.
   - Enables RLS on `user_goals` with per-user policies and guarantees
     the `user_id` column exists.
   - Locks down `shared_meals`: public read by link, owner-only insert,
     and anonymous users can only edit `reply_message`.
   - Adds `user_profiles.display_name` (used as the sender name in
     share emails — the hardcoded name is gone from the code).
   - Guarantees `meals.user_id` exists.
4. Safe to re-run: it drops and recreates policies instead of assuming
   what's already there.

### Verify it worked

In the same SQL Editor, scroll to the **VERIFICATION** section at the
bottom of the file, uncomment the three queries (remove the leading
`--`), and run them one at a time:

1. All five tables (`meals`, `user_goals`, `shared_meals`, `workouts`,
   `user_profiles`) should show `rowsecurity = true`.
2. `meals` and `user_goals` should each have exactly 4 policies, all
   scoped to `auth.uid() = user_id`.
3. `orphan_goals` counts old goal rows with no owner. Those rows are now
   invisible to everyone (correct — they're private). To reclaim them:
   - Find your user UUID in **Authentication → Users**, then run:
     ```sql
     update public.user_goals
     set user_id = '<your-auth-user-uuid>'
     where user_id is null;
     ```
   - Or just re-save your goals once from the app's Edit Goals screen.

Also check **Database → Advisors**: the security warnings about these
tables should be gone.

## 2. Storage bucket: `meal-photos` (2 minutes)

Current design: the bucket is **public-read**, and photo URLs are long
and unguessable (`<timestamp>-<filename>`). That's an intentional
tradeoff — meal photos aren't sensitive by design, and it keeps image
loading fast and simple.

- In **Storage → meal-photos → Policies**, confirm public `SELECT` is
  enabled (that's what makes the app's images load).
- If you ever want private photos, the upgrade path is signed URLs via
  a server route — a bigger change; not needed for launch.

## 3. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Where from | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | already set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | server-only, never `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY` | console.anthropic.com | server-only |
| `GOOGLE_AI_API_KEY` | Google AI Studio | server-only |
| `RESEND_API_KEY` | resend.com/api-keys | server-only |
| `RESEND_FROM_EMAIL` | — | set after domain verification, e.g. `FoodTracker <hello@yourdomain.com>` |
| `UNSPLASH_ACCESS_KEY` | unsplash.com/oauth/applications | **server-only** (replaces the old `NEXT_PUBLIC_UNSPLASH_ACCESS_KEY` — delete that one) |
| `NEXT_PUBLIC_APP_URL` | — | e.g. `https://food-tracker-ai-nine.vercel.app` |
| `AI_TEXT_MODEL` | optional | default `claude-haiku-4-5` |
| `AI_VISION_FALLBACK_MODEL` | optional | default `claude-haiku-4-5` |
| `AI_PHOTO_MODEL` | optional | default `gemini-1.5-flash` |

Redeploy after changing env vars.

## 4. Resend custom domain (before inviting real users)

Until you verify a domain, Resend's sandbox (`onboarding@resend.dev`)
only delivers to your own account email — share emails to anyone else
silently won't arrive.

1. Resend → **Domains** → add your domain, add the DNS records.
2. Set `RESEND_FROM_EMAIL` in Vercel, e.g.
   `FoodTracker <hello@yourdomain.com>`, and redeploy.

## 5. Swipeable meal photos: `photo_candidates` column (2 minutes)

The photo picker needs a place to store the pool of candidate images per
meal. In **SQL Editor → New query**, paste the whole contents of
`supabase/photo_candidates.sql` and hit **Run**. It adds a `photo_candidates`
(jsonb) column to `meals` and backfills existing meals from their current
`photo_url`, so old cards keep working.

Uncomment the two queries at the bottom of the file to verify: the column
should exist, and recent meals should show a JSON array of URLs.

No RLS change needed — the existing per-user `meals` policies already cover
the new column (owner-only read/write).

## 6. After deploying the new code

- [ ] SQL script applied and verification queries pass
- [ ] Advisors show no security warnings on app tables
- [ ] `UNSPLASH_ACCESS_KEY` set (server-only), old `NEXT_PUBLIC_` key removed
- [ ] Sign in on the live site, log a meal (photo + text) — confirm the
      analysis card appears
- [ ] Set your display name in Settings → share a meal with yourself →
      confirm the email shows your name
- [ ] /privacy and /terms load
