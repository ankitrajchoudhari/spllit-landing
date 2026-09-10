import prisma from '../utils/prisma.js';

/**
 * Counting distinct values without reading the collection.
 *
 * `findMany({ distinct: [field] })` looks like it does this and does not: on
 * MongoDB the deduplication happens in Prisma's query engine, so the whole
 * collection is fetched first and then reduced. Asking "how many people have
 * ever sent a message" that way reads every message ever sent into memory, and
 * the answer is one integer.
 *
 * These helpers push the work into MongoDB with a `$group` + `$count`
 * pipeline, so the result set is one document regardless of collection size.
 *
 * On `$runCommandRaw` here: the objection to raw pipelines is that they let
 * caller input reach the database unvalidated. Nothing in this file takes
 * caller input — collection and field names are constants passed by our own
 * code, and the exported functions accept no request data at all.
 */

/** Shape MongoDB returns from a `cursor`-style aggregate. */
interface AggregateResult {
  cursor?: { firstBatch?: Record<string, unknown>[] };
}

/**
 * How many distinct non-null values a field has.
 *
 * Nulls are excluded deliberately: a collection where half the rows have no
 * `userId` should not report `null` as a participant.
 */
export async function distinctCount(collection: string, field: string): Promise<number> {
  try {
    const result = (await prisma.$runCommandRaw({
      aggregate: collection,
      pipeline: [
        { $match: { [field]: { $ne: null } } },
        { $group: { _id: `$${field}` } },
        { $count: 'n' },
      ],
      cursor: {},
      // Stops a pathological query holding a connection open indefinitely. The
      // caller gets 0 and a logged error rather than a request that never ends.
      maxTimeMS: 15_000,
    })) as AggregateResult;

    const first = result?.cursor?.firstBatch?.[0];
    return typeof first?.n === 'number' ? first.n : 0;
  } catch (error) {
    console.error(`[distinctCount] ${collection}.${field}`, error);
    return 0;
  }
}

/** One collection and the field on it that names a user. */
export interface UserSource {
  collection: string;
  field: string;
}

/**
 * How many distinct users appear across several collections, counted once each.
 *
 * The union has to happen in the database. Fetching each collection's ids and
 * merging them in JS is the thing this module exists to avoid, and it is also
 * wrong to sum the counts — somebody who hosted a ride *and* joined a squad is
 * one person, not two.
 *
 * `$unionWith` needs MongoDB 4.4+, which Atlas has been well past for years.
 */
export async function distinctUsersAcross(sources: UserSource[]): Promise<number> {
  if (sources.length === 0) return 0;

  const [first, ...rest] = sources;
  if (!first) return 0;

  try {
    const result = (await prisma.$runCommandRaw({
      aggregate: first.collection,
      pipeline: [
        { $match: { [first.field]: { $ne: null } } },
        { $group: { _id: `$${first.field}` } },
        ...rest.map((source) => ({
          $unionWith: {
            coll: source.collection,
            pipeline: [
              { $match: { [source.field]: { $ne: null } } },
              { $group: { _id: `$${source.field}` } },
            ],
          },
        })),
        // Second group collapses the unioned streams, so a user present in
        // several of them is counted once.
        { $group: { _id: '$_id' } },
        { $count: 'n' },
      ],
      cursor: {},
      maxTimeMS: 20_000,
    })) as AggregateResult;

    const doc = result?.cursor?.firstBatch?.[0];
    return typeof doc?.n === 'number' ? doc.n : 0;
  } catch (error) {
    console.error('[distinctUsersAcross]', error);
    return 0;
  }
}

/**
 * Daily counts for a collection over a window, grouped by MongoDB.
 *
 * The alternative — fetching every row in range and bucketing in JS — is
 * bounded by the date range but not by the row count, so a year of
 * notifications is millions of documents read to produce at most 365 numbers.
 * This returns one document per day that has data.
 *
 * The date is sent as extended JSON (`{ $date }`) because `$runCommandRaw`
 * serialises to BSON without Prisma's usual type coercion — a bare ISO string
 * would be compared as a string and silently match nothing.
 */
export async function dailyCounts(
  collection: string,
  timeField: string,
  since: Date,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();

  try {
    const result = (await prisma.$runCommandRaw({
      aggregate: collection,
      pipeline: [
        { $match: { [timeField]: { $gte: { $date: since.toISOString() } } } },
        {
          $group: {
            // UTC explicitly, matching MetricRollup and ActiveUserDay. Letting
            // the server's zone decide makes a day boundary move under you.
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: `$${timeField}`, timezone: 'UTC' },
            },
            n: { $sum: 1 },
          },
        },
      ],
      cursor: {},
      maxTimeMS: 20_000,
    })) as AggregateResult;

    for (const row of result?.cursor?.firstBatch ?? []) {
      if (typeof row._id === 'string' && typeof row.n === 'number') out.set(row._id, row.n);
    }
  } catch (error) {
    console.error(`[dailyCounts] ${collection}.${timeField}`, error);
  }

  return out;
}
