// Business data types + deterministic calculations + structured context builder.

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
      const orderChange = pct * b.priceElasticity;
      const newOrders = b.monthlyOrders * (1 + orderChange);
      const newAOV = b.avgOrderValue * (1 + pct);
      next.monthlyOrders = newOrders;
      next.avgOrderValue = newAOV;
      next.monthlyRevenue = newOrders * newAOV;
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
      detail: `${b.overdueInvoices.length} accounts overdue; top: ${b.overdueInvoices[0]?.customer || "Account"} (${b.overdueInvoices[0]?.daysOverdue || 0}d).`,
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

// ---------------------------------------------------------------------------
// Structured Business Context Architecture (Phase - Structured Context)
// ---------------------------------------------------------------------------

export type SupplierSummaryItem = {
  name: string;
  reliability: number;
  costIndex: number;
  isFlagged?: boolean;
};

export type CustomerSummaryItem = {
  customer: string;
  amount: number;
  daysOverdue: number;
  isHighRisk?: boolean;
};

export type BusinessContext = {
  financial: {
    companyName: string;
    industry: string;
    currency: string;
    monthlyRevenue: number;
    revenueTrend: number[];
    revenueGrowthPct: number;
    cogsRatioPct: number;
    grossMarginPct: number;
    fixedCosts: number;
    operatingProfit: number;
    netMarginPct: number;
    cashReserves: number;
    cashFlowScore: number;
    outstandingInvoicesTotal: number;
    collectionsScore: number;
    healthScore: number;
  };
  operations: {
    monthlyOrders: number;
    avgOrderValue: number;
    inventoryValue: number;
    inventoryScore: number;
    fixedCosts: number;
    cogsRatioPct: number;
  };
  suppliers: {
    totalCount: number;
    avgReliabilityPct: number;
    avgCostIndexPct: number;
    topSuppliers: SupplierSummaryItem[];
    flaggedSuppliers: SupplierSummaryItem[];
    otherSuppliersCount: number;
  };
  customers: {
    monthlyOrders: number;
    avgOrderValue: number;
    priceElasticity: number;
    totalOverdueAmount: number;
    overdueCount: number;
    topOverdueInvoices: CustomerSummaryItem[];
    highRiskCount: number;
    otherOverdueAmount: number;
  };
  strategic: {
    healthScore: number;
    priorities: Array<{ title: string; detail: string; severity: "high" | "medium" | "low" }>;
  };
};

/**
 * Builds a structured, compact BusinessContext object deterministically.
 * Aggregates large lists (suppliers, overdue invoices) into top items + summary stats.
 */
export function buildBusinessContext(b: BusinessData, m: Metrics): BusinessContext {
  const priorities = computePriorities(b, m);

  // Process & aggregate Suppliers (Top 5 + Flagged + Summary stats)
  const totalSuppliers = b.suppliers.length;
  const avgReliability = avg(b.suppliers.map((s) => s.reliability));
  const avgCostIndex = avg(b.suppliers.map((s) => s.costIndex));

  const topSuppliers: SupplierSummaryItem[] = b.suppliers.slice(0, 5).map((s) => ({
    name: s.name,
    reliability: +(s.reliability * 100).toFixed(0),
    costIndex: +(s.costIndex * 100).toFixed(0),
    isFlagged: s.reliability < 0.75,
  }));

  const flaggedSuppliers: SupplierSummaryItem[] = b.suppliers
    .filter((s) => s.reliability < 0.75)
    .map((s) => ({
      name: s.name,
      reliability: +(s.reliability * 100).toFixed(0),
      costIndex: +(s.costIndex * 100).toFixed(0),
      isFlagged: true,
    }));

  const otherSuppliersCount = Math.max(0, totalSuppliers - topSuppliers.length);

  // Process & aggregate Overdue Invoices / AR (Top 5 + High risk + Summary stats)
  const sortedInvoices = [...b.overdueInvoices].sort((a, b) => b.amount - a.amount);
  const totalOverdueAmount = b.outstandingInvoices;
  const overdueCount = b.overdueInvoices.length;

  const topOverdueInvoices: CustomerSummaryItem[] = sortedInvoices.slice(0, 5).map((i) => ({
    customer: i.customer,
    amount: i.amount,
    daysOverdue: i.daysOverdue,
    isHighRisk: i.daysOverdue > 30,
  }));

  const highRiskCount = b.overdueInvoices.filter((i) => i.daysOverdue > 30).length;
  const topInvoicesSum = topOverdueInvoices.reduce((s, i) => s + i.amount, 0);
  const otherOverdueAmount = Math.max(0, totalOverdueAmount - topInvoicesSum);

  return {
    financial: {
      companyName: b.companyName,
      industry: b.industry,
      currency: b.currency,
      monthlyRevenue: m.revenue,
      revenueTrend: b.revenueTrend,
      revenueGrowthPct: +m.revenueGrowth.toFixed(1),
      cogsRatioPct: +(b.cogsRatio * 100).toFixed(1),
      grossMarginPct: +(m.grossMargin * 100).toFixed(1),
      fixedCosts: b.fixedCosts,
      operatingProfit: m.operatingProfit,
      netMarginPct: +(m.netMargin * 100).toFixed(1),
      cashReserves: b.cashReserves,
      cashFlowScore: m.cashFlowScore,
      outstandingInvoicesTotal: b.outstandingInvoices,
      collectionsScore: m.collectionsScore,
      healthScore: m.healthScore,
    },
    operations: {
      monthlyOrders: b.monthlyOrders,
      avgOrderValue: b.avgOrderValue,
      inventoryValue: b.inventoryValue,
      inventoryScore: m.inventoryScore,
      fixedCosts: b.fixedCosts,
      cogsRatioPct: +(b.cogsRatio * 100).toFixed(1),
    },
    suppliers: {
      totalCount: totalSuppliers,
      avgReliabilityPct: +(avgReliability * 100).toFixed(0),
      avgCostIndexPct: +(avgCostIndex * 100).toFixed(0),
      topSuppliers,
      flaggedSuppliers,
      otherSuppliersCount,
    },
    customers: {
      monthlyOrders: b.monthlyOrders,
      avgOrderValue: b.avgOrderValue,
      priceElasticity: b.priceElasticity,
      totalOverdueAmount,
      overdueCount,
      topOverdueInvoices,
      highRiskCount,
      otherOverdueAmount,
    },
    strategic: {
      healthScore: m.healthScore,
      priorities,
    },
  };
}

