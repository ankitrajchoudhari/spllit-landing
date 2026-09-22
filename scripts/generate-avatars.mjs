/**
 * Generates the testimonial avatars as static SVG files.
 *
 * DiceBear is a build-time dependency on purpose. The hosted API at
 * api.dicebear.com would put a third-party request on the critical path of the
 * landing page for artwork that never changes, and bundling the generator into
 * the client would ship a sprite library to every visitor. Running it here
 * writes four small SVGs that are then served as ordinary static assets.
 *
 * The style is notionists: line art that stays legible at the 44px these are
 * actually drawn at, where the flat-colour styles turn to mud.
 *
 * Re-run with: node scripts/generate-avatars.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createAvatar } from '@dicebear/core';
import { notionists } from '@dicebear/collection';

const OUT = 'public/avatars';
mkdirSync(OUT, { recursive: true });

// Seeds are the names shown beside each quote, so an avatar always belongs to
// the same person and regenerating is deterministic.
const SEEDS = ['Meera K.', 'Arjun R.', 'Divya S.'];

for (const seed of SEEDS) {
  const svg = createAvatar(notionists, {
    seed,
    size: 96,
    radius: 50,
    backgroundColor: ['d7f2e3', 'e4ecf7', 'f6e7d8'],
    backgroundType: ['solid'],
  }).toString();

  const file = `${OUT}/${seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}.svg`;
  writeFileSync(file, svg);
  console.log('wrote', file, Math.round(svg.length / 1024) + 'KB');
}
