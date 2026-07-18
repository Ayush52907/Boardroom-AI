import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { callGemini } from "@/lib/gemini.server";
import { EXECUTIVES, selectExecutives, type ExecRole } from "@/lib/executives";
import { getContextForExecutive, type BusinessContext } from "@/lib/business";

// ---------------------------------------------------------------------------
// Step 5: Structured BusinessContext Zod Schema with ~6000 Char Ceiling Safety Net
// ---------------------------------------------------------------------------

const FinancialContextSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  currency: z.string(),
  monthlyRevenue: z.number(),
  revenueTrend: z.array(z.number()),
  revenueGrowthPct: z.number(),
  cogsRatioPct: z.number(),
  grossMarginPct: z.number(),
  fixedCosts: z.number(),
  operatingProfit: z.number(),
  netMarginPct: z.number(),
  cashReserves: z.number(),
  cashFlowScore: z.number(),
  outstandingInvoicesTotal: z.number(),
  collectionsScore: z.number(),
  healthScore: z.number(),
});

const OperationsContextSchema = z.object({
  monthlyOrders: z.number(),
  avgOrderValue: z.number(),
  inventoryValue: z.number(),
  inventoryScore: z.number(),
  fixedCosts: z.number(),
  cogsRatioPct: z.number(),
});

const SupplierSummarySchema = z.object({
  name: z.string(),
  reliability: z.number(),
  costIndex: z.number(),
  isFlagged: z.boolean().optional(),
});

const SuppliersContextSchema = z.object({
  totalCount: z.number(),
  avgReliabilityPct: z.number(),
  avgCostIndexPct: z.number(),
  topSuppliers: z.array(SupplierSummarySchema),
  flaggedSuppliers: z.array(SupplierSummarySchema),
  otherSuppliersCount: z.number(),
});

const CustomerSummarySchema = z.object({
  customer: z.string(),
  amount: z.number(),
  daysOverdue: z.number(),
  isHighRisk: z.boolean().optional(),
});

const CustomersContextSchema = z.object({
  monthlyOrders: z.number(),
  avgOrderValue: z.number(),
  priceElasticity: z.number(),
  totalOverdueAmount: z.number(),
  overdueCount: z.number(),
  topOverdueInvoices: z.array(CustomerSummarySchema),
  highRiskCount: z.number(),
  otherOverdueAmount: z.number(),
});

const StrategicContextSchema = z.object({
  healthScore: z.number(),
  priorities: z.array(z.object({ title: z.string(), detail: z.string(), severity: z.enum(["high", "medium", "low"]) })),
});

export const BusinessContextSchema = z
  .object({
    financial: FinancialContextSchema,
    operations: OperationsContextSchema,
    suppliers: SuppliersContextSchema,
    customers: CustomersContextSchema,
    strategic: StrategicContextSchema,
  })
  .refine((ctx) => JSON.stringify(ctx).length <= 6000, {
    message: "BusinessContext JSON serialized size exceeds 6000 characters ceiling.",
  });

const RequestSchema = z.object({
  question: z.string().min(3).max(500),
  businessContext: BusinessContextSchema,
  simulation: z
    .object({ label: z.string(), before: z.record(z.any()), after: z.record(z.any()), narrativeInputs: z.record(z.any()) })
    .optional(),
});

export type BoardMessage = {
  round: 1 | 2;
  role: ExecRole;
  bullets: string[];
};

export type FinalDecision = {
  headline: string;
  recommendation: string;
  rationale: string[];
  impact: string[];
  risks: string[];
  nextActions: Array<{ action: string; owner: string; timeline: string; metric: string }>;
};

export type BoardDiscussion = {
  question: string;
  participants: ExecRole[];
  messages: BoardMessage[];
  decision: FinalDecision;
};

export const Route = createFileRoute("/api/board")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = RequestSchema.parse(await request.json());
          const participants = selectExecutives(body.question);
          const discussion = await generateDiscussion(body, participants);
          return Response.json(discussion);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("board error", msg);
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});

