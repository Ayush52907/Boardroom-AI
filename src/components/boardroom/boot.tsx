import { useEffect, useState } from "react";

const STEPS = [
  "Reviewing revenue and margin trends…",
  "Checking cash flow and reserves…",
  "Evaluating supplier performance…",
  "Analyzing inventory turnover…",
  "Auditing outstanding invoices…",
  "Preparing executive recommendations…",
];

export function BoardroomBoot({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= STEPS.length) {
      const t = setTimeout(onDone, 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 550);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <div className="bg-boardroom fixed inset-0 z-50 flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="text-gold font-display text-sm tracking-[0.4em] uppercase">Gemma</div>
        <h1 className="font-display mt-3 text-4xl md:text-5xl text-foreground">
          The Boardroom is Convening
        </h1>
        <div className="gold-divider mx-auto mt-6 w-32" />
      </div>
      <div className="mt-10 w-[min(520px,90vw)] space-y-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className="flex items-center gap-3 text-sm transition-opacity"
            style={{ opacity: i <= step ? 1 : 0.25 }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: i < step ? "var(--gold)" : i === step ? "var(--foreground)" : "var(--muted-foreground)",
                boxShadow: i === step ? "0 0 12px var(--gold)" : "none",
              }}
            />
            <span className="text-muted-foreground">{s}</span>
            {i < step && <span className="text-gold ml-auto text-xs">done</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
