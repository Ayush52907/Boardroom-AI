import { createFileRoute } from "@tanstack/react-router";
import puppeteer from "puppeteer";
import { z } from "zod";

const ReqDecision = z.object({
  type: z.literal("decision"),
  companyName: z.string().optional(),
  discussion: z.object({
    question: z.string(),
    participants: z.array(z.string()),
    messages: z.array(
      z.object({
        round: z.union([z.literal(1), z.literal(2)]),
        role: z.string(),
        bullets: z.array(z.string()),
      }),
    ),
    decision: z.object({
      headline: z.string(),
      recommendation: z.string(),
      rationale: z.array(z.string()),
      impact: z.array(z.string()),
      risks: z.array(z.string()),
      nextActions: z.array(
        z.object({
          action: z.string(),
          owner: z.string(),
          timeline: z.string(),
          metric: z.string().optional(),
        }),
      ),
    }),
  }),
});

const ReqBriefing = z.object({
  type: z.literal("briefing"),
  companyName: z.string().optional(),
  brief: z.object({
    role: z.string(),
    headline: z.string(),
    bullets: z.array(z.string()),
    keyMetrics: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        }),
      )
      .optional(),
  }),
});

const Req = z.discriminatedUnion("type", [ReqDecision, ReqBriefing]);

const EXECUTIVE_STYLES: Record<string, { initials: string; color: string; name: string }> = {
  CFO: { initials: "PM", color: "#b0893d", name: "Priya Menon" },
  COO: { initials: "RI", color: "#38a169", name: "Rohan Iyer" },
  CMO: { initials: "AK", color: "#319795", name: "Arjun Kapoor" },
  CTO: { initials: "AD", color: "#3182ce", name: "Ananya Deshpande" },
  "Procurement Officer": { initials: "NS", color: "#805ad5", name: "Neha Sharma" },
  "Business Analyst": { initials: "VR", color: "#b0893d", name: "Vikram Rao" },
};

function getExecStyle(role: string) {
  return (
    EXECUTIVE_STYLES[role] || {
      initials: role.slice(0, 2).toUpperCase(),
      color: "#6b7280",
      name: role,
    }
  );
}

