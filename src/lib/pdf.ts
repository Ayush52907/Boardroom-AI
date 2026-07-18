import type { BoardDiscussion } from "@/routes/api/board";
import { renderBriefingHtml, renderDecisionHtml } from "./pdf-templates";

type Brief = {
  role: string;
  headline: string;
  bullets: string[];
  keyMetrics?: Array<{ label: string; value: string }>;
};

/**
 * Renders HTML into a hidden iframe and triggers native browser printing/PDF generation.
 * This completely bypasses the need for server-side Puppeteer/Chromium, resolving
 * compatibility and function size issues on serverless hosting (like Vercel).
 */
function printHtmlContent(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    // Allow fonts and resources to resolve, then open print dialog
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Print dialog failed:", err);
      } finally {
        // Safe cleanup time
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }
    }, 500);
  }
}

export function downloadDecisionPdf(discussion: BoardDiscussion, company?: string) {
  const html = renderDecisionHtml(discussion, company);
  printHtmlContent(html);
}

export function downloadBriefingPdf(brief: Brief, company?: string) {
  const html = renderBriefingHtml(brief, company);
  printHtmlContent(html);
}
