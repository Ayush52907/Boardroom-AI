import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SectionHeading } from "@/components/boardroom/section-heading";
import { DiscussionStream } from "@/components/boardroom/discussion-stream";
import { fmt, fmtSigned, runSimulation, type BusinessData, type SimulationInput } from "@/lib/business";
import { useAskBoard } from "@/hooks/use-board";
import type { BoardDiscussion } from "@/routes/api/board";

type SimKind = "price_change" | "hire_employee" | "marketing_spend" | "switch_supplier";

interface SimulatorPanelProps {
  business: BusinessData;
  businessSummary: string;
}

export function SimulatorPanel({ business, businessSummary }: SimulatorPanelProps) {
  const [kind, setKind] = useState<SimKind>("price_change");
  const [pctChange, setPctChange] = useState(5);
  const [hireCost, setHireCost] = useState(45000);
  const [productivity, setProductivity] = useState(6);
  const [mktSpend, setMktSpend] = useState(80000);
  const [ordersUplift, setOrdersUplift] = useState(12);
  const [supplierName, setSupplierName] = useState(
    business.suppliers[2]?.name ?? business.suppliers[0].name,
  );
  const [discussion, setDiscussion] = useState<BoardDiscussion | null>(null);

  const { mutateAsync, isPending } = useAskBoard();

  // Build the deterministic simulation input from current slider state
  const input: SimulationInput = useMemo(() => {
    switch (kind) {
      case "price_change":
        return { kind, pctChange };
      case "hire_employee":
        return { kind, monthlyCost: hireCost, productivityUplift: productivity };
      case "marketing_spend":
        return { kind, monthlyCost: mktSpend, ordersUplift };
      case "switch_supplier":
        return { kind, toSupplier: supplierName };
    }
  }, [kind, pctChange, hireCost, productivity, mktSpend, ordersUplift, supplierName]);

  // Deterministic math runs entirely client-side — no AI involved
  const sim = useMemo(() => runSimulation(business, input), [business, input]);

  async function interpret() {
    setDiscussion(null);
    try {
      const result = await mutateAsync({
        question: `Board, interpret this simulation: "${sim.label}". Discuss whether we should proceed.`,
        businessSummary,
        simulation: {
          label: sim.label,
          before: {
            revenue: sim.before.revenue,
            netMargin: +(sim.before.netMargin * 100).toFixed(2),
            operatingProfit: sim.before.operatingProfit,
          },
          after: {
            revenue: sim.after.revenue,
            netMargin: +(sim.after.netMargin * 100).toFixed(2),
            operatingProfit: sim.after.operatingProfit,
          },
          narrativeInputs: sim.narrativeInputs,
        },
      });
      setDiscussion(result);
    } catch {
      // Error already toasted by useAskBoard's onError
    }
  }

  return (
    <section className="mb-16">
      <SectionHeading
        eyebrow="Section 03"
        title="Business Simulator"
        subtitle="Test the decision before you make it. The math is deterministic. Gemma interprets."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Controls panel */}
        <div className="panel p-5 lg:col-span-2">
          <div className="mb-4">
            <label className="text-muted-foreground mb-2 block text-xs uppercase tracking-widest">
              Decision to simulate
            </label>
            <Select
              value={kind}
              onValueChange={(v) => {
                setKind(v as SimKind);
                setDiscussion(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_change">Change prices</SelectItem>
                <SelectItem value="hire_employee">Hire another employee</SelectItem>
                <SelectItem value="marketing_spend">Increase marketing spend</SelectItem>
                <SelectItem value="switch_supplier">Switch primary supplier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "price_change" && (
            <ControlRow label={`Price change: ${pctChange > 0 ? "+" : ""}${pctChange}%`}>
              <Slider
                min={-10}
                max={20}
                step={1}
                value={[pctChange]}
                onValueChange={(v) => setPctChange(v[0])}
              />
            </ControlRow>
          )}

          {kind === "hire_employee" && (
            <>
              <ControlRow label={`Monthly cost: ${business.currency}${fmt(hireCost)}`}>
                <Slider
                  min={20000}
                  max={200000}
                  step={5000}
                  value={[hireCost]}
                  onValueChange={(v) => setHireCost(v[0])}
                />
              </ControlRow>
              <ControlRow label={`Expected productivity uplift: +${productivity}%`}>
                <Slider
                  min={0}
                  max={30}
                  step={1}
                  value={[productivity]}
                  onValueChange={(v) => setProductivity(v[0])}
                />
              </ControlRow>
            </>
          )}

          {kind === "marketing_spend" && (
            <>
              <ControlRow label={`Extra spend/mo: ${business.currency}${fmt(mktSpend)}`}>
                <Slider
                  min={10000}
                  max={500000}
                  step={10000}
                  value={[mktSpend]}
                  onValueChange={(v) => setMktSpend(v[0])}
                />
              </ControlRow>
              <ControlRow label={`Expected orders uplift: +${ordersUplift}%`}>
                <Slider
                  min={0}
                  max={50}
                  step={1}
                  value={[ordersUplift]}
                  onValueChange={(v) => setOrdersUplift(v[0])}
                />
              </ControlRow>
            </>
          )}

          {kind === "switch_supplier" && (
            <ControlRow label="New primary supplier">
              <Select value={supplierName} onValueChange={setSupplierName}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {business.suppliers.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name} — reliability {(s.reliability * 100).toFixed(0)}%, cost{" "}
                      {(s.costIndex * 100).toFixed(0)}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ControlRow>
          )}

          <div className="mt-6">
            <Button
              onClick={interpret}
              disabled={isPending}
              className="bg-gold text-gold-foreground hover:opacity-90 w-full"
            >
              {isPending ? "Board is interpreting…" : "Ask the board to interpret"}
            </Button>
            <div className="text-muted-foreground mt-2 text-xs">
              Numbers are computed by business logic. Gemma only interprets the results.
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="panel p-5 lg:col-span-3">
          <div className="text-muted-foreground mb-4 text-xs uppercase tracking-widest">
            Projection · {sim.label}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ProjCol
              title="Revenue"
              before={sim.before.revenue}
              after={sim.after.revenue}
              currency={business.currency}
            />
            <ProjCol
              title="Operating profit"
              before={sim.before.operatingProfit}
              after={sim.after.operatingProfit}
              currency={business.currency}
            />
            <ProjCol
              title="Net margin"
              before={sim.before.netMargin * 100}
              after={sim.after.netMargin * 100}
              suffix="%"
              digits={1}
            />
          </div>

          {discussion && (
            <div className="mt-6 border-t border-border/60 pt-5">
              <div className="mb-3 text-muted-foreground text-xs uppercase tracking-widest">
                Board interpretation
              </div>
              <DiscussionStream discussion={discussion} companyName={business.companyName} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- Sub-components ---------- */

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-sm">{label}</div>
      {children}
    </div>
  );
}

function ProjCol({
  title,
  before,
  after,
  currency = "",
  suffix = "",
  digits = 0,
}: {
  title: string;
  before: number;
  after: number;
  currency?: string;
  suffix?: string;
  digits?: number;
}) {
  const delta = after - before;
  const good = delta >= 0;
  const format = (n: number) =>
    currency ? `${currency}${fmt(n)}` : `${n.toFixed(digits)}${suffix}`;

  return (
    <div className="rounded-md border border-border/60 bg-card/50 p-3">
      <div className="text-muted-foreground text-xs uppercase tracking-wider">{title}</div>
      <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
        <span>Before</span>
        <span>{format(before)}</span>
      </div>
      <div className="text-gold flex items-center justify-between text-sm">
        <span className="uppercase tracking-wider text-xs">After</span>
        <span className="font-display text-lg">{format(after)}</span>
      </div>
      <div
        className="mt-2 text-xs"
        style={{ color: good ? "var(--success)" : "var(--destructive)" }}
      >
        {good ? "▲" : "▼"}{" "}
        {currency
          ? `${currency}${fmtSigned(delta)}`
          : `${delta >= 0 ? "+" : ""}${delta.toFixed(digits)}${suffix}`}
      </div>
    </div>
  );
}
