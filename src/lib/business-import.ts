import JSZip from "jszip";
import Papa from "papaparse";
import type { BusinessData } from "@/lib/business";
import { DEMO_BUSINESS } from "@/lib/business";

// Expected ZIP contents (case-insensitive filenames):
//   company.csv          — key,value pairs of scalar fields
//   revenue_trend.csv    — month,revenue (last 6 rows, oldest first)
//   suppliers.csv        — name,reliability,costIndex
//   overdue_invoices.csv — customer,amount,daysOverdue

export async function parseBusinessZip(file: File | Blob): Promise<BusinessData> {
  const zip = await JSZip.loadAsync(file);
  const files = new Map<string, JSZip.JSZipObject>();
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    const base = path.split("/").pop()!.toLowerCase();
    files.set(base, entry);
  });

  const readCsv = async (name: string): Promise<any[]> => {
    const f = files.get(name);
    if (!f) return [];
    const text = await f.async("string");
    const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    return res.data as any[];
  };

  const companyRows = await readCsv("company.csv");
  const revRows = await readCsv("revenue_trend.csv");
  const supRows = await readCsv("suppliers.csv");
  const invRows = await readCsv("overdue_invoices.csv");

  if (!companyRows.length && !revRows.length && !supRows.length) {
    throw new Error("ZIP is missing company.csv / revenue_trend.csv / suppliers.csv.");
  }

  const kv = new Map<string, string>();
  for (const row of companyRows) {
    const k = String(row.key ?? row.field ?? "").trim();
    const v = String(row.value ?? row.val ?? "").trim();
    if (k) kv.set(k.toLowerCase(), v);
  }

  const num = (k: string, fallback: number) => {
    const raw = kv.get(k.toLowerCase());
    if (raw == null || raw === "") return fallback;
    const n = Number(raw.replace(/[, ]/g, ""));
    return Number.isFinite(n) ? n : fallback;
  };
  const str = (k: string, fallback: string) => (kv.get(k.toLowerCase()) || fallback);

  const revenueTrend = revRows
    .map((r) => Number(String(r.revenue ?? r.value ?? "").replace(/[, ]/g, "")))
    .filter((n) => Number.isFinite(n));
  const suppliers = supRows
    .map((r) => ({
      name: String(r.name ?? "").trim(),
      reliability: clamp01(Number(r.reliability ?? 0.9)),
      costIndex: Number(r.costIndex ?? r.cost_index ?? 1),
    }))
    .filter((s) => s.name);
  const overdueInvoices = invRows
    .map((r) => ({
      customer: String(r.customer ?? "").trim(),
      amount: Number(String(r.amount ?? "0").replace(/[, ]/g, "")),
      daysOverdue: Number(r.daysOverdue ?? r.days_overdue ?? 0),
    }))
    .filter((i) => i.customer && Number.isFinite(i.amount));

  const b: BusinessData = {
    companyName: str("companyName", "Uploaded Company"),
    industry: str("industry", "Unspecified"),
    currency: str("currency", "₹"),
    monthlyRevenue: num("monthlyRevenue", revenueTrend.at(-1) ?? DEMO_BUSINESS.monthlyRevenue),
    revenueTrend: revenueTrend.length ? revenueTrend : DEMO_BUSINESS.revenueTrend,
    cogsRatio: num("cogsRatio", DEMO_BUSINESS.cogsRatio),
    fixedCosts: num("fixedCosts", DEMO_BUSINESS.fixedCosts),
    cashReserves: num("cashReserves", DEMO_BUSINESS.cashReserves),
    outstandingInvoices: num("outstandingInvoices", DEMO_BUSINESS.outstandingInvoices),
    inventoryValue: num("inventoryValue", DEMO_BUSINESS.inventoryValue),
    avgOrderValue: num("avgOrderValue", DEMO_BUSINESS.avgOrderValue),
    monthlyOrders: num("monthlyOrders", DEMO_BUSINESS.monthlyOrders),
    priceElasticity: num("priceElasticity", DEMO_BUSINESS.priceElasticity),
    suppliers: suppliers.length ? suppliers : DEMO_BUSINESS.suppliers,
    overdueInvoices: overdueInvoices.length ? overdueInvoices : DEMO_BUSINESS.overdueInvoices,
  };
  return b;
}

export async function downloadTemplateZip() {
  const zip = new JSZip();
  const b = DEMO_BUSINESS;
  const companyCsv = [
    "key,value",
    `companyName,${csvSafe(b.companyName)}`,
    `industry,${csvSafe(b.industry)}`,
    `currency,${csvSafe(b.currency)}`,
    `monthlyRevenue,${b.monthlyRevenue}`,
    `cogsRatio,${b.cogsRatio}`,
    `fixedCosts,${b.fixedCosts}`,
    `cashReserves,${b.cashReserves}`,
    `outstandingInvoices,${b.outstandingInvoices}`,
    `inventoryValue,${b.inventoryValue}`,
    `avgOrderValue,${b.avgOrderValue}`,
    `monthlyOrders,${b.monthlyOrders}`,
    `priceElasticity,${b.priceElasticity}`,
  ].join("\n");
  const revenueCsv = ["month,revenue", ...b.revenueTrend.map((v, i) => `M-${b.revenueTrend.length - i},${v}`)].join("\n");
  const suppliersCsv = ["name,reliability,costIndex", ...b.suppliers.map((s) => `${csvSafe(s.name)},${s.reliability},${s.costIndex}`)].join("\n");
  const invoicesCsv = ["customer,amount,daysOverdue", ...b.overdueInvoices.map((i) => `${csvSafe(i.customer)},${i.amount},${i.daysOverdue}`)].join("\n");

  zip.file("company.csv", companyCsv);
  zip.file("revenue_trend.csv", revenueCsv);
  zip.file("suppliers.csv", suppliersCsv);
  zip.file("overdue_invoices.csv", invoicesCsv);
  zip.file("README.txt", "Edit these CSV files with your company data, keep the filenames unchanged, then zip them again and upload.");

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gemma-boardroom-template.zip";
  a.click();
  URL.revokeObjectURL(url);
}

function csvSafe(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
