-- =============================================================================
-- Gemma Boardroom — Initial Schema Migration
-- Run this against your Supabase project using:
--   Supabase Dashboard → SQL Editor → paste and Run
--   OR: supabase db push (if using Supabase CLI)
-- =============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- businesses
-- Stores company financial data — both the built-in demo and any user uploads.
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id              uuid primary key default gen_random_uuid(),
  company_name    text not null,
  industry        text not null default '',
  currency        text not null default '₹',
  monthly_revenue numeric(18,2) not null default 0,
  revenue_trend   numeric(18,2)[] not null default '{}',
  cogs_ratio      numeric(6,4) not null default 0,
  fixed_costs     numeric(18,2) not null default 0,
  cash_reserves   numeric(18,2) not null default 0,
  outstanding_invoices numeric(18,2) not null default 0,
  inventory_value numeric(18,2) not null default 0,
  avg_order_value numeric(18,2) not null default 0,
  monthly_orders  integer not null default 0,
  price_elasticity numeric(6,4) not null default 0,
  -- Structured JSON for suppliers and overdue invoices (flexible, schema-less)
  suppliers       jsonb not null default '[]',
  overdue_invoices jsonb not null default '[]',
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- simulations
-- Records every simulation run: inputs, deterministic outputs, and metadata.
-- Not tied to a user session yet — anonymous for now.
-- ---------------------------------------------------------------------------
create table if not exists public.simulations (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references public.businesses(id) on delete set null,
  kind            text not null check (kind in ('price_change', 'hire_employee', 'marketing_spend', 'switch_supplier')),
  label           text not null,
  -- Simulation inputs stored as JSON so new sim types can be added without schema changes
  inputs          jsonb not null default '{}',
  -- Snapshot of before/after metrics at time of simulation
  before_metrics  jsonb not null default '{}',
  after_metrics   jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- board_sessions
-- One record per "Ask the Board" or "Simulator interpret" invocation.
-- ---------------------------------------------------------------------------
create table if not exists public.board_sessions (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid references public.businesses(id) on delete set null,
  simulation_id       uuid references public.simulations(id) on delete set null,
  question            text not null,
  status              text not null default 'pending' check (status in ('pending', 'in_progress', 'complete', 'error')),
  -- Array of ExecRole strings that participated (e.g. ["CFO", "CMO"])
  participants        text[] not null default '{}',
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

-- ---------------------------------------------------------------------------
-- board_messages
-- Individual executive messages within a board session.
-- ---------------------------------------------------------------------------
create table if not exists public.board_messages (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.board_sessions(id) on delete cascade,
  executive       text not null,   -- e.g. "CFO", "CMO", "Business Analyst"
  round           integer not null check (round in (1, 2, 3)),
  -- Bullets stored as a JSON array of strings
  bullets         jsonb not null default '[]',
  sequence_order  integer not null,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes for common query patterns
-- ---------------------------------------------------------------------------
create index if not exists idx_simulations_business_id   on public.simulations(business_id);
create index if not exists idx_board_sessions_business_id on public.board_sessions(business_id);
create index if not exists idx_board_messages_session_id  on public.board_messages(session_id);
create index if not exists idx_board_messages_sequence    on public.board_messages(session_id, sequence_order);

-- ---------------------------------------------------------------------------
-- updated_at auto-update trigger for businesses
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- Currently open (anon can read/write) since there is no auth yet.
-- Lock this down in a future phase when user accounts are added.
-- ---------------------------------------------------------------------------
alter table public.businesses      enable row level security;
alter table public.simulations     enable row level security;
alter table public.board_sessions  enable row level security;
alter table public.board_messages  enable row level security;

-- Allow full anon access for now (replace with auth-scoped policies later)
create policy "anon_all_businesses"     on public.businesses     for all to anon using (true) with check (true);
create policy "anon_all_simulations"    on public.simulations    for all to anon using (true) with check (true);
create policy "anon_all_board_sessions" on public.board_sessions for all to anon using (true) with check (true);
create policy "anon_all_board_messages" on public.board_messages for all to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Seed: insert the demo business so the app has something to read on boot
-- ---------------------------------------------------------------------------
insert into public.businesses (
  company_name, industry, currency,
  monthly_revenue, revenue_trend, cogs_ratio, fixed_costs,
  cash_reserves, outstanding_invoices, inventory_value,
  avg_order_value, monthly_orders, price_elasticity,
  suppliers, overdue_invoices, is_demo
) values (
  'Meridian Textiles Pvt. Ltd.',
  'Textile Manufacturing & Wholesale',
  '₹',
  2066000,
  array[1820000, 1910000, 1980000, 2040000, 2010000, 2066000]::numeric[],
  0.62,
  420000,
  3450000,
  1820000,
  2760000,
  18500,
  112,
  -0.55,
  '[
    {"name": "Supplier A – Kanpur Yarns",  "reliability": 0.92, "costIndex": 1.00},
    {"name": "Supplier B – Rathi Weavers", "reliability": 0.68, "costIndex": 0.97},
    {"name": "Supplier C – Nirmal Fabrics","reliability": 0.94, "costIndex": 1.02}
  ]'::jsonb,
  '[
    {"customer": "Kavya Retail Chain",  "amount": 640000, "daysOverdue": 47},
    {"customer": "Urban Threads Co.",   "amount": 480000, "daysOverdue": 32},
    {"customer": "Sunrise Apparels",    "amount": 320000, "daysOverdue": 21},
    {"customer": "3 other accounts",    "amount": 380000, "daysOverdue": 15}
  ]'::jsonb,
  true
) on conflict do nothing;
