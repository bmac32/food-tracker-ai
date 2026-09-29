-- Coach kill switch (backlog #8): master opt-out of coach suggestions.
-- Safe, non-destructive: adds one boolean column, defaults true (coach on).
-- Run once in the Supabase SQL editor.
alter table user_profiles
  add column if not exists coach_enabled boolean not null default true;
