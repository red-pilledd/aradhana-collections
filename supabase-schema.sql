-- Run this in your Supabase SQL editor

create table agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gmail text not null unique,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

create table cash_entries (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  amount numeric(10,2) not null,
  note text,
  created_at timestamptz default now()
);

create table script_results (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  data jsonb not null,
  created_at timestamptz default now()
);

-- Row Level Security
alter table agents enable row level security;
alter table cash_entries enable row level security;
alter table script_results enable row level security;

-- Agents: admin can read/write all; agents can only read their own row
create policy "admin full access on agents"
  on agents for all
  using (
    exists (select 1 from agents a where a.gmail = auth.jwt()->>'email' and a.is_admin = true)
  );

create policy "agent read own row"
  on agents for select
  using (gmail = auth.jwt()->>'email');

-- Cash entries: admin sees all; agent sees/inserts own
create policy "admin full access on cash_entries"
  on cash_entries for all
  using (
    exists (select 1 from agents a where a.gmail = auth.jwt()->>'email' and a.is_admin = true)
  );

create policy "agent insert own entries"
  on cash_entries for insert
  with check (
    agent_id = (select id from agents where gmail = auth.jwt()->>'email')
  );

create policy "agent select own entries"
  on cash_entries for select
  using (
    agent_id = (select id from agents where gmail = auth.jwt()->>'email')
  );

-- Script results: admin only
create policy "admin read script_results"
  on script_results for all
  using (
    exists (select 1 from agents a where a.gmail = auth.jwt()->>'email' and a.is_admin = true)
  );

-- Insert your own admin account first (replace with your gmail)
insert into agents (name, gmail, is_admin) values ('Shibin', 'shibn88@gmail.com', true);
