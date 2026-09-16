import { GoogleGenAI } from '@google/genai';

/**
 * Google Gemini, for the places Spllit asks a model to write prose.
 *
 * One module rather than a client per caller, so switching model or provider
 * again is one file. `services/sarvam.ts` is deliberately untouched: it uses
 * the OpenAI *client* to reach Sarvam's OpenAI-compatible endpoint, which is a
 * different provider doing a different job, and rewriting it here would swap a
 * vendor nobody asked to change.
 *
 * ## Key, not project
 *
 * This uses a Gemini API key (AI Studio), not Vertex AI. Vertex would need a
 * GCP project, a service account and a region, and would tie report generation
 * to the same IAM surface as the database. A single key in Secret Manager is
 * the smaller thing to get right, and it is what `GEMINI_API_KEY` is.
 */

/**
 * The model, overridable without a deploy.
 *
 * Gemini's model names move faster than this codebase does, and a hardcoded
 * one becomes a 404 at some point after nobody is watching. The default is the
 * current fast tier; `GEMINI_MODEL` overrides it, and `listModels()` below
 * exists so the right value can be checked against the account rather than
 * guessed from documentation.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

let client: GoogleGenAI | null = null;

const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';
if (apiKey) {
  client = new GoogleGenAI({ apiKey });
}

export function isGeminiConfigured(): boolean {
  return client !== null;
}

export interface GenerateOptions {
  /** Steering that is not part of the user's request. */
  system: string;
  /** The request itself. */
  user: string;
  /**
   * Extra context placed before the request — previous reports, and anything
   * else the model should continue from rather than treat as an instruction.
   */
  context?: string[];
  /** Low for reports: the same figures should produce the same account twice. */
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * One call, returning the text or throwing with something actionable.
 *
 * Errors are deliberately not swallowed here. The caller decides what a failure
 * means — `aiReports` records it as a failed report so it is visible in the
 * list, and a helper that returned an empty string would make that impossible
 * to tell from a model that had nothing to say.
 */
export async function generateText(options: GenerateOptions): Promise<string> {
  if (!client) {
    throw new Error('GEMINI_API_KEY is not set, so nothing can be generated.');
  }

  const parts = [
    ...(options.context ?? []).map((text) => ({ text })),
    { text: options.user },
  ];

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      // Gemini keeps the system prompt out of the conversation rather than as a
      // first message, which is what stops a long context burying it.
      systemInstruction: options.system,
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxOutputTokens ?? 800,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    /**
     * An empty response is usually a safety block or a token ceiling hit
     * before the first sentence, and both are worth saying out loud — "the
     * model returned nothing" sends somebody looking at the wrong thing.
     */
    const reason = response.candidates?.[0]?.finishReason;
    throw new Error(
      reason
        ? `Gemini returned no text (finishReason: ${reason}).`
        : 'Gemini returned no text.',
    );
  }

  return text;
}

/**
 * Model names the key can actually use.
 *
 * Exists because the default above is a guess until something checks it. Run
 * it against the live key to confirm the configured model exists rather than
 * discovering it in a failed report at 3am.
 */
export async function listModels(): Promise<string[]> {
  if (!client) throw new Error('GEMINI_API_KEY is not set.');

  const names: string[] = [];
  const pager = await client.models.list();

  for await (const model of pager) {
    if (model.name) names.push(model.name.replace(/^models\//, ''));
  }

  return names.sort();
}
