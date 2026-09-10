import prisma from '../utils/prisma.js';

/**
 * The founder data explorer's query layer.
 *
 * The rule the whole file exists to enforce: **the browser never sends a
 * query.** It sends the *name* of a dataset, the *name* of a dimension and a
 * date range, and everything else is looked up here. A client that could pass a
 * `where` clause or a field name straight through to Prisma is one arbitrary
 * `$where` away from reading anything in the database — and the console is the
 * one surface where the caller is, by definition, already trusted enough to be
 * worth attacking.
 *
 * Adding a dataset means adding an entry to SCHEMA. It is deliberately not
 * derived from the Prisma schema by reflection: a new model or a new field
 * should not become queryable, exportable and chartable just by existing.
 */

/** A field that can be grouped on, and how it should be labelled. */
interface Dimension {
  key: string;
  label: string;
  /** `time` buckets by day; `category` groups on the field's own values. */
  kind: 'time' | 'category';
}

interface DatasetSpec {
  key: string;
  label: string;
  /** Permission required to explore it, matching the console's matrix. */
  permission: string;
  /** Field the date range filters on. */
  timeField: string;
  dimensions: Dimension[];
  /** Prisma delegate. Narrow signature — only what this file calls. */
  model: () => {
    count: (args?: unknown) => Promise<number>;
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    groupBy: (args: unknown) => Promise<Record<string, unknown>[]>;
  };
}

const TIME: Dimension = { key: '__day', label: 'Day', kind: 'time' };

export const SCHEMA: DatasetSpec[] = [
  {
    key: 'users',
    label: 'Users',
    permission: 'analytics.view',
    timeField: 'createdAt',
    dimensions: [
      TIME,
      { key: 'college', label: 'College', kind: 'category' },
      { key: 'gender', label: 'Gender', kind: 'category' },
      { key: 'onboarded', label: 'Onboarded', kind: 'category' },
      { key: 'isActive', label: 'Active', kind: 'category' },
    ],
    model: () => prisma.user as never,
  },
  {
    key: 'rides',
    label: 'Rides',
    permission: 'analytics.view',
    timeField: 'createdAt',
    dimensions: [
      TIME,
      { key: 'status', label: 'Status', kind: 'category' },
      { key: 'vehicleType', label: 'Vehicle', kind: 'category' },
      { key: 'genderPref', label: 'Gender preference', kind: 'category' },
      { key: 'destination', label: 'Destination', kind: 'category' },
    ],
    model: () => prisma.ride as never,
  },
  {
    key: 'squads',
    label: 'Squads',
    permission: 'analytics.view',
    timeField: 'createdAt',
    dimensions: [
      TIME,
      { key: 'status', label: 'Status', kind: 'category' },
      { key: 'type', label: 'Purpose', kind: 'category' },
      { key: 'visibility', label: 'Visibility', kind: 'category' },
      { key: 'college', label: 'College', kind: 'category' },
    ],
    model: () => prisma.squad as never,
  },
  {
    key: 'events',
    label: 'Events',
    permission: 'analytics.view',
    timeField: 'createdAt',
    dimensions: [
      TIME,
      { key: 'status', label: 'Status', kind: 'category' },
      { key: 'category', label: 'Category', kind: 'category' },
      { key: 'ticketType', label: 'Ticket', kind: 'category' },
      { key: 'college', label: 'College', kind: 'category' },
    ],
    model: () => prisma.event as never,
  },
  {
    key: 'communities',
    label: 'Communities',
    permission: 'analytics.view',
    timeField: 'createdAt',
    dimensions: [
      TIME,
      { key: 'visibility', label: 'Visibility', kind: 'category' },
      { key: 'college', label: 'College', kind: 'category' },
    ],
    model: () => prisma.community as never,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    permission: 'analytics.view',
    timeField: 'createdAt',
    dimensions: [TIME, { key: 'type', label: 'Type', kind: 'category' }],
    model: () => prisma.notification as never,
  },
  {
    key: 'audit',
    label: 'Audit log',
    // Not analytics.view. Audit rows name individual admins and what they did,
    // so exploring them is an audit capability rather than an analytics one.
    permission: 'audit.view',
    timeField: 'createdAt',
    dimensions: [
      TIME,
      { key: 'action', label: 'Action', kind: 'category' },
      { key: 'actorEmail', label: 'Admin', kind: 'category' },
      { key: 'targetType', label: 'Target type', kind: 'category' },
      { key: 'success', label: 'Succeeded', kind: 'category' },
    ],
    model: () => prisma.auditLog as never,
  },
];

