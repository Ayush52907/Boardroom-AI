import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/pdf (Deprecated / Inactive)
 *
 * PDF generation has been migrated entirely to the browser client (via native print printHtmlContent)
 * to avoid running heavy Puppeteer/Chromium instances inside Vercel Serverless Functions.
 */
export const Route = createFileRoute("/api/pdf")({
  server: {
    handlers: {
      POST: async () => {
        return Response.json(
          { error: "Endpoint deprecated. PDFs are now generated natively in the browser client." },
          { status: 410 },
        );
      },
    },
  },
});
