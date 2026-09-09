/**
 * Sparse unique indexes that Prisma cannot express for MongoDB.
 *
 * NOTE (admin console): ordinary performance indexes are NOT declared here —
 * they are `@@index` entries in schema.prisma, so `prisma db push` creates and
 * maintains them. This file is only for indexes Prisma's schema language
 * cannot express, which today means partial/sparse unique ones.
 *
 * One thing deliberately left un-indexed: the console's search boxes use
 * case-insensitive `contains`, which Prisma compiles to an unanchored regex.
 * An unanchored regex cannot use a B-tree index, so adding one for `User.name`
 * or `Squad.name` would cost write throughput and buy nothing. If search
 * becomes slow, the fix is a MongoDB text index and a `$text` query — a
 * different query shape, not another index on the same one.
 *
 * `User.firebaseUid` and `User.username` are both optional and must be unique
 * *when present*. A plain `@unique` in the Prisma schema creates a standard
 * unique index, and MongoDB treats every missing/null value as the same key —
 * so the second user without a Firebase sign-in or a chosen username collides
 * with the first and the index build fails with E11000.
 *
 * A partial index filtered on `$type: "string"` gets this right: null and
 * missing documents are excluded from the index entirely, while real values
 * stay unique at the database level rather than only in application code.
 *
 * Run after `prisma db push`:
 *   node prisma/indexes.mjs
 * Idempotent — re-running is a no-op.
 *
 * Uses Prisma's $runCommandRaw rather than the mongodb driver directly, so this
 * needs no dependency beyond what the backend already has.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const INDEXES = [
  {
    collection: 'User',
    field: 'firebaseUid',
    name: 'User_firebaseUid_sparse_unique',
  },
  {
    collection: 'User',
    field: 'username',
    name: 'User_username_sparse_unique',
  },
  {
    // Join codes are handed out verbally and typed in; two squads sharing one
    // would send people to the wrong group.
    collection: 'Squad',
    field: 'joinCode',
    name: 'Squad_joinCode_sparse_unique',
  },
  {
    // One registration mark, one host. Enforced here rather than with @unique
    // so the index is filtered the same way as the others above — and so a
    // future nullable plate cannot collapse every null into one key.
    collection: 'Vehicle',
    field: 'plate',
    name: 'Vehicle_plate_sparse_unique',
  },
];

try {
  for (const spec of INDEXES) {
    // Surface real duplicates first, so a failure reads as "these two users
    // share a username" rather than an opaque E11000 from the index build.
    const dupes = await prisma.$runCommandRaw({
      aggregate: spec.collection,
      pipeline: [
        { $match: { [spec.field]: { $type: 'string' } } },
        { $group: { _id: `$${spec.field}`, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ],
      cursor: {},
    });

    const conflicts = dupes?.cursor?.firstBatch ?? [];
    if (conflicts.length > 0) {
      console.error(
        `SKIPPED ${spec.name}: duplicate ${spec.field} value(s) already exist: ` +
          conflicts.map((d) => `${d._id} (x${d.count})`).join(', '),
      );
      continue;
    }

    await prisma.$runCommandRaw({
      createIndexes: spec.collection,
      indexes: [
        {
          key: { [spec.field]: 1 },
          name: spec.name,
          unique: true,
          partialFilterExpression: { [spec.field]: { $type: 'string' } },
        },
      ],
    });

    console.log(`OK  ${spec.name}`);
  }
} finally {
  await prisma.$disconnect();
}