export function datasetFor(key: string): DatasetSpec | undefined {
  return SCHEMA.find((spec) => spec.key === key);
}

/** What the client renders its builder from. No Prisma detail leaves here. */
export function publicSchema(permissions: readonly string[]) {
  return SCHEMA.filter((spec) => permissions.includes(spec.permission)).map((spec) => ({
    key: spec.key,
    label: spec.label,
    dimensions: spec.dimensions.map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      kind: dimension.kind,
    })),
  }));
}

export interface ExploreResult {
  dataset: string;
  dimension: string;
  days: number;
  total: number;
  rows: { key: string; label: string; count: number }[];
  truncated: boolean;
  /** Set when the previous period was requested and could be computed. */
  previousTotal: number | null;
}

/**
 * How many distinct groups a categorical query may return.
 *
 * Grouping on a high-cardinality field — `destination`, `college` — can produce
 * thousands of one-row groups, which is a table nobody can read and a payload
 * nobody needs. The top slice is returned and the result says it was cut.
 */
const GROUP_LIMIT = 50;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Renders a grouped value for display without lying about what it was. */
function labelFor(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(not set)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export async function explore(input: {
  dataset: string;
  dimension: string;
  days: number;
  compare: boolean;
}): Promise<ExploreResult> {
  const spec = datasetFor(input.dataset);
  if (!spec) throw new Error('Unknown dataset');

  const dimension = spec.dimensions.find((candidate) => candidate.key === input.dimension);
  if (!dimension) throw new Error('Unknown dimension');

  const days = Math.min(Math.max(input.days, 1), 365);
  const now = Date.now();
  const since = new Date(now - days * 86_400_000);
  const model = spec.model();

  const where = { [spec.timeField]: { gte: since } };

  const [total, previousTotal] = await Promise.all([
    model.count({ where }),
    input.compare
      ? model.count({
          where: {
            [spec.timeField]: {
              gte: new Date(now - days * 2 * 86_400_000),
              lt: since,
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (dimension.kind === 'time') {
    /**
     * Bucketed in JS rather than by the database.
     *
     * MongoDB can do this with an aggregation pipeline, but Prisma's `groupBy`
     * cannot express a date truncation — and dropping to `$runCommandRaw` here
     * would mean hand-building a pipeline from client input, which is exactly
     * the thing this file exists to avoid. Only the timestamp is selected, and
     * the range is capped at a year, so the set stays bounded.
     */
    const rows = await model.findMany({
      where,
      select: { [spec.timeField]: true },
    });

    const buckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i -= 1) {
      buckets.set(dayKey(new Date(now - i * 86_400_000)), 0);
    }

    for (const row of rows) {
      const value = row[spec.timeField];
      if (!(value instanceof Date)) continue;
      const key = dayKey(value);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return {
      dataset: spec.key,
      dimension: dimension.key,
      days,
      total,
      rows: [...buckets.entries()].map(([key, count]) => ({ key, label: key, count })),
      truncated: false,
      previousTotal,
    };
  }

  const groups = await model.groupBy({
    by: [dimension.key],
    where,
    _count: { _all: true },
  });

  const sorted = groups
    .map((group) => ({
      key: String(group[dimension.key] ?? ''),
      label: labelFor(group[dimension.key]),
      count: Number((group._count as { _all: number })?._all ?? 0),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    dataset: spec.key,
    dimension: dimension.key,
    days,
    total,
    rows: sorted.slice(0, GROUP_LIMIT),
    truncated: sorted.length > GROUP_LIMIT,
    previousTotal,
  };
}
