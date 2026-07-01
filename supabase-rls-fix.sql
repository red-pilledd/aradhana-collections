-- ============================================================================
-- Aradhana — Row-Level Security fix
-- Run this in the Supabase dashboard:  SQL Editor  ->  New query  ->  paste  ->  Run
-- Safe to run more than once (it drops/recreates its own policies).
--
-- What it does:
--   * Turns RLS ON for all three tables (agents, cash_entries, script_results)
--   * Recreates access policies so:
--       - the admin (logged in) can see/manage everything
--       - each agent can only see their own row and their own cash entries
--       - the public/anon key can see NOTHING
--   * The collections scraper still works because it writes with the
--     service-role key (via /api/script-results), which bypasses RLS.
-- ============================================================================

-- Recursion-safe admin check. SECURITY DEFINER lets it read the agents table
-- without triggering the agents RLS policy (avoids "infinite recursion").
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agents
    where gmail = auth.jwt() ->> 'email' and is_admin = true
  );
$$;

-- 1) Enable RLS
alter table public.agents         enable row level security;
alter table public.cash_entries   enable row level security;
alter table public.script_results enable row level security;

-- 2) Clear old policy versions so this script is re-runnable
drop policy if exists "admin full access on agents"       on public.agents;
drop policy if exists "agent read own row"                on public.agents;
drop policy if exists "admin full access on cash_entries" on public.cash_entries;
drop policy if exists "agent insert own entries"          on public.cash_entries;
drop policy if exists "agent select own entries"          on public.cash_entries;
drop policy if exists "admin read script_results"         on public.script_results;

-- 3) Policies -- agents
create policy "admin full access on agents" on public.agents
  for all using (public.is_admin());

create policy "agent read own row" on public.agents
  for select using (gmail = auth.jwt() ->> 'email');

-- 3) Policies -- cash_entries
create policy "admin full access on cash_entries" on public.cash_entries
  for all using (public.is_admin());

create policy "agent insert own entries" on public.cash_entries
  for insert with check (
    agent_id = (select id from public.agents where gmail = auth.jwt() ->> 'email')
  );

create policy "agent select own entries" on public.cash_entries
  for select using (
    agent_id = (select id from public.agents where gmail = auth.jwt() ->> 'email')
  );

-- 3) Policies -- script_results (admin only; scraper writes via service-role)
create policy "admin manage script_results" on public.script_results
  for all using (public.is_admin());
