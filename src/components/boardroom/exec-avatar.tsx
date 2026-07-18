import { useState, useEffect } from "react";
import { EXECUTIVES, type ExecRole } from "@/lib/executives";

export function ExecAvatar({ role, size = 40 }: { role: ExecRole; size?: number }) {
  const e = EXECUTIVES[role];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${e.color}, oklch(0.35 0.05 260))`,
        color: "oklch(0.15 0.02 260)",
        fontSize: size * 0.36,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      title={`${e.name} — ${e.role}`}
    >
      {e.initials}
    </div>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </span>
  );
}
function Dot({ delay }: { delay: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setOn((v) => !v), 600);
    const s = setTimeout(() => setOn(true), delay);
    return () => { clearInterval(t); clearTimeout(s); };
  }, [delay]);
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground transition-opacity"
      style={{ opacity: on ? 1 : 0.3 }}
    />
  );
}
