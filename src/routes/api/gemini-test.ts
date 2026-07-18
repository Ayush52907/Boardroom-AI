import { createFileRoute } from "@tanstack/react-router";
import { callGemini } from "@/lib/gemini.server";

/**
 * GET /api/gemini-test
 *
 * Direct test for validation of rate limiter queue and response cache.
 *
 * Query options:
 *   ?mode=rapid   - triggers 5 parallel calls to test rate limiter queue spacing
 *   ?mode=cache   - triggers 3 identical sequential calls to test cache hit behavior
 *   ?prompt=xyz   - customize the prompt test
 *
 * Examples:
 *   curl http://localhost:8080/api/gemini-test?mode=cache
 *   curl http://localhost:8080/api/gemini-test?mode=rapid
 */
export const Route = createFileRoute("/api/gemini-test")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const mode = url.searchParams.get("mode") || "single";
          const prompt = url.searchParams.get("prompt") || "Say: Gemini connection is working.";

          const system = "You are a helpful assistant. Reply in one short sentence.";

          if (mode === "cache") {
            console.log("\n--- CACHE VERIFICATION TEST ---");
            // Call 1: Miss & call
            const r1 = await callGemini({ system, user: prompt });
            // Call 2: Hit cache
            const r2 = await callGemini({ system, user: prompt });
            // Call 3: Hit cache
            const r3 = await callGemini({ system, user: prompt });

            return Response.json({
              ok: true,
              mode: "cache_test",
              responses: [r1, r2, r3],
              note: "Check server console to verify cached status.",
            });
          }

          if (mode === "rapid") {
            console.log("\n--- QUEUE / RATE LIMIT VERIFICATION TEST ---");
            // Simulate 5 parallel calls at the exact same moment.
            // Under RPM limit of e.g. 5, they would space out. Since default is 30,
            // we override it for the test logic or just observe the order.
            const promises = Array.from({ length: 5 }).map((_, i) =>
              callGemini({
                system,
                user: `Count from 1 to 5, this is call number ${i + 1}.`,
              }),
            );

            const responses = await Promise.all(promises);
            return Response.json({
              ok: true,
              mode: "rapid_test",
              responses,
              note: "Check server console for spaced timestamps.",
            });
          }

          // Single default test
          const text = await callGemini({ system, user: prompt });
          return Response.json({ ok: true, response: text });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[gemini-test]", msg);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
    },
  },
});
