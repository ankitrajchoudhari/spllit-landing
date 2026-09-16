import OpenAI from 'openai';

import prisma from '../utils/prisma.js';
import { activeUsers, activationFunnel, featureAdoption, retention } from './analytics.js';
import { readCounters } from './adminEvents.js';
import { emitToAdmins } from './adminSocket.js';

/**
 * AI-written reports on how Spllit is doing.
 *
 * The model is given aggregates, never rows. It sees "27 signups this week, 34
 * active users, D7 retention 12%" — not a list of people. That is a privacy
 * property worth stating: nothing identifying is sent to OpenAI, so a report
 * cannot leak a user even if the prompt is mishandled at the other end.
 *
 * Every generated report stores the aggregates it was given. Without them a
 * report is an assertion nobody can check, and the first time one says
 * something surprising the only useful question — "what did it actually see?" —
 * has no answer.
 */

/** Windows a report may cover, and how many days each spans. */
export const REPORT_WINDOWS = { '1h': 1, '24h': 1, '7d': 7 } as const;
export type ReportWindow = keyof typeof REPORT_WINDOWS;

export function isReportWindow(value: unknown): value is ReportWindow {
  return typeof value === 'string' && value in REPORT_WINDOWS;
}

const MODEL = 'gpt-4o-mini';

let client: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function isReportingConfigured(): boolean {
  return client !== null;
}

/**
 * The figures a report is written from.
 *
 * Deliberately the same functions the Insights page calls, rather than a second
 * set of queries written for the model. Two ways of counting the same thing
 * drift, and the day they disagree the report and the dashboard both look
 * wrong with no way to tell which is.
 */
async function gather(window: ReportWindow) {
  const days = REPORT_WINDOWS[window];
  const since = new Date(Date.now() - days * 86_400_000);

  const [active, funnel, adoption, counters, cohorts, signups, rides, squads] = await Promise.all([
    activeUsers(Math.max(days, 7)),
    activationFunnel(),
    featureAdoption(),
    readCounters(),
    retention(7),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.ride.count({ where: { createdAt: { gte: since } } }),
    prisma.squad.count({ where: { createdAt: { gte: since } } }),
  ]);

  // The window before this one, so the model can say "up from" rather than
  // inventing a trend from a single number.
  const previousSince = new Date(Date.now() - days * 2 * 86_400_000);
  const [prevSignups, prevRides, prevSquads] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
    prisma.ride.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
    prisma.squad.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
  ]);

  return {
    window,
    generatedAt: new Date().toISOString(),
    thisPeriod: { signups, rides, squads },
    previousPeriod: { signups: prevSignups, rides: prevRides, squads: prevSquads },
    activeUsers: { dau: active.dau, wau: active.wau, mau: active.mau, stickiness: active.stickiness },
    dailyActive: active.series,
    retention: cohorts,
    funnel,
    adoption: adoption.rows,
    lifetimeCounters: counters,
  };
}

const SYSTEM_PROMPT = `You write short operational reports for the founder of Spllit, a campus ride-sharing and meet-up app used at IIT Madras.

You are given aggregate figures only — never individual users.

Write 150–250 words of plain prose. No headings, no bullet lists, no markdown.

Cover, in this order and only where the data supports it:
- what changed against the previous period, with the numbers
- where people are dropping off, and which step loses most
- anything anomalous, said plainly
- one thing worth doing next

Rules you must follow:
- Never invent a number. If a figure is absent or zero, say so or omit it.
- A small sample is a small sample. With fewer than ~30 users in a window, say the numbers are too small to read a trend into rather than describing one.
- Retention marked null means the cohort has not reached that day yet. Never report it as 0%.
- Do not congratulate or apologise. State what happened.
- If previous reports are supplied, continue the account — note what has changed since, and do not repeat their wording.`;

/** Everything needed to write one report, generated and stored. */
export async function generateReport(options: {
  window: ReportWindow;
  trigger: 'schedule' | 'manual';
  actorEmail?: string | null;
}): Promise<{ id: string; headline: string; body: string; error: string | null }> {
  const inputs = await gather(options.window);

  /**
   * Previous reports as context, so successive ones read as a continuing
   * account rather than the same paragraph rewritten hourly.
   *
   * Only successful ones: feeding a failure back in would have the model
   * explaining an error message as though it were a finding.
   */
  const previous = await prisma.report.findMany({
    where: { window: options.window, error: null },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { createdAt: true, body: true },
  });

  const write = async (): Promise<string> => {
    if (!client) {
      throw new Error('OPENAI_API_KEY is not set, so reports cannot be generated.');
    }

    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(previous.length > 0
          ? [
              {
                role: 'system' as const,
                content: `Previous reports, newest first:\n\n${previous
                  .map((r) => `[${r.createdAt.toISOString()}]\n${r.body}`)
                  .join('\n\n---\n\n')}`,
              },
            ]
          : []),
        {
          role: 'user',
          content: `Figures for the last ${options.window}:\n\n${JSON.stringify(inputs, null, 2)}`,
        },
      ],
      // Low, because this is a report and not a piece of writing. The same
      // figures should produce roughly the same account twice.
      temperature: 0.3,
      max_tokens: 600,
    });

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('The model returned an empty report.');
    return text;
  };

  let body = '';
  let error: string | null = null;

  try {
    body = await write();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    body = '';
  }

  /**
   * The row is written either way.
   *
   * A report that failed to generate is something to see in the list, not to
   * discover by its absence — silence looks identical to "nothing happened",
   * and an hourly job that quietly stopped working is exactly what this avoids.
   */
  const headline = error
    ? 'Report could not be generated'
    : (body.split(/(?<=[.!?])\s/)[0] ?? body.slice(0, 120)).slice(0, 160);

  const saved = await prisma.report.create({
    data: {
      window: options.window,
      body,
      headline,
      inputs: inputs as never,
      model: MODEL,
      trigger: options.trigger,
      actorEmail: options.actorEmail ?? null,
      error,
    },
    select: { id: true },
  });

  // Tell any open console straight away, so a manual run does not need the
  // list refetching to show its result.
  emitToAdmins('report', {
    id: saved.id,
    window: options.window,
    headline,
    trigger: options.trigger,
    failed: error !== null,
    createdAt: new Date().toISOString(),
  });

  return { id: saved.id, headline, body, error };
}
