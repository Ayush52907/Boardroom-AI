import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeading } from "@/components/boardroom/section-heading";
import { downloadBriefingPdf } from "@/lib/pdf";
import { useGenerateBriefing } from "@/hooks/use-briefing";
import type { Brief } from "@/routes/api/briefing";

import type { BusinessContext } from "@/lib/business";

type BriefRole = "CEO" | "CFO" | "COO" | "CMO" | "CTO" | "Procurement Officer" | "Business Analyst";

const BRIEF_ROLES: BriefRole[] = [
  "CEO",
  "CFO",
  "COO",
  "CMO",
  "CTO",
  "Procurement Officer",
  "Business Analyst",
];

interface BriefingsPanelProps {
  businessContext: BusinessContext;
  companyName: string;
}

export function BriefingsPanel({ businessContext, companyName }: BriefingsPanelProps) {
  const [activeRole, setActiveRole] = useState<string>("CEO");
  const [briefs, setBriefs] = useState<Record<string, Brief>>({});
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const { mutateAsync } = useGenerateBriefing();

  async function generate(role: string) {
    setLoadingRole(role);
    try {
      const result = await mutateAsync({ role, businessContext });
      setBriefs((prev) => ({ ...prev, [role]: result }));
    } catch {
      // Error already toasted by useGenerateBriefing's onError
    } finally {
      setLoadingRole(null);
    }
  }

  return (
    <section className="mb-16">
      <SectionHeading
        eyebrow="Section 04"
        title="Executive Briefings"
        subtitle="Every board member's read-out, in bullets, downloadable as PDF."
      />
      <div className="panel p-5 md:p-7">
        <Tabs value={activeRole} onValueChange={setActiveRole}>
          <TabsList className="flex-wrap h-auto">
            {BRIEF_ROLES.map((r) => (
              <TabsTrigger key={r} value={r} className="text-xs">
                {r}
              </TabsTrigger>
            ))}
          </TabsList>

          {BRIEF_ROLES.map((r) => (
            <TabsContent key={r} value={r} className="mt-5">
              {!briefs[r] ? (
                <div className="flex flex-col items-start gap-3">
                  <div className="text-muted-foreground text-sm">
                    Generate a briefing tailored for the {r}. Bullet-only, grounded in your numbers.
                  </div>
                  <Button
                    onClick={() => generate(r)}
                    disabled={loadingRole === r}
                    className="bg-gold text-gold-foreground hover:opacity-90"
                  >
                    {loadingRole === r ? "Preparing…" : `Generate ${r} briefing`}
                  </Button>
                </div>
              ) : (
                <BriefCard
                  brief={briefs[r]}
                  companyName={companyName}
                  onRegenerate={() => generate(r)}
                  isRegenerating={loadingRole === r}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}

/* ---------- Sub-components ---------- */

function BriefCard({
  brief,
  companyName,
  onRegenerate,
  isRegenerating,
}: {
  brief: Brief;
  companyName: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-gold mb-1 text-xs uppercase tracking-widest">
            {brief.role} Brief · Prepared by Gemma
          </div>
          <h3 className="font-display text-2xl">{brief.headline}</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-gold/40 text-gold hover:bg-gold/10"
          onClick={() => downloadBriefingPdf(brief, companyName)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
        </Button>
      </div>

      {brief.keyMetrics?.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {brief.keyMetrics.map((m, i) => (
            <div key={i} className="rounded-md border border-border/60 bg-card/50 p-2.5">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{m.label}</div>
              <div className="font-display text-base">{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {brief.bullets?.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {brief.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-gold mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="mt-4"
        onClick={onRegenerate}
        disabled={isRegenerating}
      >
        {isRegenerating ? "Regenerating…" : "Regenerate"}
      </Button>
    </div>
  );
}
