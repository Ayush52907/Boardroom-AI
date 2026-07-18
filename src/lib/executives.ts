export type ExecRole =
  | "CFO"
  | "COO"
  | "CMO"
  | "CTO"
  | "Procurement Officer"
  | "Business Analyst";

export type Executive = {
  role: ExecRole;
  name: string;
  initials: string;
  color: string;
  focus: string;
  system: string;
};

export const EXECUTIVES: Record<ExecRole, Executive> = {
  CFO: {
    role: "CFO",
    name: "Priya Menon",
    initials: "PM",
    color: "oklch(0.78 0.14 82)",
    focus: "Profitability, margins, cash flow, financial risk.",
    system:
      "You are the CFO. You focus on margins, cash flow, working capital and financial risk. Cite exact numbers from the data. Reply as 3-5 short bullet points, each 1 sentence.",
  },
  COO: {
    role: "COO",
    name: "Rohan Iyer",
    initials: "RI",
    color: "oklch(0.72 0.16 150)",
    focus: "Operations, inventory, staffing, delivery, execution risk.",
    system:
      "You are the COO. You focus on execution, inventory turnover, staffing capacity and delivery reliability. Reply as 3-5 short bullet points, each 1 sentence.",
  },
  CMO: {
    role: "CMO",
    name: "Arjun Kapoor",
    initials: "AK",
    color: "oklch(0.72 0.15 200)",
    focus: "Customers, pricing perception, demand, competition, brand.",
    system:
      "You are the CMO. You focus on customer perception, price sensitivity, demand elasticity and competitive positioning. Reply as 3-5 short bullet points, each 1 sentence.",
  },
  CTO: {
    role: "CTO",
    name: "Ananya Deshpande",
    initials: "AD",
    color: "oklch(0.72 0.15 260)",
    focus: "Technology, automation, data, systems risk, digital efficiency.",
    system:
      "You are the CTO. You focus on technology, automation, data quality, systems risk and digital efficiency opportunities. Reply as 3-5 short bullet points, each 1 sentence.",
  },
  "Procurement Officer": {
    role: "Procurement Officer",
    name: "Neha Sharma",
    initials: "NS",
    color: "oklch(0.7 0.17 300)",
    focus: "Suppliers, sourcing, cost efficiency, supply continuity.",
    system:
      "You are the Procurement Officer. You focus on supplier reliability, sourcing alternatives, cost structure and continuity of supply. Reply as 3-5 short bullet points, each 1 sentence.",
  },
  "Business Analyst": {
    role: "Business Analyst",
    name: "Vikram Rao",
    initials: "VR",
    color: "oklch(0.85 0.12 60)",
    focus: "Reviews every executive's position and issues the final, data-backed decision.",
    system:
      "You are the Chief Business Analyst and final decision-maker. You do NOT summarise. You review every executive's position, identify agreements and conflicts, weigh trade-offs against the company data, and issue ONE clear, specific recommendation grounded in the numbers. Every claim must reference concrete figures from the business data.",
  },
};

/**
 * Routes the discussion to only the executives relevant to the question.
 * Uses keyword matching to determine which domains the question touches.
 * Always returns at least 2 executives for a proper multi-perspective debate.
 * Falls back to the full board for ambiguous or general questions.
 */
export function selectExecutives(question: string): ExecRole[] {
  const q = question.toLowerCase();

  const financial = /profit|revenue|margin|cash|pric|cost|expense|invoice|financ|budget|earn|money|payment|loss|debt|afford|salary|wage|fund/.test(q);
  const marketing  = /customer|market|demand|brand|competit|advertis|sales|promotion|awareness|reputation|audience|channel|campaign/.test(q);
  const operational = /inventory|hire|employ|staff|operat|deliver|logistic|branch|capacit|machin|equipment|warehouse|production|expand|open/.test(q);
  const procurement = /supplier|procurement|sourc|vendor|supply|purchas|raw material|order|partner/.test(q);
  const tech = /tech|automat|system|software|data|digital|tool|platform|erp|crm|integrat/.test(q);

  const roles = new Set<ExecRole>();
  if (financial)    roles.add("CFO");
  if (marketing)    roles.add("CMO");
  if (operational)  roles.add("COO");
  if (procurement)  roles.add("Procurement Officer");
  if (tech)         roles.add("CTO");

  // Fall back to the full board for ambiguous or general questions
  if (roles.size === 0) return ["CFO", "COO", "CMO", "CTO", "Procurement Officer"];

  // Ensure at least 2 executives for a meaningful debate
  if (roles.size === 1) {
    if (roles.has("CFO"))                       roles.add("COO");
    else if (roles.has("CMO"))                  roles.add("CFO");
    else if (roles.has("COO"))                  roles.add("CFO");
    else if (roles.has("Procurement Officer"))   roles.add("COO");
    else if (roles.has("CTO"))                  roles.add("COO");
  }

  // Return in consistent canonical order
  const order: ExecRole[] = ["CFO", "COO", "CMO", "CTO", "Procurement Officer"];
  return order.filter((r) => roles.has(r));
}
