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
 * one becomes a 404 at some point after nobody is watching. `GEMINI_MODEL`
 * overrides this without a deploy, and `listModels()` below exists so the right
 * value can be checked against the account rather than guessed.
 *
 * That check earned its keep immediately: the first default here was
 * `gemini-2.5-flash`, which *listed* fine and then returned 404 on the first
 * real call — "no longer available to new users", with Google naming this model
 * as the replacement. A model appearing in the catalogue does not mean the key
 * may call it.
 *
 * Pinned rather than `gemini-flash-latest`. Each report stores the model that
 * wrote it so successive ones are comparable, and an alias that silently moves
 * underneath makes that field a record of nothing.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';

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
  /**
   * Ceiling for thinking *and* prose together.
   *
   * Gemini 3.x reasons before it writes, and both come out of this one budget.
   * Set it tight and the model spends the lot thinking and returns nothing —
   * measured: a bare "say ok" used 101 thinking tokens, and at a ceiling of 20
   * the reply was empty with finishReason MAX_TOKENS. The default below is
   * generous on purpose; an hourly report is not where tokens are worth saving.
   */
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
      maxOutputTokens: options.maxOutputTokens ?? 2000,
    },
  });

  const text = response.text?.trim();
  const reason = response.candidates?.[0]?.finishReason;

  /**
   * Truncated prose beats no prose.
   *
   * Hitting the ceiling mid-sentence still leaves a report worth reading, and
   * throwing it away to record a failure would lose the only useful thing the
   * call produced.
   */
  if (text) return text;

  /**
   * Empty, though. Worth naming the cause rather than saying "no text": a
   * safety block and a budget spent entirely on thinking look identical from
   * here and send somebody to completely different places.
   */
  if (reason === 'MAX_TOKENS') {
    throw new Error(
      'Gemini spent its whole token budget thinking and produced no text. ' +
        'Raise maxOutputTokens.',
    );
  }

  throw new Error(
    reason ? `Gemini returned no text (finishReason: ${reason}).` : 'Gemini returned no text.',
  );
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
