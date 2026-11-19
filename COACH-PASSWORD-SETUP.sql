-- Run in Supabase SQL Editor before testing Coach registration.
-- gym_coaches already exists. Never expose these tables to anon/authenticated.
create table if not exists public.gym_coach_credentials (
 coach_id bigint primary key references public.gym_coaches(id) on delete cascade,
 username text not null unique,
 password_salt text not null,
 password_hash text not null,
 created_at timestamptz not null default now(),
 constraint coach_username_format check (username ~ '^[a-z0-9_]{4,32}$')
);
create table if not exists public.gym_coach_shifts (
 id bigint generated always as identity primary key,
 coach_id bigint not null references public.gym_coaches(id),
 work_date date not null,
 checked_in_at timestamptz not null default now(),
 checked_out_at timestamptz,
 unique(coach_id,work_date),
 constraint shift_order check (checked_out_at is null or checked_out_at >= checked_in_at)
);
alter table public.gym_coach_credentials enable row level security;
alter table public.gym_coach_shifts enable row level security;
revoke all on public.gym_coach_credentials from anon,authenticated;
revoke all on public.gym_coach_shifts from anon,authenticated;
-- Existing service_role key in API accesses these tables. No public RLS policies.
