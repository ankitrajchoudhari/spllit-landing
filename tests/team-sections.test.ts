import test from 'node:test';
import assert from 'node:assert/strict';

import { toSections } from '../lib/team-sections.ts';

const base = { role: 'Engineering', bio: '', photo: '', hidden: false, status: 'active' };

test('sorts people into founders, core, interns and alumni', () => {
  const sections = toSections({
    members: [
      { ...base, name: 'A', group: 'founder' },
      { ...base, name: 'B', group: 'core' },
      { ...base, name: 'C', group: 'intern' },
      { ...base, name: 'D', group: 'intern', status: 'exited' },
      { ...base, name: 'E', group: 'core', status: 'exited' },
    ],
  });
  assert.ok(sections);
  assert.deepEqual(
    sections.founders.map((m) => m.name),
    ['A'],
  );
  assert.deepEqual(
    sections.core.map((m) => m.name),
    ['B'],
  );
  assert.deepEqual(
    sections.interns.map((m) => m.name),
    ['C'],
  );
  assert.deepEqual(
    sections.alumni.map((m) => m.name),
    ['D', 'E'],
  );
});

test('labels alumni by what they were', () => {
  const sections = toSections({
    members: [
      { ...base, name: 'D', group: 'intern', status: 'exited' },
      { ...base, name: 'E', group: 'core', status: 'exited' },
    ],
  });
  assert.deepEqual(
    sections?.alumni.map((m) => m.role),
    ['Former intern', 'Former core team'],
  );
});

test('keeps only https profile links, in a fixed order', () => {
  const sections = toSections({
    members: [
      {
        ...base,
        name: 'A',
        group: 'core',
        links: {
          x: 'https://x.com/a',
          instagram: 'https://www.instagram.com/a',
          linkedin: 'javascript:alert(1)',
          github: 'http://github.com/a',
          website: '',
        },
      },
    ],
  });
  assert.deepEqual(sections?.core[0]?.links, [
    { label: 'Instagram', href: 'https://www.instagram.com/a' },
    { label: 'X', href: 'https://x.com/a' },
  ]);
});

test('drops hidden and nameless people, and signals fallback when nobody is left', () => {
  assert.equal(
    toSections({
      members: [
        { ...base, name: 'A', group: 'core', hidden: true },
        { ...base, name: '  ', group: 'core' },
      ],
    }),
    null,
  );
  assert.equal(toSections(null), null);
  assert.equal(toSections({ members: 'nope' }), null);
});

test('refuses a photo that is neither https nor a site path', () => {
  const sections = toSections({
    members: [
      { ...base, name: 'A', group: 'core', photo: 'data:image/png;base64,xx' },
      { ...base, name: 'B', group: 'core', photo: '/team/b.jpg' },
    ],
  });
  assert.equal(sections?.core[0]?.photo, undefined);
  assert.equal(sections?.core[1]?.photo, '/team/b.jpg');
});
