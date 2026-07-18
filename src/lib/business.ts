// Business data types + deterministic calculations.

export type BusinessData = {
  companyName: string;
  industry: string;
  currency: string; // symbol e.g. "₹"
  monthlyRevenue: number; // last month revenue
  revenueTrend: number[]; // last 6 months
  cogsRatio: number; // 0..1 - cost of goods as fraction of revenue
  fixedCosts: number; // monthly fixed costs
  cashReserves: number;
  outstandingInvoices: number; // AR owed to us
  inventoryValue: number;
  avgOrderValue: number;
  monthlyOrders: number;
  priceElasticity: number; // demand change per 1% price change (e.g. -0.6 means 1% up = 0.6% orders down)
  suppliers: Array<{ name: string; reliability: number; costIndex: number }>;
  overdueInvoices: Array<{ customer: string; amount: number; daysOverdue: number }>;
};

export const DEMO_BUSINESS: BusinessData = {
  companyName: "Meridian Textiles Pvt. Ltd.",
  industry: "Textile Manufacturing & Wholesale",
  currency: "₹",
  monthlyRevenue: 2_066_000,
  revenueTrend: [1_820_000, 1_910_000, 1_980_000, 2_040_000, 2_010_000, 2_066_000],
  cogsRatio: 0.62,
  fixedCosts: 420_000,
  cashReserves: 3_450_000,
  outstandingInvoices: 1_820_000,
  inventoryValue: 2_760_000,
  avgOrderValue: 18_500,
  monthlyOrders: 112,
  priceElasticity: -0.55,
  suppliers: [
    { name: "Supplier A – Kanpur Yarns", reliability: 0.92, costIndex: 1.0 },
    { name: "Supplier B – Rathi Weavers", reliability: 0.68, costIndex: 0.97 },
    { name: "Supplier C – Nirmal Fabrics", reliability: 0.94, costIndex: 1.02 },
  ],
  overdueInvoices: [
    { customer: "Kavya Retail Chain", amount: 640_000, daysOverdue: 47 },
    { customer: "Urban Threads Co.", amount: 480_000, daysOverdue: 32 },
    { customer: "Sunrise Apparels", amount: 320_000, daysOverdue: 21 },
    { customer: "3 other accounts", amount: 380_000, daysOverdue: 15 },
  ],
};

export type Metrics = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  operatingProfit: number;
  netMargin: number;
  cashFlowScore: number; // 0-100
  collectionsScore: number; // 0-100
  inventoryScore: number; // 0-100
  healthScore: number; // 0-100
  revenueGrowth: number; // % vs prior month
};

export function computeMetrics(b: BusinessData): Metrics {
  const revenue = b.monthlyRevenue;
  const cogs = revenue * b.cogsRatio;
  const grossProfit = revenue - cogs;
  const grossMargin = grossProfit / revenue;
  const operatingProfit = grossProfit - b.fixedCosts;
  const netMargin = operatingProfit / revenue;

  const monthsOfRunway = b.cashReserves / Math.max(1, b.fixedCosts + cogs);
  const cashFlowScore = clamp(monthsOfRunway * 22, 0, 100);

  const arRatio = b.outstandingInvoices / Math.max(1, revenue);
  const collectionsScore = clamp(100 - arRatio * 90, 0, 100);

  const invTurns = revenue / Math.max(1, b.inventoryValue);
  const inventoryScore = clamp(invTurns * 90, 0, 100);

  const prev = b.revenueTrend.at(-2) ?? revenue;
  const revenueGrowth = ((revenue - prev) / Math.max(1, prev)) * 100;

  const marginScore = clamp(netMargin * 400, 0, 100);
  const healthScore = Math.round(
    marginScore * 0.35 + cashFlowScore * 0.25 + collectionsScore * 0.2 + inventoryScore * 0.2,
  );

  return {
    revenue,
    cogs,
    grossProfit,
    grossMargin,
    operatingProfit,
    netMargin,
    cashFlowScore: Math.round(cashFlowScore),
    collectionsScore: Math.round(collectionsScore),
    inventoryScore: Math.round(inventoryScore),
    healthScore,
    revenueGrowth,
  };
}

