import { GoogleGenAI } from "@google/genai";

/**
 * Server-only: Gemini API client via the official @google/genai SDK.
 *
 * GEMINI_API_KEY must be set in .env.local (not VITE_ prefixed — never expose
 * this to the browser bundle).
 *
 * Get your key from: https://aistudio.google.com/app/apikey
 */

function getGeminiClient(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "Missing GEMINI_API_KEY. Set it in .env.local — get one at https://aistudio.google.com/app/apikey",
    );
  }
  return new GoogleGenAI({ apiKey: key });
}

// Lazy singleton — only instantiated on first call, not at module load time.
let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) _client = getGeminiClient();
  return _client;
}

export type GeminiCallOpts = {
  /** The system instruction (role + constraints). */
  system: string;
  /** The user-facing prompt (business data, question, etc). */
  user: string;
  /**
   * When true, instructs the model to respond with a JSON object.
   * Parse the returned string with JSON.parse().
   */
  json?: boolean;
  /** Gemini model to use. Defaults to gemma-4-31b-it. */
  model?: string;
};

// ---------------------------------------------------------------------------
// Rate Limiter & Response Cache (Dev Safety)
// ---------------------------------------------------------------------------

// Simple in-memory response cache
const responseCache = new Map<string, string>();

// Track timestamps of actual API calls within the sliding window
const requestTimestamps: number[] = [];

// Lock/semaphore to ensure queue execution is processed strictly in order
let queuePromise = Promise.resolve();

function getCachedResponseKey(opts: GeminiCallOpts, modelId: string): string {
  return JSON.stringify({
    system: opts.system,
    user: opts.user,
    json: opts.json,
    model: modelId,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enforces rate limit by spacing out requests if the sliding window is full.
 */
async function enforceRateLimit() {
  const limitRPM = parseInt(process.env.GEMINI_MAX_RPM || "30", 10);
  const windowMs = 60000;

  while (true) {
    const now = Date.now();
    // Remove timestamps older than the sliding window
    while (requestTimestamps.length > 0 && requestTimestamps[0] <= now - windowMs) {
      requestTimestamps.shift();
    }

    if (requestTimestamps.length < limitRPM) {
      // Under limit, we can proceed
      requestTimestamps.push(now);
      break;
    }

    // Window is full, wait for the oldest request to exit the sliding window
    const oldestTimestamp = requestTimestamps[0];
    const waitTime = oldestTimestamp + windowMs - now + 50; // Add 50ms buffer
    console.log(`[Gemini Queue] Rate limit reached. Queueing request... Waiting ${waitTime}ms`);
    await delay(waitTime);
  }
}

/**
 * Direct Gemini API call wrapper with retries and exponential backoff.
 */
async function executeApiCallWithRetries(
  modelId: string,
  systemInstruction: string,
  userPrompt: string,
  json?: boolean,
  attempt: number = 1,
): Promise<string> {
  try {
    const response = await client().models.generateContent({
      model: modelId,
      contents: userPrompt,
      config: {
        systemInstruction,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    });

    return response.text ?? "";
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isRateLimit =
      errorMsg.includes("429") ||
      errorMsg.includes("RESOURCE_EXHAUSTED") ||
      errorMsg.includes("503") ||
      errorMsg.includes("overloaded");

    if (isRateLimit && attempt <= 3) {
      const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.warn(
        `[Gemini Retry] Rate limited or overloaded (Attempt ${attempt}/3). Retrying in ${waitTime}ms... Error: ${errorMsg}`,
      );
      await delay(waitTime);
      return executeApiCallWithRetries(modelId, systemInstruction, userPrompt, json, attempt + 1);
    }

    if (isRateLimit) {
      throw new Error(
        `Gemini rate limit exceeded after ${attempt - 1} retries. Please wait a moment and try again.`,
      );
    }

    throw error;
  }
}

/**
 * Makes a single-turn Gemini API call and returns the text response.
 * Handles dev-only response caching and strict sliding-window rate limiting.
 */
export async function callGemini(opts: GeminiCallOpts): Promise<string> {
  const modelId = opts.model ?? "gemma-4-31b-it";
  const cacheKey = getCachedResponseKey(opts, modelId);

  // Check cache first (Dev safety check)
  if (responseCache.has(cacheKey)) {
    console.log(`[Gemini Cache] Hit! Returning cached response for prompt.`);
    return responseCache.get(cacheKey)!;
  }

  // Enqueue the request to run sequentially through the rate limiter
  return new Promise((resolve, reject) => {
    queuePromise = queuePromise
      .then(async () => {
        await enforceRateLimit();
        const systemInstruction = opts.system;
        const userPrompt = opts.json
          ? `${opts.user}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences, no prose.`
          : opts.user;

        const result = await executeApiCallWithRetries(
          modelId,
          systemInstruction,
          userPrompt,
          opts.json,
        );

        // Store in cache
        responseCache.set(cacheKey, result);
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

/**
 * Standalone smoke-test: sends a minimal prompt to Gemini and returns the response.
 * Used by the /api/gemini-test endpoint to confirm the key works end-to-end.
 */
export async function smokeTestGemini(): Promise<string> {
  return callGemini({
    system: "You are a helpful assistant. Reply in one sentence.",
    user: "Say: Gemini connection is working.",
  });
}
