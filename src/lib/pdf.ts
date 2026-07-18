import { jsPDF } from "jspdf";
import type { BoardDiscussion } from "@/routes/api/board";
import { EXECUTIVES, type ExecRole } from "@/lib/executives";

type Brief = {
  role: string;
  headline: string;
  bullets: string[];
  keyMetrics?: Array<{ label: string; value: string }>;
};

const GOLD: [number, number, number] = [176, 137, 61];
const INK: [number, number, number] = [22, 24, 34];
const MUTED: [number, number, number] = [110, 110, 120];

function makeDoc() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const page = { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight(), m: 48 };
  return { doc, page };
}

function header(doc: jsPDF, page: { w: number; m: number }, eyebrow: string, title: string, company?: string) {
  doc.setFillColor(...INK); doc.rect(0, 0, page.w, 90, "F");
  doc.setTextColor(...GOLD); doc.setFontSize(9);
  doc.text("GEMMA BOARDROOM · " + eyebrow.toUpperCase(), page.m, 34);
  doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text(title, page.m, 62, { maxWidth: page.w - page.m * 2 });
  if (company) {
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(200, 200, 210);
    doc.text(company, page.m, 78);
  }
  doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
  return 120;
}

function ensure(doc: jsPDF, y: number, need: number, pageH: number, redraw: () => number): number {
  if (y + need > pageH - 48) { doc.addPage(); return redraw(); }
  return y;
}

function heading(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...GOLD);
  doc.text(text.toUpperCase(), x, y);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
  return y + 16;
}

function bullets(doc: jsPDF, items: string[], x: number, y: number, maxW: number, pageH: number, redraw: () => number): number {
  doc.setFontSize(10.5);
  for (const b of items) {
    const lines = doc.splitTextToSize(b, maxW - 14);
    y = ensure(doc, y, lines.length * 14 + 4, pageH, redraw);
    doc.setFillColor(...GOLD); doc.circle(x + 3, y - 3, 1.6, "F");
    doc.setTextColor(...INK);
    doc.text(lines, x + 12, y);
    y += lines.length * 14 + 4;
  }
  return y + 4;
}

function paragraph(doc: jsPDF, text: string, x: number, y: number, maxW: number, pageH: number, redraw: () => number) {
  doc.setFontSize(11); doc.setTextColor(...INK);
  const lines = doc.splitTextToSize(text, maxW);
  y = ensure(doc, y, lines.length * 14, pageH, redraw);
  doc.text(lines, x, y);
  return y + lines.length * 14 + 6;
}

export function downloadDecisionPdf(discussion: BoardDiscussion, company?: string) {
  const { doc, page } = makeDoc();
  const maxW = page.w - page.m * 2;
  const redraw = () => header(doc, page, "Board Decision Report", discussion.decision.headline || "Board Decision", company);
  let y = header(doc, page, "Board Decision Report", discussion.decision.headline || "Board Decision", company);

  doc.setTextColor(...MUTED); doc.setFontSize(9);
  doc.text(`Question: ${discussion.question}`, page.m, y, { maxWidth: maxW }); y += 20;

  y = heading(doc, "Recommendation", page.m, y);
  y = paragraph(doc, discussion.decision.recommendation, page.m, y, maxW, page.h, redraw);

  y = heading(doc, "Rationale", page.m, y);
  y = bullets(doc, discussion.decision.rationale, page.m, y, maxW, page.h, redraw);

  y = heading(doc, "Expected impact", page.m, y);
  y = bullets(doc, discussion.decision.impact, page.m, y, maxW, page.h, redraw);

  y = heading(doc, "Risks & mitigations", page.m, y);
  y = bullets(doc, discussion.decision.risks, page.m, y, maxW, page.h, redraw);

  if (discussion.decision.nextActions.length) {
    y = heading(doc, "Immediate next actions", page.m, y);
    doc.setFontSize(10.5);
    for (const a of discussion.decision.nextActions) {
      const block = `• ${a.action}\n   Owner: ${a.owner}   ·   By: ${a.timeline}${a.metric ? "   ·   Metric: " + a.metric : ""}`;
      const lines = doc.splitTextToSize(block, maxW);
      y = ensure(doc, y, lines.length * 14 + 6, page.h, redraw);
      doc.setTextColor(...INK);
      doc.text(lines, page.m, y);
      y += lines.length * 14 + 6;
    }
  }

  // Board transcript
  doc.addPage(); y = header(doc, page, "Board Transcript", discussion.decision.headline || "Board Decision", company);
  for (const round of [1, 2] as const) {
    y = heading(doc, `Round ${round} · ${round === 1 ? "Independent analysis" : "Cross-examination"}`, page.m, y);
    for (const msg of discussion.messages.filter((m) => m.round === round)) {
      const e = EXECUTIVES[msg.role as ExecRole];
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...INK);
      const label = `${e?.name ?? msg.role} — ${msg.role}`;
      y = ensure(doc, y, 18, page.h, redraw);
      doc.text(label, page.m, y); y += 14;
      doc.setFont("helvetica", "normal");
      y = bullets(doc, msg.bullets, page.m, y, maxW, page.h, redraw);
    }
  }

  doc.save(`boardroom-decision-${slug(discussion.decision.headline || discussion.question)}.pdf`);
}

export function downloadBriefingPdf(brief: Brief, company?: string) {
  const { doc, page } = makeDoc();
  const maxW = page.w - page.m * 2;
  const redraw = () => header(doc, page, `${brief.role} Briefing`, brief.headline, company);
  let y = header(doc, page, `${brief.role} Briefing`, brief.headline, company);

  if (brief.keyMetrics && brief.keyMetrics.length) {
    y = heading(doc, "Key metrics", page.m, y);
    doc.setFontSize(10.5); doc.setTextColor(...INK);
    for (const m of brief.keyMetrics) {
      y = ensure(doc, y, 16, page.h, redraw);
      doc.setTextColor(...MUTED); doc.text(m.label + ":", page.m, y);
      doc.setTextColor(...INK); doc.text(m.value, page.m + 140, y);
      y += 15;
    }
    y += 6;
  }

  y = heading(doc, "Highlights", page.m, y);
  y = bullets(doc, brief.bullets, page.m, y, maxW, page.h, redraw);

  doc.save(`briefing-${brief.role.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "report";
}
