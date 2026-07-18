import { CircleDollarSign, Coins, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/boardroom/section-heading";
import { fmt, computePriorities, type BusinessData, type Metrics } from "@/lib/business";

interface ExecutiveSnapshotProps {
  business: BusinessData;
  metrics: Metrics;
  priorities: ReturnType<typeof computePriorities>;
}

export function ExecutiveSnapshot({ business, metrics, priorities }: ExecutiveSnapshotProps) {
  return (
    <section className="mb-16">
      <SectionHeading
        eyebrow="Section 01"
        title="Executive Snapshot"
        subtitle="What deserves your attention today."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <HealthCard score={metrics.healthScore} />
        <div className="panel p-5 md:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricStat
              icon={<CircleDollarSign className="h-4 w-4" />}
              label="Revenue (mo)"
              value={`${business.currency}${fmt(metrics.revenue)}`}
              sub={`${metrics.revenueGrowth >= 0 ? "+" : ""}${metrics.revenueGrowth.toFixed(1)}% vs prev`}
              good={metrics.revenueGrowth >= 0}
            />
            <MetricStat
              icon={<TrendingUp className="h-4 w-4" />}
              label="Net margin"
              value={`${(metrics.netMargin * 100).toFixed(1)}%`}
              sub={`Gross ${(metrics.grossMargin * 100).toFixed(0)}%`}
              good={metrics.netMargin > 0.12}
            />
            <MetricStat
              icon={<Wallet className="h-4 w-4" />}
              label="Cash"
              value={`${business.currency}${fmt(business.cashReserves)}`}
              sub={`Cash score ${metrics.cashFlowScore}`}
              good={metrics.cashFlowScore > 55}
            />
            <MetricStat
              icon={<Coins className="h-4 w-4" />}
              label="Overdue AR"
              value={`${business.currency}${fmt(business.outstandingInvoices)}`}
              sub={`Collections ${metrics.collectionsScore}`}
              good={metrics.collectionsScore > 60}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-5">
        <div className="panel md:col-span-3 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg">Today's Priorities</h3>
            <Badge variant="outline" className="text-gold border-gold/40">
              Board consensus
            </Badge>
          </div>
          <div className="space-y-3">
            {priorities.map((p, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-md border border-border/50 bg-card/50 p-3"
              >
                <div
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      p.severity === "high"
                        ? "var(--destructive)"
                        : p.severity === "medium"
                          ? "var(--warning)"
                          : "var(--success)",
                  }}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.title}</div>
                  <div className="text-muted-foreground text-xs">{p.detail}</div>
                </div>
              </div>
            ))}
            {priorities.length === 0 && (
              <div className="text-muted-foreground text-sm">
                The board sees no immediate concerns.
              </div>
            )}
          </div>
        </div>
        <RevenueSpark business={business} />
      </div>
    </section>
  );
}

/* ---------- Sub-components ---------- */

function HealthCard({ score }: { score: number }) {
  const status =
    score >= 75 ? "Strong" : score >= 55 ? "Stable" : score >= 35 ? "At risk" : "Critical";
  const color =
    score >= 75
      ? "var(--success)"
      : score >= 55
        ? "#000000"
        : score >= 35
          ? "var(--warning)"
          : "var(--destructive)";
  const circumference = 2 * Math.PI * 46;
  const dash = (score / 100) * circumference;

  return (
    <div className="panel flex items-center gap-5 p-5">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="46" strokeWidth="8" stroke="rgba(0,0,0,0.06)" fill="none" />
          <circle
            cx="60"
            cy="60"
            r="46"
            strokeWidth="8"
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-3xl font-semibold">{score}</div>
          <div className="text-muted-foreground text-[10px]">/ 100</div>
        </div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs">Business Health</div>
        <div className="font-display text-2xl" style={{ color }}>
          {status}
        </div>
        <div className="text-muted-foreground mt-1 text-xs">
          Weighted across margin, cash, collections, inventory.
        </div>
      </div>
    </div>
  );
}

function MetricStat({
  icon,
  label,
  value,
  sub,
  good,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  good: boolean;
}) {
  return (
    <div>
      <div className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs">
        {icon} {label}
      </div>
      <div className="font-display text-xl font-semibold text-black">{value}</div>
      <div className="text-xs" style={{ color: good ? "var(--success)" : "var(--warning)" }}>
        {sub}
      </div>
    </div>
  );
}

function RevenueSpark({ business }: { business: BusinessData }) {
  const data = business.revenueTrend;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = Math.max(1, max - min);
  const w = 260,
    h = 100,
    pad = 6;
  const pts = data
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / (data.length - 1);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="panel md:col-span-2 p-5">
      <div className="mb-2 text-muted-foreground text-xs">
        Revenue — Last 6 Months
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full">
        <polyline points={pts} fill="none" stroke="#000000" strokeWidth="2.5" />
        {data.map((v, i) => {
          const x = pad + (i * (w - pad * 2)) / (data.length - 1);
          const y = h - pad - ((v - min) / range) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r={3} fill="#000000" />;
        })}
      </svg>
      <div className="text-muted-foreground mt-2 flex justify-between text-xs">
        <span>
          {business.currency}
          {fmt(min)}
        </span>
        <span>
          {business.currency}
          {fmt(max)}
        </span>
      </div>
    </div>
  );
}
