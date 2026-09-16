/**
 * Confirm the Gemini key works and the configured model exists.
 *
 *   npx tsx src/scripts/gemini-check.ts
 *
 * Exists because GEMINI_MODEL is a guess until something checks it against the
 * account. Model names are retired, and the failure mode without this is a 404
 * inside a scheduled report at 3am rather than a clear message now.
 */
import 'dotenv/config';
import { GEMINI_MODEL, generateText, isGeminiConfigured, listModels } from '../services/gemini.js';

if (!isGeminiConfigured()) {
  console.error('GEMINI_API_KEY is not set in backend/.env — nothing to check.');
  process.exit(1);
}

console.log(`configured model: ${GEMINI_MODEL}\n`);

const models = await listModels();
const usable = models.filter((m) => m.startsWith('gemini-'));
console.log(`models this key can use (${usable.length}):`);
for (const m of usable) console.log(`  ${m === GEMINI_MODEL ? '->' : '  '} ${m}`);

if (!usable.includes(GEMINI_MODEL)) {
  console.error(`\nFAIL: "${GEMINI_MODEL}" is not in that list. Set GEMINI_MODEL to one that is.`);
  process.exit(1);
}

console.log('\nmodel exists. sending a test prompt…');
const text = await generateText({
  system: 'Reply with exactly the word: ok',
  user: 'Say ok.',
  // Not 20. Gemini 3.x reasons out of this same budget, so a tight ceiling
  // fails the check on a key and model that are both perfectly fine.
  maxOutputTokens: 500,
});
console.log(`reply: ${text}`);
console.log('\nGemini is working.');
