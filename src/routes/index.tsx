import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BoardroomBoot } from "@/components/boardroom/boot";
import { Header } from "@/components/boardroom/panels/header";
import { Hero } from "@/components/boardroom/panels/hero";
import { ExecutiveSnapshot } from "@/components/boardroom/panels/executive-snapshot";
import { AskTheBoard } from "@/components/boardroom/panels/ask-the-board";
import { SimulatorPanel } from "@/components/boardroom/panels/simulator-panel";
import { BriefingsPanel } from "@/components/boardroom/panels/briefings-panel";
import { Footer } from "@/components/boardroom/panels/footer";

import {
  DEMO_BUSINESS,
  computeMetrics,
  computePriorities,
  summarizeBusiness,
  type BusinessData,
} from "@/lib/business";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gemma Boardroom — Your AI Executive Team" },
      {
        name: "description",
        content:
          "Gemma Boardroom is an AI Board of Directors for SMEs. Debate strategic decisions with virtual CFOs, COOs, and CEOs, and simulate outcomes before you commit.",
      },
      { property: "og:title", content: "Gemma Boardroom — Your AI Executive Team" },
      {
        property: "og:description",
        content:
          "An AI executive board that analyzes your business, debates the options, and recommends what to do next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardroomPage,
});

const STORAGE_KEY = "gemma.business.v1";

function BoardroomPage() {
  const [booted, setBooted] = useState(false);
  const [business, setBusiness] = useState<BusinessData>(DEMO_BUSINESS);
  const boardRef = useRef<HTMLDivElement>(null);

  // Rehydrate persisted business from localStorage on first mount
  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as BusinessData;
        if (parsed && parsed.companyName) setBusiness(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // All derived values are pure computations — no AI, no network
  const metrics = useMemo(() => computeMetrics(business), [business]);
  const priorities = useMemo(() => computePriorities(business, metrics), [business, metrics]);
  const businessSummary = useMemo(() => summarizeBusiness(business, metrics), [business, metrics]);

  function handleLoadBusiness(b: BusinessData) {
    setBusiness(b);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
    } catch {}
    toast.success(`${b.companyName} loaded. The board is re-briefing.`);
  }

  function handleResetDemo() {
    setBusiness(DEMO_BUSINESS);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    toast.success("Demo company restored.");
  }

  return (
    <div className="bg-boardroom min-h-screen">
      {!booted && <BoardroomBoot onDone={() => setBooted(true)} />}

      <Header
        business={business}
        onLoadBusiness={handleLoadBusiness}
        onResetDemo={handleResetDemo}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <Hero
          business={business}
          onAsk={() => boardRef.current?.scrollIntoView({ behavior: "smooth" })}
        />

        <ExecutiveSnapshot
          business={business}
          metrics={metrics}
          priorities={priorities}
        />

        <div ref={boardRef}>
          <AskTheBoard businessSummary={businessSummary} />
        </div>

        <SimulatorPanel business={business} businessSummary={businessSummary} />

        <BriefingsPanel businessSummary={businessSummary} companyName={business.companyName} />

        <Footer />
      </main>
    </div>
  );
}