export const Route = createFileRoute("/api/pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = Req.parse(body);

          let html = "";
          if (parsed.type === "briefing") {
            html = renderBriefingHtml(parsed.brief, parsed.companyName);
          } else {
            html = renderDecisionHtml(parsed.discussion, parsed.companyName);
          }

          const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          });
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: "networkidle0" as any });
          const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
              top: "20mm",
              bottom: "20mm",
              left: "15mm",
              right: "15mm",
            },
          });
          await browser.close();

          return new Response(pdfBuffer as any, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="report.pdf"`,
            },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("PDF generation error:", msg);
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

function renderBriefingHtml(brief: any, companyName?: string): string {
  const companyStr = companyName ? `<div class="company">${escapeHtml(companyName)}</div>` : "";

  let metricsHtml = "";
  if (brief.keyMetrics && brief.keyMetrics.length > 0) {
    metricsHtml = `
      <div class="section-card">
        <div class="eyebrow" style="margin-bottom: 12px;">Key Metrics</div>
        <div class="metrics-grid">
          ${brief.keyMetrics
            .map(
              (m: any) => `
            <div class="metric-card">
              <div class="metric-label">${escapeHtml(m.label)}</div>
              <div class="metric-value">${escapeHtml(m.value)}</div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  const bulletsHtml = brief.bullets
    .map(
      (b: string) => `
    <li class="bullet-item">
      <span class="bullet-dot"></span>
      <span>${escapeHtml(b)}</span>
    </li>
  `,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(brief.role)} Briefing</title>
        <style>
          ${getCommonStyles()}
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }
          .metric-card {
            border: 1px solid #e5e7eb;
            background: #fafafa;
            border-radius: 6px;
            padding: 10px 12px;
          }
          .metric-label {
            font-size: 8pt;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #6b7280;
            margin-bottom: 4px;
          }
          .metric-value {
            font-family: 'Fraunces', serif;
            font-size: 14pt;
            font-weight: 700;
            color: #111827;
          }
          @media (max-width: 600px) {
            .metrics-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <div class="eyebrow">${escapeHtml(brief.role)} BRIEF · PREPARED BY GEMMA</div>
          <h1>${escapeHtml(brief.headline)}</h1>
          ${companyStr}
        </div>

        ${metricsHtml}

        <div class="section-card">
          <div class="eyebrow" style="margin-bottom: 16px;">Highlights</div>
          <ul class="bullet-list">
            ${bulletsHtml}
          </ul>
        </div>
      </body>
    </html>
  `;
}

function renderDecisionHtml(discussion: any, companyName?: string): string {
  const companyStr = companyName ? `<div class="company">${escapeHtml(companyName)}</div>` : "";
  const d = discussion.decision;

  const nextActionsHtml =
    d.nextActions && d.nextActions.length > 0
      ? `
      <div class="section-card">
        <div class="eyebrow" style="margin-bottom: 12px;">Immediate Next Actions</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          ${d.nextActions
            .map(
              (a: any) => `
            <div class="next-action-card">
              <div class="next-action-title">${escapeHtml(a.action)}</div>
              <div class="next-action-details">
                <div class="next-action-detail-item"><span>Owner:</span> ${escapeHtml(a.owner)}</div>
                <div class="next-action-detail-item"><span>By:</span> ${escapeHtml(a.timeline)}</div>
                ${a.metric ? `<div class="next-action-detail-item"><span>Metric:</span> ${escapeHtml(a.metric)}</div>` : ""}
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
      : "";

  // Grouped transcripts
  let transcriptHtml = "";
  for (const round of [1, 2] as const) {
    const roundMessages = discussion.messages.filter((m: any) => m.round === round);
    if (roundMessages.length === 0) continue;

    transcriptHtml += `
      <div style="page-break-before: auto; break-inside: avoid; margin-top: 24px;">
        <div class="eyebrow" style="margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
          Round ${round} · ${round === 1 ? "Independent Analysis" : "Cross-Examination"}
        </div>
        ${roundMessages
          .map((m: any) => {
            const style = getExecStyle(m.role);
            return `
            <div class="message-bubble">
              <div class="avatar-placeholder" style="background-color: ${style.color};">
                ${escapeHtml(style.initials)}
              </div>
              <div class="message-content">
                <div class="message-header">
                  <span class="message-name">${escapeHtml(style.name)}</span>
                  <span class="message-role">${escapeHtml(m.role)}</span>
                </div>
                <div class="message-bullets-box" style="border-left: 3px solid ${style.color};">
                  <ul class="bullet-list">
                    ${m.bullets
                      .map(
                        (b: string) => `
                      <li class="bullet-item" style="margin-bottom: 6px;">
                        <span class="bullet-dot" style="background-color: ${style.color};"></span>
                        <span>${escapeHtml(b)}</span>
                      </li>
                    `,
                      )
                      .join("")}
                  </ul>
                </div>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Board Decision Report</title>
        <style>
          ${getCommonStyles()}
          .recommendation-box {
            border-left: 4px solid #b0893d;
            padding-left: 16px;
            margin: 16px 0;
            font-size: 11pt;
            font-style: italic;
            color: #111827;
            line-height: 1.6;
          }
          @media (max-width: 600px) {
            .section-card > div[style*="grid-template-columns"] {
              grid-template-columns: 1fr !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <div class="eyebrow">BOARD DECISION REPORT</div>
          <h1>${escapeHtml(d.headline || "Board Decision")}</h1>
          ${companyStr}
        </div>

        <div style="font-size: 9pt; color: #6b7280; margin-bottom: 24px; font-style: italic; break-inside: avoid;">
          <strong>Question:</strong> ${escapeHtml(discussion.question)}
        </div>

        <div class="section-card">
          <div class="eyebrow">Recommendation</div>
          <div class="recommendation-box">
            ${escapeHtml(d.recommendation)}
          </div>
        </div>

        <div class="section-card">
          <div class="eyebrow" style="margin-bottom: 12px;">Rationale</div>
          <ul class="bullet-list">
            ${d.rationale
              .map(
                (b: string) => `
              <li class="bullet-item">
                <span class="bullet-dot"></span>
                <span>${escapeHtml(b)}</span>
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>

        <div class="section-card">
          <div class="eyebrow" style="margin-bottom: 12px;">Expected Impact</div>
          <ul class="bullet-list">
            ${d.impact
              .map(
                (b: string) => `
              <li class="bullet-item">
                <span class="bullet-dot"></span>
                <span>${escapeHtml(b)}</span>
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>

        <div class="section-card">
          <div class="eyebrow" style="margin-bottom: 12px;">Risks & Mitigations</div>
          <ul class="bullet-list">
            ${d.risks
              .map(
                (b: string) => `
              <li class="bullet-item">
                <span class="bullet-dot"></span>
                <span>${escapeHtml(b)}</span>
              </li>
            `,
              )
              .join("")}
            </ul>
        </div>

        ${nextActionsHtml}

        <div style="page-break-before: always; break-before: page;"></div>

        <div class="header-banner">
          <div class="eyebrow">BOARD DECISION REPORT · TRANSCRIPT</div>
          <h1>Board Debate Transcript</h1>
          ${companyStr}
        </div>

        ${transcriptHtml}
      </body>
    </html>
  `;
}

function getCommonStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,700&family=Inter:wght@300;400;500;600;700&display=swap');
    
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }
    
    body {
      background-color: #ffffff;
      color: #1f2937;
      font-family: 'Inter', sans-serif;
      font-size: 10.5pt;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    
    h1, h2, h3, h4 {
      font-family: 'Fraunces', serif;
      color: #111827;
      margin-top: 0;
    }
    
    .eyebrow {
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.1em;
      color: #b0893d;
      font-family: 'Inter', sans-serif;
      font-weight: 600;
    }
    
    .header-banner {
      background-color: #0e1118;
      color: #ffffff;
      padding: 24px 30px;
      border-radius: 8px;
      margin-bottom: 24px;
      break-inside: avoid;
    }
    
    .header-banner .eyebrow {
      color: #c5a880;
      margin-bottom: 8px;
    }
    
    .header-banner h1 {
      color: #ffffff;
      font-size: 20pt;
      margin: 0;
      font-weight: 700;
      line-height: 1.25;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .header-banner .company {
      color: #9ca3af;
      font-size: 9pt;
      margin-top: 8px;
      font-weight: 500;
    }
    
    .section-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .bullet-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .bullet-item {
      display: flex;
      align-items: start;
      margin-bottom: 8px;
      font-size: 10.5pt;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .bullet-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background-color: #b0893d;
      margin-top: 7px;
      margin-right: 10px;
      flex-shrink: 0;
    }
    
    .next-action-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      background: #fafafa;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .next-action-title {
      font-weight: 600;
      color: #111827;
      margin-bottom: 6px;
      font-size: 10pt;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    .next-action-details {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 8.5pt;
      color: #6b7280;
    }
    
    .next-action-detail-item span {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 7.5pt;
      letter-spacing: 0.05em;
      color: #9ca3af;
    }
    
    .message-bubble {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    
    .avatar-placeholder {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #ffffff;
      font-size: 9.5pt;
      flex-shrink: 0;
      font-family: 'Inter', sans-serif;
    }
    
    .message-content {
      flex-grow: 1;
    }
    
    .message-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 6px;
    }
    
    .message-name {
      font-weight: 600;
      font-size: 10pt;
      color: #111827;
    }
    
    .message-role {
      font-size: 8.5pt;
      color: #6b7280;
      text-transform: uppercase;
      font-weight: 500;
      letter-spacing: 0.03em;
    }
    
    .message-bullets-box {
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background: #ffffff;
      padding: 12px 16px;
    }
  `;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