// Simulation engine — deterministic. Returns before/after metrics.
export type SimulationInput =
  | { kind: "price_change"; pctChange: number }
  | { kind: "hire_employee"; monthlyCost: number; productivityUplift: number }
  | { kind: "marketing_spend"; monthlyCost: number; ordersUplift: number }
  | { kind: "switch_supplier"; toSupplier: string };

export type SimulationResult = {
  label: string;
  before: Metrics;
  after: Metrics;
  deltas: { revenue: number; profit: number; margin: number; cash: number };
  narrativeInputs: Record<string, string | number>;
};

export function runSimulation(b: BusinessData, sim: SimulationInput): SimulationResult {
  const before = computeMetrics(b);
  const next: BusinessData = structuredClone(b);
  let label = "";
  let narrativeInputs: Record<string, string | number> = {};

  switch (sim.kind) {
    case "price_change": {
      const pct = sim.pctChange / 100;
      const orderChange = pct * b.priceElasticity; // e.g. +8% price × -0.55 = -4.4% orders
      const newOrders = b.monthlyOrders * (1 + orderChange);
      const newAOV = b.avgOrderValue * (1 + pct);
      next.monthlyOrders = newOrders;
      next.avgOrderValue = newAOV;
      next.monthlyRevenue = newOrders * newAOV;
      // COGS ratio drops because prices went up but cost per unit is stable
      next.cogsRatio = b.cogsRatio / (1 + pct);
      label = `Increase prices by ${sim.pctChange}%`;
      narrativeInputs = {
        pctChange: sim.pctChange,
        expectedOrderChangePct: +(orderChange * 100).toFixed(2),
        elasticity: b.priceElasticity,
      };
      break;
    }
    case "hire_employee": {
      next.fixedCosts = b.fixedCosts + sim.monthlyCost;
      next.monthlyRevenue = b.monthlyRevenue * (1 + sim.productivityUplift / 100);
      label = `Hire new employee (${b.currency}${fmt(sim.monthlyCost)}/mo)`;
      narrativeInputs = { addedCost: sim.monthlyCost, productivityUpliftPct: sim.productivityUplift };
      break;
    }
    case "marketing_spend": {
      next.fixedCosts = b.fixedCosts + sim.monthlyCost;
      next.monthlyOrders = b.monthlyOrders * (1 + sim.ordersUplift / 100);
      next.monthlyRevenue = next.monthlyOrders * b.avgOrderValue;
      label = `Increase marketing spend by ${b.currency}${fmt(sim.monthlyCost)}/mo`;
      narrativeInputs = { addedSpend: sim.monthlyCost, ordersUpliftPct: sim.ordersUplift };
      break;
    }
    case "switch_supplier": {
      const s = b.suppliers.find((x) => x.name === sim.toSupplier) ?? b.suppliers[0];
      next.cogsRatio = b.cogsRatio * s.costIndex;
      // reliability affects effective revenue (stockouts)
      const reliabilityDelta = s.reliability - avg(b.suppliers.map((x) => x.reliability));
      next.monthlyRevenue = b.monthlyRevenue * (1 + reliabilityDelta * 0.15);
      label = `Switch primary supplier to ${s.name}`;
      narrativeInputs = { supplier: s.name, reliability: s.reliability, costIndex: s.costIndex };
      break;
    }
  }

  const after = computeMetrics(next);
  return {
    label,
    before,
    after,
    deltas: {
      revenue: after.revenue - before.revenue,
      profit: after.operatingProfit - before.operatingProfit,
      margin: (after.netMargin - before.netMargin) * 100,
      cash: 0,
    },
    narrativeInputs,
  };
}

