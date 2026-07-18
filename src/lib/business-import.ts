import JSZip from "jszip";
import Papa from "papaparse";
import type { BusinessData } from "@/lib/business";
import { DEMO_BUSINESS } from "@/lib/business";

/**
 * Result metadata from parsing a business ZIP file.
 */
export type ZipParseResult = {
  data: BusinessData;
  detectedFiles: Array<{ filename: string; category: string; recordCount: number }>;
};

/**
 * Intelligent ZIP parser that auto-detects and extracts business data
 * from ANY ZIP archive containing CSV/tabular files with arbitrary file names and column structures.
 */
export async function parseBusinessZip(file: File | Blob): Promise<BusinessData> {
  const result = await parseBusinessZipWithMetadata(file);
  return result.data;
}

/**
 * Advanced parser that returns both the populated BusinessData object
 * and detection metadata (which files were found and how they were categorized).
 */
export async function parseBusinessZipWithMetadata(file: File | Blob): Promise<ZipParseResult> {
  const zip = await JSZip.loadAsync(file);
  const parsedFiles: Array<{ filename: string; rows: any[][]; headers: string[] }> = [];

  // 1. Read all files inside the ZIP archive (excluding hidden system files)
  const fileEntries: Array<{ name: string; entry: JSZip.JSZipObject }> = [];
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    const filename = path.split("/").pop() || "";
    if (filename.startsWith(".") || path.includes("__MACOSX")) return;
    fileEntries.push({ name: filename, entry });
  });

  if (fileEntries.length === 0) {
    throw new Error("The uploaded ZIP archive contains no readable files.");
  }

  // Parse each file with PapaParse
  for (const { name, entry } of fileEntries) {
    try {
      const text = await entry.async("string");
      if (!text.trim()) continue;

      // Parse raw matrix first to inspect headers and structure
      const parsedRaw = Papa.parse<string[]>(text, {
        skipEmptyLines: "greedy",
      });

      if (parsedRaw.data && parsedRaw.data.length > 0) {
        const headers = parsedRaw.data[0].map((h) => String(h || "").trim());
        const rows = parsedRaw.data.slice(1);
        parsedFiles.push({ filename: name, headers, rows });
      }
    } catch {
      // Ignore unparseable non-text files inside zip
    }
  }

  if (parsedFiles.length === 0) {
    throw new Error("Could not extract any valid CSV or tabular data from the uploaded ZIP file.");
  }

  // 2. Classification & Data Extraction Buckets
  const kvPairs = new Map<string, string>();
  let revenueTrend: number[] = [];
  let suppliers: Array<{ name: string; reliability: number; costIndex: number }> = [];
  let overdueInvoices: Array<{ customer: string; amount: number; daysOverdue: number }> = [];

  const detectedFiles: Array<{ filename: string; category: string; recordCount: number }> = [];

  // Helper to categorize each parsed CSV file
  for (const f of parsedFiles) {
    const fnLower = f.filename.toLowerCase();
    const headersLower = f.headers.map((h) => h.toLowerCase());

    const isKeyValueTable =
      f.headers.length === 2 &&
      (headersLower.includes("key") ||
        headersLower.includes("field") ||
        headersLower.includes("parameter") ||
        headersLower.includes("metric") ||
        headersLower.includes("attribute") ||
        fnLower.includes("company") ||
        fnLower.includes("profile") ||
        fnLower.includes("overview") ||
        fnLower.includes("parameter") ||
        fnLower.includes("metric") ||
        fnLower.includes("summary"));

    const isRevenueTrendTable =
      fnLower.includes("revenue") ||
      fnLower.includes("sales") ||
      fnLower.includes("trend") ||
      fnLower.includes("monthly") ||
      fnLower.includes("income") ||
      headersLower.some((h) => h.includes("month") || h.includes("period") || h.includes("date"));

    const isSupplierTable =
      fnLower.includes("supplier") ||
      fnLower.includes("vendor") ||
      fnLower.includes("source") ||
      fnLower.includes("procurement") ||
      headersLower.some((h) => h.includes("reliability") || h.includes("costindex") || h.includes("vendor") || h.includes("supplier"));

    const isOverdueTable =
      fnLower.includes("invoice") ||
      fnLower.includes("overdue") ||
      fnLower.includes("ar") ||
      fnLower.includes("receivable") ||
      fnLower.includes("customer") ||
      headersLower.some((h) => h.includes("customer") || h.includes("overdue") || h.includes("days") || h.includes("client"));

    if (isKeyValueTable) {
      // Process Key-Value pairs
      for (const row of f.rows) {
        if (row.length >= 2) {
          const k = String(row[0] || "").trim();
          const v = String(row[1] || "").trim();
          if (k) kvPairs.set(normalizeKey(k), v);
        }
      }
      detectedFiles.push({ filename: f.filename, category: "Company Parameters", recordCount: f.rows.length });
    } else if (isSupplierTable) {
      // Process Supplier list
      const nameIdx = findHeaderIndex(f.headers, ["name", "supplier", "vendor", "source", "company", "partner"]);
      const relIdx = findHeaderIndex(f.headers, ["reliability", "score", "rating", "performance", "quality"]);
      const costIdx = findHeaderIndex(f.headers, ["costindex", "cost_index", "cost", "priceindex", "price_index", "index"]);

      const extractedSuppliers = f.rows
        .map((row) => {
          const name = nameIdx >= 0 ? String(row[nameIdx] || "").trim() : String(row[0] || "").trim();
          const relRaw = relIdx >= 0 ? parseNumber(row[relIdx]) : 0.9;
          const costRaw = costIdx >= 0 ? parseNumber(row[costIdx]) : 1.0;

          return {
            name,
            reliability: clamp01(relRaw > 1 ? relRaw / 100 : relRaw),
            costIndex: costRaw || 1.0,
          };
        })
        .filter((s) => s.name);

      if (extractedSuppliers.length > 0) {
        suppliers = extractedSuppliers;
      }
      detectedFiles.push({ filename: f.filename, category: "Supplier Directory", recordCount: extractedSuppliers.length });
    } else if (isOverdueTable) {
      // Process Overdue Invoices / AR list
      const custIdx = findHeaderIndex(f.headers, ["customer", "client", "account", "debtor", "buyer", "name"]);
      const amtIdx = findHeaderIndex(f.headers, ["amount", "balance", "due", "owed", "value", "total"]);
      const daysIdx = findHeaderIndex(f.headers, ["daysoverdue", "days_overdue", "days", "overdue", "age", "aging"]);

      const extractedInvoices = f.rows
        .map((row) => {
          const customer = custIdx >= 0 ? String(row[custIdx] || "").trim() : String(row[0] || "").trim();
          const amount = amtIdx >= 0 ? parseNumber(row[amtIdx]) : parseNumber(row[1]);
          const daysOverdue = daysIdx >= 0 ? parseNumber(row[daysIdx]) : parseNumber(row[2]);

          return { customer, amount, daysOverdue };
        })
        .filter((i) => i.customer && i.amount > 0);

      if (extractedInvoices.length > 0) {
        overdueInvoices = extractedInvoices;
      }
      detectedFiles.push({ filename: f.filename, category: "Accounts Receivable", recordCount: extractedInvoices.length });
    } else if (isRevenueTrendTable || f.rows.length > 1) {
      // Process Revenue Trend series
      const revIdx = findHeaderIndex(f.headers, ["revenue", "sales", "income", "turnover", "amount", "val", "value"]);

      const extractedTrend: number[] = [];
      if (revIdx >= 0) {
        for (const row of f.rows) {
          const n = parseNumber(row[revIdx]);
          if (n > 0) extractedTrend.push(n);
        }
      } else {
        // Fallback: look for numeric column
        for (const row of f.rows) {
          for (const cell of row) {
            const n = parseNumber(cell);
            if (n > 1000) {
              extractedTrend.push(n);
              break;
            }
          }
        }
      }

      if (extractedTrend.length > 0) {
        revenueTrend = extractedTrend;
        detectedFiles.push({ filename: f.filename, category: "Revenue Trend", recordCount: extractedTrend.length });
      } else {
        // Generic fallback parsing for key-values embedded in table
        parseGenericRowKV(f.rows, kvPairs);
        detectedFiles.push({ filename: f.filename, category: "Financial Table", recordCount: f.rows.length });
      }
    } else {
      parseGenericRowKV(f.rows, kvPairs);
      detectedFiles.push({ filename: f.filename, category: "General Data", recordCount: f.rows.length });
    }
  }

  // 3. Construct BusinessData with Smart Flexible Mapping & Fallbacks
  const getKVNum = (keys: string[], fallback: number): number => {
    for (const k of keys) {
      const val = kvPairs.get(normalizeKey(k));
      if (val !== undefined && val !== "") {
        const n = parseNumber(val);
        if (Number.isFinite(n) && n !== 0) return n;
      }
    }
    return fallback;
  };

  const getKVStr = (keys: string[], fallback: string): string => {
    for (const k of keys) {
      const val = kvPairs.get(normalizeKey(k));
      if (val) return val;
    }
    return fallback;
  };

  // Extract CogsRatio safely (converts e.g. 62% or 62 to 0.62)
  let cogsRatioRaw = getKVNum(["cogsRatio", "cogs", "cogs_ratio", "costRatio", "cost_of_goods_sold"], DEMO_BUSINESS.cogsRatio);
  if (cogsRatioRaw > 1) cogsRatioRaw = cogsRatioRaw / 100;
  cogsRatioRaw = clamp01(cogsRatioRaw);

  const monthlyRevenue = getKVNum(
    ["monthlyRevenue", "monthly_revenue", "revenue", "monthlySales", "sales", "income"],
    revenueTrend.at(-1) ?? DEMO_BUSINESS.monthlyRevenue,
  );

  const avgOrderValue = getKVNum(["avgOrderValue", "avg_order_value", "aov", "averageOrderValue"], DEMO_BUSINESS.avgOrderValue);
  const monthlyOrders = getKVNum(
    ["monthlyOrders", "monthly_orders", "orderCount", "orders"],
    Math.round(monthlyRevenue / Math.max(1, avgOrderValue)),
  );

  const businessData: BusinessData = {
    companyName: getKVStr(["companyName", "company_name", "company", "businessName", "name", "business"], "Uploaded Company"),
    industry: getKVStr(["industry", "sector", "businessType", "category"], "Unspecified"),
    currency: getKVStr(["currency", "symbol", "curr"], "₹"),
    monthlyRevenue,
    revenueTrend: revenueTrend.length ? revenueTrend : [monthlyRevenue * 0.88, monthlyRevenue * 0.92, monthlyRevenue * 0.95, monthlyRevenue * 0.98, monthlyRevenue * 0.97, monthlyRevenue],
    cogsRatio: cogsRatioRaw,
    fixedCosts: getKVNum(["fixedCosts", "fixed_costs", "overhead", "expenses", "fixedExpenses"], DEMO_BUSINESS.fixedCosts),
    cashReserves: getKVNum(["cashReserves", "cash_reserves", "cash", "bankBalance", "liquidity"], DEMO_BUSINESS.cashReserves),
    outstandingInvoices: getKVNum(["outstandingInvoices", "outstanding_invoices", "ar", "accountsReceivable"], overdueInvoices.reduce((s, i) => s + i.amount, 0) || DEMO_BUSINESS.outstandingInvoices),
    inventoryValue: getKVNum(["inventoryValue", "inventory_value", "inventory", "stockValue"], DEMO_BUSINESS.inventoryValue),
    avgOrderValue,
    monthlyOrders,
    priceElasticity: getKVNum(["priceElasticity", "price_elasticity", "elasticity"], DEMO_BUSINESS.priceElasticity),
    suppliers: suppliers.length ? suppliers : DEMO_BUSINESS.suppliers,
    overdueInvoices: overdueInvoices.length ? overdueInvoices : DEMO_BUSINESS.overdueInvoices,
  };

  return {
    data: businessData,
    detectedFiles,
  };
}

