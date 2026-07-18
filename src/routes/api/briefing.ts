import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { callGemini } from "@/lib/gemini.server";


const ROLES = ["CEO", "CFO", "COO", "CMO", "CTO", "Procurement Officer", "Business Analyst"] as const;

const Req = z.object({
  role: z.enum(ROLES),
  businessSummary: z.string().min(10).max(4000),
});

const FOCUS: Record<(typeof ROLES)[number], string> = {
  CEO: "overall business health, strategic risks, growth opportunities, high-level priorities",
  CFO: "cash flow, outstanding invoices, margins, expense trends, forecast, financial risk",
  COO: "operations execution, inventory turnover, staffing, delivery reliability",
  CMO: "customer demand, pricing perception, marketing efficiency, competitive positioning",
  CTO: "technology and automation opportunities, data quality, systems risk, digital efficiency",
  "Procurement Officer": "supplier reliability, sourcing cost, supply continuity, vendor risk",
  "Business Analyst": "cross-functional read-out of every metric with a recommended next step",
};

export type Brief = {
  role: string;
  headline: string;
  bullets: string[];
  keyMetrics: Array<{ label: string; value: string }>;
};

export const Route = createFileRoute("/api/briefing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = Req.parse(await request.json());
          const system = `You are Gemma, generating a ${body.role} briefing focused on: ${FOCUS[body.role]}.
Return ONLY this JSON:
{
  "headline": "1 line, action-oriented",
  "bullets": ["short bullet", "..."],
  "keyMetrics": [ { "label": "e.g. Net margin", "value": "e.g. 8.4%" } ]
}
Rules:
- 6 to 9 bullets. Every bullet is ONE sentence, plain English.
- Every bullet cites a concrete number from the data (currency, %, ratio, count).
- No paragraphs. No filler. No invented metrics.
- 4 to 6 keyMetrics reflecting the numbers most relevant to a ${body.role}.`;
          const raw = await callGemini({
            system,
            user: `BUSINESS DATA:\n${body.businessSummary}\n\nGenerate the ${body.role} briefing now.`,
            json: true,
          });
          const parsed = (() => {
            try { return JSON.parse(raw); } catch {
              const m = raw.match(/\{[\s\S]*\}/);
              return m ? JSON.parse(m[0]) : { headline: "Briefing", bullets: [], keyMetrics: [] };
            }
          })();
          const brief: Brief = {
            role: body.role,
            headline: typeof parsed.headline === "string" ? parsed.headline : "Briefing",
            bullets: Array.isArray(parsed.bullets) ? parsed.bullets.map(String).slice(0, 12) : [],
            keyMetrics: Array.isArray(parsed.keyMetrics)
              ? parsed.keyMetrics.slice(0, 8).map((k: any) => ({
                  label: String(k?.label ?? ""),
                  value: String(k?.value ?? ""),
                })).filter((k: any) => k.label && k.value)
              : [],
          };
          return Response.json(brief);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("briefing error", msg);
          return new Response(JSON.stringify({ error: msg }), { status: 500 });
        }
      },
    },
  },
});