/**
 * Role-scoped context selector. Gives each executive only the slice of data relevant to their role.
 */
export function getContextForExecutive(
  role: string,
  context: BusinessContext,
  question: string = "",
): Record<string, unknown> {
  const isPricingRelated = /price|pricing|cost|elasticity|margin|discount/i.test(question);

  switch (role) {
    case "CFO": {
      const slice: Record<string, unknown> = {
        financial: context.financial,
        collections: {
          totalOverdue: context.customers.totalOverdueAmount,
          overdueCount: context.customers.overdueCount,
          topOverdueInvoices: context.customers.topOverdueInvoices,
          highRiskCount: context.customers.highRiskCount,
        },
      };
      if (isPricingRelated) {
        slice.pricingFactors = {
          priceElasticity: context.customers.priceElasticity,
          avgOrderValue: context.customers.avgOrderValue,
          cogsRatioPct: context.financial.cogsRatioPct,
        };
      }
      return slice;
    }

    case "CMO":
    case "Marketing Director": {
      return {
        customers: context.customers,
        revenueTrend: context.financial.revenueTrend,
        monthlyRevenue: context.financial.monthlyRevenue,
        revenueGrowthPct: context.financial.revenueGrowthPct,
        currency: context.financial.currency,
      };
    }

    case "COO":
    case "Operations Head": {
      return {
        operations: context.operations,
        suppliersSummary: {
          totalCount: context.suppliers.totalCount,
          avgReliabilityPct: context.suppliers.avgReliabilityPct,
          flaggedSuppliers: context.suppliers.flaggedSuppliers,
        },
        healthScore: context.financial.healthScore,
      };
    }

    case "Procurement Officer":
    case "Procurement Advisor": {
      return {
        suppliers: context.suppliers,
        inventory: {
          inventoryValue: context.operations.inventoryValue,
          inventoryScore: context.operations.inventoryScore,
          cogsRatioPct: context.operations.cogsRatioPct,
        },
        currency: context.financial.currency,
      };
    }

    case "CTO": {
      return {
        operations: context.operations,
        financialOverview: {
          monthlyRevenue: context.financial.monthlyRevenue,
          fixedCosts: context.financial.fixedCosts,
        },
        strategic: context.strategic,
      };
    }

    case "Business Analyst":
    case "CEO":
    default: {
      // CEO / Analyst decision maker gets compact synthesis of key indicators
      return {
        company: context.financial.companyName,
        industry: context.financial.industry,
        currency: context.financial.currency,
        financialOverview: {
          monthlyRevenue: context.financial.monthlyRevenue,
          operatingProfit: context.financial.operatingProfit,
          netMarginPct: context.financial.netMarginPct,
          cashReserves: context.financial.cashReserves,
          healthScore: context.financial.healthScore,
        },
        operationsOverview: {
          inventoryScore: context.operations.inventoryScore,
          avgOrderValue: context.operations.avgOrderValue,
        },
        suppliersOverview: {
          totalCount: context.suppliers.totalCount,
          avgReliabilityPct: context.suppliers.avgReliabilityPct,
          flaggedCount: context.suppliers.flaggedSuppliers.length,
        },
        customersOverview: {
          totalOverdueAmount: context.customers.totalOverdueAmount,
          highRiskCount: context.customers.highRiskCount,
        },
        strategicPriorities: context.strategic.priorities,
      };
    }
  }
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