// Priorities — deterministic recommendations from data.
export function computePriorities(b: BusinessData, m: Metrics): Array<{
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
}> {
  const items: Array<{ title: string; detail: string; severity: "high" | "medium" | "low" }> = [];
  const totalOverdue = b.overdueInvoices.reduce((s, i) => s + i.amount, 0);
  if (totalOverdue > 0) {
    items.push({
      title: `Recover ${b.currency}${fmt(totalOverdue)} from overdue invoices`,
      detail: `${b.overdueInvoices.length} accounts overdue; top: ${b.overdueInvoices[0].customer} (${b.overdueInvoices[0].daysOverdue}d).`,
      severity: totalOverdue > b.monthlyRevenue * 0.3 ? "high" : "medium",
    });
  }
  if (m.netMargin < 0.12) {
    items.push({
      title: "Margins are below target — review pricing",
      detail: `Net margin at ${(m.netMargin * 100).toFixed(1)}%. A modest price increase may restore profitability.`,
      severity: "high",
    });
  }
  const weakSupplier = b.suppliers.find((s) => s.reliability < 0.75);
  if (weakSupplier) {
    items.push({
      title: `Review ${weakSupplier.name} reliability`,
      detail: `Reliability at ${(weakSupplier.reliability * 100).toFixed(0)}%. Consider a backup supplier.`,
      severity: "medium",
    });
  }
  if (m.inventoryScore < 40) {
    items.push({
      title: "Delay next inventory purchase",
      detail: `Inventory turnover is low. Reducing stock will free ${b.currency}${fmt(b.inventoryValue * 0.15)} in cash.`,
      severity: "medium",
    });
  }
  return items.slice(0, 4);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function avg(a: number[]) {
  return a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
}
export function fmt(n: number): string {
  if (Math.abs(n) >= 1e7) return (n / 1e7).toFixed(2) + "Cr";
  if (Math.abs(n) >= 1e5) return (n / 1e5).toFixed(2) + "L";
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toFixed(0);
}
export function fmtSigned(n: number): string {
  return (n >= 0 ? "+" : "") + fmt(n);
}

/**
 * Serializes BusinessData + computed Metrics into a plain-text business summary
 * for injection into LLM prompts. Pure function — no AI calls.
 */
export function summarizeBusiness(b: BusinessData, m: Metrics): string {
  return [
    `Company: ${b.companyName} (${b.industry})`,
    `Currency: ${b.currency}`,
    `Monthly revenue: ${b.currency}${fmt(m.revenue)} (last 6 months trend: ${b.revenueTrend.map((x) => b.currency + fmt(x)).join(", ")})`,
    `Revenue growth vs prior month: ${m.revenueGrowth.toFixed(1)}%`,
    `COGS ratio: ${(b.cogsRatio * 100).toFixed(1)}% | Gross margin: ${(m.grossMargin * 100).toFixed(1)}%`,
    `Fixed costs/mo: ${b.currency}${fmt(b.fixedCosts)} | Operating profit: ${b.currency}${fmt(m.operatingProfit)} | Net margin: ${(m.netMargin * 100).toFixed(1)}%`,
    `Cash reserves: ${b.currency}${fmt(b.cashReserves)} | Cash score: ${m.cashFlowScore}/100`,
    `Outstanding AR: ${b.currency}${fmt(b.outstandingInvoices)} | Collections score: ${m.collectionsScore}/100`,
    `Inventory value: ${b.currency}${fmt(b.inventoryValue)} | Inventory score: ${m.inventoryScore}/100`,
    `Avg order value: ${b.currency}${fmt(b.avgOrderValue)} | Monthly orders: ${b.monthlyOrders} | Price elasticity: ${b.priceElasticity}`,
    `Suppliers: ${b.suppliers.map((s) => `${s.name} (reliability ${(s.reliability * 100).toFixed(0)}%, cost ${(s.costIndex * 100).toFixed(0)}%)`).join("; ")}`,
    `Overdue invoices: ${b.overdueInvoices.map((i) => `${i.customer} ${b.currency}${fmt(i.amount)} (${i.daysOverdue}d)`).join("; ")}`,
    `Overall business health: ${m.healthScore}/100`,
  ].join("\n");
}
