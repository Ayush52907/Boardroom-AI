import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser/server client.
 *
 * Uses VITE_ prefixed env vars so Vite exposes them to both client and server
 * bundles. The anon key is safe to expose publicly — RLS policies enforce access.
 *
 * Usage:
 *   import { supabase } from "@/lib/supabase";
 *   const { data, error } = await supabase.from("businesses").select("*");
 */

function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local",
    );
  }
  return createClient(url, key);
}

// Lazy singleton — instantiated on first use, not at module load time.
let _supabase: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!_supabase) _supabase = createSupabaseClient();
  return _supabase;
}

// Named export for convenience — same singleton, just accessed via getter.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});


// ---------------------------------------------------------------------------
// Typed row shapes — mirrors the migration schema exactly.
// ---------------------------------------------------------------------------

export type DbBusiness = {
  id: string;
  company_name: string;
  industry: string;
  currency: string;
  monthly_revenue: number;
  revenue_trend: number[];
  cogs_ratio: number;
  fixed_costs: number;
  cash_reserves: number;
  outstanding_invoices: number;
  inventory_value: number;
  avg_order_value: number;
  monthly_orders: number;
  price_elasticity: number;
  suppliers: Array<{ name: string; reliability: number; costIndex: number }>;
  overdue_invoices: Array<{ customer: string; amount: number; daysOverdue: number }>;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

export type DbSimulation = {
  id: string;
  business_id: string | null;
  kind: "price_change" | "hire_employee" | "marketing_spend" | "switch_supplier";
  label: string;
  inputs: Record<string, unknown>;
  before_metrics: Record<string, unknown>;
  after_metrics: Record<string, unknown>;
  created_at: string;
};

export type DbBoardSession = {
  id: string;
  business_id: string | null;
  simulation_id: string | null;
  question: string;
  status: "pending" | "in_progress" | "complete" | "error";
  participants: string[];
  created_at: string;
  completed_at: string | null;
};

export type DbBoardMessage = {
  id: string;
  session_id: string;
  executive: string;
  round: 1 | 2 | 3;
  bullets: string[];
  sequence_order: number;
  created_at: string;
};
