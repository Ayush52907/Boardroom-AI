import type { BoardDiscussion } from "@/routes/api/board";

type Brief = {
  role: string;
  headline: string;
  bullets: string[];
  keyMetrics?: Array<{ label: string; value: string }>;
};

async function postToPdfApi(payload: any, defaultFilename: string) {
  try {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(errText || `Server returned status ${res.status}`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("PDF generation failed:", error);
    alert("Failed to generate PDF. Please try again.");
  }
}

export function downloadDecisionPdf(discussion: BoardDiscussion, company?: string) {
  const filename = `boardroom-decision-${slug(discussion.decision.headline || discussion.question)}.pdf`;
  postToPdfApi({ type: "decision", discussion, companyName: company }, filename);
}

export function downloadBriefingPdf(brief: Brief, company?: string) {
  const filename = `briefing-${brief.role.toLowerCase().replace(/\s+/g, "-")}.pdf`;
  postToPdfApi({ type: "briefing", brief, companyName: company }, filename);
}

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "report"
  );
}
