import { callGemini, type GeminiCallOpts } from "./gemini.server";

/**
 * Server-only: Compatibility bridge delegating calls to callGemini.
 */
export async function callLovableAI(opts: GeminiCallOpts): Promise<string> {
  return callGemini(opts);
}
