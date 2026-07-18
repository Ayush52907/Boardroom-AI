import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EXECUTIVES, type ExecRole } from "@/lib/executives";
import { ExecAvatar } from "@/components/boardroom/exec-avatar";
import type { BusinessData } from "@/lib/business";

interface HeroProps {
  business: BusinessData;
  onAsk: () => void;
}

export function Hero({ business, onAsk }: HeroProps) {
  return (
    <section className="mb-12 mt-4 text-center md:mt-8">
      <div className="text-muted-foreground mb-4 inline-flex items-center gap-1.5 text-xs lowercase">
        <Sparkles className="h-3.5 w-3.5 text-black" />
        your executive board is ready
      </div>
      <h1 className="font-display text-4xl font-semibold tracking-tight leading-tight md:text-5xl text-black lowercase">
        every sme deserves its own{" "}
        <span className="italic font-bold underline decoration-[1.5px] underline-offset-6">board of directors.</span>
      </h1>
      <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base md:text-lg leading-relaxed lowercase">
        gemma's ai executives have already reviewed{" "}
        <span className="text-black font-semibold">{business.companyName}</span>. they've debated the
        numbers and are ready to recommend what to do next.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={onAsk} className="bg-gold text-gold-foreground hover:opacity-90">
          Ask the Board <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5">
          {(Object.values(EXECUTIVES) as Array<{ role: ExecRole; name: string }>).map((e) => (
            <div key={e.role} title={`${e.name} — ${e.role}`}>
              <ExecAvatar role={e.role} size={32} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