async function generateDiscussion(
  body: z.infer<typeof RequestSchema>,
  participants: ExecRole[],
): Promise<BoardDiscussion> {
  const allRoles: Array<ExecRole | "Business Analyst"> = [...participants, "Business Analyst"];

  console.log("\n=======================================================");
  console.log(`[BOARD MEETING CONVENED] Question: "${body.question}"`);
  console.log("=======================================================");

  // Step 3 & 6: Log what each executive receives as their role-scoped context slice
  const scopedDataBlock = allRoles
    .map((role) => {
      const slice = getContextForExecutive(role, body.businessContext, body.question);
      const sliceJson = JSON.stringify(slice);
      console.log(`\n--- [EXECUTIVE ROLE SCOPE] ${role} (${EXECUTIVES[role as ExecRole]?.name || "Vikram Rao"}) ---`);
      console.log(`Scoped Payload Size: ${sliceJson.length} chars`);
      console.log(sliceJson);
      return `- ${role} (${EXECUTIVES[role as ExecRole]?.name || "Vikram Rao"}) SCOPED DATA SLICE:\n  ${sliceJson}`;
    })
    .join("\n\n");

  const simBlock = body.simulation
    ? `\n\nSIMULATION RESULTS (deterministic — do NOT re-calculate, only interpret):\nDecision: ${body.simulation.label}\nBefore: ${JSON.stringify(body.simulation.before)}\nAfter: ${JSON.stringify(body.simulation.after)}\nAssumptions: ${JSON.stringify(body.simulation.narrativeInputs)}\n`
    : "";

  const rolesList = participants.join(" | ");
  const system = `You are simulating a live SME executive board meeting.
Return ONLY this JSON schema, no prose:
{
  "round1": [ { "role": "<${rolesList}>", "bullets": ["short bullet", "..."] } ],
  "round2": [ { "role": "<${rolesList}>", "bullets": ["short bullet", "..."] } ],
  "decision": {
    "headline": "1 line, action-oriented",
    "recommendation": "1-2 sentences stating the exact decision",
    "rationale": ["specific bullet citing a number", "..."],
    "impact": ["quantified expected impact bullet", "..."],
    "risks": ["specific risk with mitigation", "..."],
    "nextActions": [
      { "action": "concrete step", "owner": "role or name", "timeline": "e.g. within 14 days", "metric": "what to measure" }
    ]
  }
}

Discussion rules:
- Round 1: each participant analyses INDEPENDENTLY using ONLY their assigned scoped data slice. Exactly one entry per participant in the order: ${rolesList}. 3-5 bullets each. Every bullet is one sentence, plain English, cites a specific number from the data where relevant.
- Round 2: each participant RESPONDS to the others — challenge, agree with a caveat, or refine. Same order, one entry per participant, 3-5 bullets each. Do NOT repeat round 1.
- Decision: the Business Analyst (Vikram Rao) is the sole decision maker. He does NOT summarise — he decides. The recommendation must be ONE unambiguous action. Every rationale/impact/risk bullet MUST reference a concrete figure from the provided business data (currency amounts, %, ratios, counts). nextActions must contain 3-5 items with owner, timeline and a measurable metric.
- No filler ("looks good", "we should consider"). Be direct and specific.`;

  const user = `ROLE-SCOPED BUSINESS DATA SLICES:\n${scopedDataBlock}${simBlock}\n\nQUESTION FROM OWNER:\n"${body.question}"\n\nReturn the JSON now.`;

  const raw = await callGemini({ system, user, json: true });
  const parsed = safeParse(raw);

  const messages: BoardMessage[] = [];
  for (const entry of parsed.round1 ?? []) {
    const bullets = normaliseBullets(entry?.bullets ?? entry?.text);
    if (entry?.role && bullets.length) messages.push({ round: 1, role: entry.role as ExecRole, bullets });
  }
  for (const entry of parsed.round2 ?? []) {
    const bullets = normaliseBullets(entry?.bullets ?? entry?.text);
    if (entry?.role && bullets.length) messages.push({ round: 2, role: entry.role as ExecRole, bullets });
  }

  const d = parsed.decision ?? {};
  const decision: FinalDecision = {
    headline: typeof d.headline === "string" ? d.headline : "Board decision",
    recommendation: typeof d.recommendation === "string" ? d.recommendation : "The board could not reach a firm decision — please retry.",
    rationale: normaliseBullets(d.rationale),
    impact: normaliseBullets(d.impact),
    risks: normaliseBullets(d.risks),
    nextActions: Array.isArray(d.nextActions)
      ? d.nextActions.slice(0, 6).map((a: any) => ({
          action: String(a?.action ?? ""),
          owner: String(a?.owner ?? "Owner"),
          timeline: String(a?.timeline ?? "TBD"),
          metric: String(a?.metric ?? ""),
        })).filter((a: any) => a.action)
      : [],
  };

  return {
    question: body.question,
    participants: [...participants, "Business Analyst"],
    messages,
    decision,
  };
}

function normaliseBullets(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).slice(0, 8);
  if (typeof v === "string") {
    return v
      .split(/\n+|(?:(?<=[.!?])\s+(?=[A-Z]))/)
      .map((s) => s.replace(/^[-•\d.\)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  return [];
}

function safeParse(raw: string): any {
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return {};
  }
}
