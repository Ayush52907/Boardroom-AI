import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { BoardDiscussion, BoardMessage } from "@/routes/api/board";
import { EXECUTIVES, type ExecRole } from "@/lib/executives";
import { ExecAvatar, TypingDots } from "./exec-avatar";
import { Button } from "@/components/ui/button";
import { downloadDecisionPdf } from "@/lib/pdf";

type Props = {
  discussion: BoardDiscussion;
  companyName?: string;
};

const ANALYST: ExecRole = "Business Analyst";

export function DiscussionStream({ discussion, companyName }: Props) {
  const [revealed, setRevealed] = useState(0);
  const [typingRole, setTypingRole] = useState<ExecRole | null>(
    discussion.messages[0]?.role ?? null,
  );
  const [showFinal, setShowFinal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = discussion.messages;

  useEffect(() => {
    if (revealed >= items.length) {
      setTypingRole(ANALYST);
      const t = setTimeout(() => {
        setShowFinal(true);
        setTypingRole(null);
      }, 1600);
      return () => clearTimeout(t);
    }
    const msg = items[revealed];
    setTypingRole(msg.role);
    const chars = msg.bullets.join(" ").length;
    const typingMs = 900 + Math.min(2200, chars * 6);
    const t = setTimeout(() => {
      setRevealed((r) => r + 1);
      const next = items[revealed + 1];
      setTypingRole(next?.role ?? ANALYST);
    }, typingMs);
    return () => clearTimeout(t);
  }, [revealed, items]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [revealed, showFinal, typingRole]);

  const grouped = useMemo(() => {
    const g: Record<number, BoardMessage[]> = { 1: [], 2: [] };
    items.slice(0, revealed).forEach((m) => g[m.round].push(m));
    return g;
  }, [items, revealed]);

  return (
    <div ref={scrollRef} className="max-h-[640px] overflow-y-auto pr-2">
      <RoundLabel n={1} label="Independent analysis" />
      <div className="space-y-3">
        {grouped[1].map((m, i) => (
          <MessageBubble key={`r1-${i}`} message={m} />
        ))}
        {typingRole && revealed < items.length && items[revealed].round === 1 && (
          <TypingRow role={typingRole} />
        )}
      </div>

      {grouped[2].length > 0 || (revealed < items.length && items[revealed].round === 2) ? (
        <>
          <RoundLabel n={2} label="Cross-examination" />
          <div className="space-y-3">
            {grouped[2].map((m, i) => (
              <MessageBubble key={`r2-${i}`} message={m} />
            ))}
            {typingRole && revealed < items.length && items[revealed].round === 2 && (
              <TypingRow role={typingRole} />
            )}
          </div>
        </>
      ) : null}

      {revealed >= items.length && (
        <>
          <RoundLabel n={3} label="Business Analyst's decision" />
          {!showFinal ? (
            <TypingRow role={ANALYST} />
          ) : (
            <FinalDecisionCard discussion={discussion} companyName={companyName} />
          )}
        </>
      )}
    </div>
  );
}

function FinalDecisionCard({ discussion, companyName }: { discussion: BoardDiscussion; companyName?: string }) {
  const d = discussion.decision;
  const e = EXECUTIVES[ANALYST];
  return (
    <div className="panel mt-2 p-5 animate-in fade-in duration-500" style={{ borderColor: "var(--gold)" }}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ExecAvatar role={ANALYST} size={44} />
          <div>
            <div className="font-display text-lg leading-none">{e.name}</div>
            <div className="text-gold text-xs uppercase tracking-widest">
              Business Analyst · Final Decision
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => downloadDecisionPdf(discussion, companyName)}
          className="border-gold/40 text-gold hover:bg-gold/10"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
        </Button>
      </div>

      <h3 className="font-display text-xl">{d.headline}</h3>
      <p className="text-foreground/95 mt-2 text-[15px] leading-relaxed">{d.recommendation}</p>

      <BulletBlock title="Rationale (grounded in the numbers)" items={d.rationale} />
      <BulletBlock title="Expected impact" items={d.impact} />
      <BulletBlock title="Risks & mitigations" items={d.risks} />

      {d.nextActions.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <div className="text-muted-foreground mb-2 text-xs uppercase tracking-widest">Immediate next actions</div>
          <div className="space-y-2.5">
            {d.nextActions.map((a, i) => (
              <div key={i} className="rounded-md border border-border/60 bg-card/50 p-3 text-sm">
                <div className="font-medium">{a.action}</div>
                <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span><span className="uppercase tracking-wider">Owner:</span> {a.owner}</span>
                  <span><span className="uppercase tracking-wider">By:</span> {a.timeline}</span>
                  {a.metric && <span><span className="uppercase tracking-wider">Metric:</span> {a.metric}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BulletBlock({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <div className="text-muted-foreground mb-1.5 text-xs uppercase tracking-widest">{title}</div>
      <ul className="space-y-1.5 text-sm">
        {items.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-gold mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoundLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-3 first:mt-0">
      <div className="text-gold font-display text-xs tracking-[0.3em] uppercase">
        Round {n}
      </div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="from-border h-px flex-1 bg-gradient-to-r to-transparent" />
    </div>
  );
}

function MessageBubble({ message }: { message: BoardMessage }) {
  const e = EXECUTIVES[message.role];
  return (
    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <ExecAvatar role={message.role} />
      <div className="flex-1">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-sm font-semibold">{e.name}</span>
          <span className="text-muted-foreground text-xs">{e.role}</span>
        </div>
        <ul
          className="space-y-1.5 rounded-lg border border-border/60 bg-card/70 px-4 py-2.5 text-[14px] leading-relaxed text-foreground/95"
          style={{ borderLeft: `3px solid ${e.color}` }}
        >
          {message.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                style={{ background: e.color }}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TypingRow({ role }: { role: ExecRole }) {
  const e = EXECUTIVES[role];
  return (
    <div className="flex items-center gap-3">
      <ExecAvatar role={role} />
      <div>
        <div className="text-muted-foreground mb-1 text-xs">
          {e.name} is thinking <TypingDots />
        </div>
      </div>
    </div>
  );
}