/**
 * Downloads a template ZIP file with sample CSV files for testing.
 */
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

  zip.file("company_metrics.csv", companyCsv);
  zip.file("sales_history.csv", revenueCsv);
  zip.file("vendor_list.csv", suppliersCsv);
  zip.file("pending_invoices.csv", invoicesCsv);
  zip.file("README.txt", "Upload any ZIP file containing your business CSVs. Gemma automatically detects and maps column names and data structures.");

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gemma-boardroom-data-template.zip";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Helper Utilities for Flexible Auto-Detection & Normalization
// ---------------------------------------------------------------------------

function normalizeKey(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseNumber(val: any): number {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[%$,₹\s]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function findHeaderIndex(headers: string[], synonyms: string[]): number {
  const normalizedHeaders = headers.map(normalizeKey);
  for (const synonym of synonyms) {
    const normSyn = normalizeKey(synonym);
    const idx = normalizedHeaders.findIndex((h) => h === normSyn || h.includes(normSyn) || normSyn.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseGenericRowKV(rows: any[][], kvMap: Map<string, string>) {
  for (const row of rows) {
    if (row.length >= 2) {
      const k = String(row[0] || "").trim();
      const v = String(row[1] || "").trim();
      if (k && v) {
        kvMap.set(normalizeKey(k), v);
      }
    }
  }
}

function csvSafe(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
