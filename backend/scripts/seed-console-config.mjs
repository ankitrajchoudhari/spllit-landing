/**
 * Seeds the console's feature flags and platform settings.
 *
 *   node scripts/seed-console-config.mjs           # create what is missing
 *   node scripts/seed-console-config.mjs --list    # show what exists, change nothing
 *
 * Idempotent, and deliberately **never overwrites a value**. Re-running after a
 * deploy must not silently switch a flag back on because the seed file still
 * says `false` — the seed defines what exists, the console owns what it is set
 * to. Only definition fields (label, description, category) are refreshed.
 *
 * Every flag below names a surface Spllit actually has. Nothing here invents a
 * feature: the app directories are rides, squads, events, communities, chat,
 * map, marketplace, rentals, bills and trips, and the flags mirror those.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Flags start `enabled: true` at 100%.
 *
 * They are kill switches for features that are already live, not gates on
 * unreleased ones. Seeding them off would turn running the seed into an
 * outage.
 */
const FLAGS = [
  { key: 'rides.enabled', label: 'Rides', description: 'Ride creation, search and matching.' },
  { key: 'squads.enabled', label: 'Squads', description: 'Squad creation, joining and live position sharing.' },
  { key: 'events.enabled', label: 'Events', description: 'Event creation and attendance.' },
  { key: 'communities.enabled', label: 'Communities', description: 'Communities and their channels.' },
  { key: 'chat.enabled', label: 'Chat', description: 'Threads, messages and typing indicators.' },
  { key: 'map.enabled', label: 'Map', description: 'The Mapbox map surface and live markers.' },
  { key: 'ai.concierge_enabled', label: 'AI concierge', description: 'Describing a trip in a sentence to create a squad.' },
  {
    key: 'marketplace.enabled',
    label: 'Marketplace',
    description: 'Marketplace listings. Phase 2 surface — currently waitlisted.',
    enabled: false,
  },
  {
    key: 'rentals.enabled',
    label: 'Rentals',
    description: 'Rental listings. Phase 2 surface — currently waitlisted.',
    enabled: false,
  },
];

/**
 * Settings. The two marked `requiresConfirmation` are the ones that change how
 * much of the platform a single admin action can touch.
 */
const SETTINGS = [
  {
    key: 'notifications.broadcast_cap',
    category: 'notifications',
    label: 'Broadcast recipient cap',
    description:
      'Most people one broadcast may reach. Clamped to 20,000 in code — a broadcast cannot be recalled.',
    valueType: 'number',
    value: 5000,
    requiresConfirmation: true,
  },
  {
    key: 'exports.row_cap',
    category: 'api',
    label: 'Export row cap',
    description: 'Most rows a single CSV or JSON export may contain. Clamped to 50,000 in code.',
    valueType: 'number',
    value: 10000,
    requiresConfirmation: true,
  },
  {
    key: 'moderation.repeat_block_threshold',
    category: 'moderation',
    label: 'Repeat-block warning threshold',
    description:
      'How many blocks by other users before an account is highlighted on its profile in the console.',
    valueType: 'number',
    value: 3,
    requiresConfirmation: false,
  },
  {
    key: 'general.support_email',
    category: 'general',
    label: 'Support email',
    description: 'Shown to admins as the contact for escalations.',
    valueType: 'string',
    value: 'spllittech@gmail.com',
    requiresConfirmation: false,
  },
];

async function main() {
  const listOnly = process.argv.includes('--list');

  if (listOnly) {
    const [flags, settings] = await Promise.all([
      prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }),
      prisma.platformSetting.findMany({ orderBy: { key: 'asc' } }),
    ]);

    console.log(`\nFeature flags (${flags.length}):`);
    for (const flag of flags) {
      const rollout = flag.rolloutPercentage < 100 ? ` @${flag.rolloutPercentage}%` : '';
      console.log(`  ${flag.enabled ? 'ON ' : 'OFF'} ${flag.key}${rollout}`);
    }

    console.log(`\nSettings (${settings.length}):`);
    for (const setting of settings) {
      console.log(`  ${setting.key} = ${JSON.stringify(setting.value)}`);
    }
    console.log('');
    return;
  }

  let created = 0;
  let refreshed = 0;

  for (const flag of FLAGS) {
    const existing = await prisma.featureFlag.findUnique({ where: { key: flag.key } });

    if (existing) {
      // Definition only. `enabled` and `rolloutPercentage` are owned by the
      // console from the moment the row exists.
      await prisma.featureFlag.update({
        where: { key: flag.key },
        data: { label: flag.label, description: flag.description },
      });
      refreshed += 1;
      continue;
    }

    await prisma.featureFlag.create({
      data: {
        key: flag.key,
        label: flag.label,
        description: flag.description,
        enabled: flag.enabled ?? true,
        rolloutPercentage: 100,
        targetUserIds: [],
        environments: [],
      },
    });
    created += 1;
  }

  for (const setting of SETTINGS) {
    const existing = await prisma.platformSetting.findUnique({ where: { key: setting.key } });

    if (existing) {
      await prisma.platformSetting.update({
        where: { key: setting.key },
        data: {
          category: setting.category,
          label: setting.label,
          description: setting.description,
          valueType: setting.valueType,
          requiresConfirmation: setting.requiresConfirmation,
        },
      });
      refreshed += 1;
      continue;
    }

    await prisma.platformSetting.create({ data: setting });
    created += 1;
  }

  console.log(`Created ${created}, refreshed definitions for ${refreshed}.`);
  console.log('No existing value was changed. Run with --list to see current state.');
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
