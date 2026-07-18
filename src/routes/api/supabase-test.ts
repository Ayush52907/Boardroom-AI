import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/supabase-test
 *
 * Proves Supabase connectivity: fetches the seeded demo business record.
 * Use this to confirm credentials are wired correctly before building features on top.
 *
 *   curl http://localhost:3000/api/supabase-test
 */
export const Route = createFileRoute("/api/supabase-test")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { data, error } = await supabase
            .from("businesses")
            .select("id, company_name, industry, currency, monthly_revenue, is_demo")
            .eq("is_demo", true)
            .limit(1)
            .single();

          if (error) throw new Error(error.message);

          return Response.json({ ok: true, demo_business: data });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[supabase-test]", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
