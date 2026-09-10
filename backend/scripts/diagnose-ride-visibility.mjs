/**
 * Why is a ride not showing up?
 *
 *   node scripts/diagnose-ride-visibility.mjs            # survey every recent ride
 *   node scripts/diagnose-ride-visibility.mjs Ayush      # rides by a named creator
 *
 * Strictly read-only. It issues findMany and count and nothing else, so it is
 * safe to point at production — which is the only place the answer lives.
 *
 * Every guest-facing ride list goes through `joinableRideWhere` in
 * services/rideVisibility.ts plus a bounding box and, when a destination is
 * given, a corridor filter. A ride can therefore be perfectly valid in the
 * database and still appear nowhere. This reports which of those rules each
 * ride trips, in the order they are applied, so the answer is a rule name
 * rather than a guess.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const JOINABLE = ['requested', 'pending', 'accepted', 'matched', 'arriving'];
const GRACE_MINUTES = 30;

function verdicts(ride, now) {
  const reasons = [];

  if (!JOINABLE.includes(ride.status)) {
    reasons.push(`status "${ride.status}" is not joinable (needs one of ${JOINABLE.join(', ')})`);
  }

  if (!ride.departureTime) {
    reasons.push('departureTime is null');
  } else {
    const minutesPast = (now - ride.departureTime) / 60000;
    if (minutesPast > GRACE_MINUTES) {
      reasons.push(
        `departed ${Math.round(minutesPast)} min ago — past the ${GRACE_MINUTES} min grace`,
      );
    }
  }

  // The permanent one. Every other rule hides a ride eventually; this one hides
  // it from the moment it is created, and nothing ever un-hides it.
  if (ride.originLat === null || ride.originLng === null) {
    reasons.push('originLat/originLng are NULL — invisible in /nearby and dropped by the corridor filter, permanently');
  }

  if (!ride.seats || ride.seats < 1) {
    reasons.push(`seats is ${ride.seats}`);
  }

  return reasons;
}

async function main() {
  const search = process.argv[2];
  const now = new Date();

  const creators = search
    ? await prisma.user.findMany({
        where: { name: { contains: search, mode: 'insensitive' } },
        select: { id: true, name: true, email: true },
      })
    : [];

  if (search && creators.length === 0) {
    console.log(`No user whose name contains "${search}".`);
    return;
  }

  const rides = await prisma.ride.findMany({
    where: search ? { userId: { in: creators.map((c) => c.id) } } : {},
    orderBy: { createdAt: 'desc' },
    take: search ? 50 : 200,
    select: {
      id: true,
      userId: true,
      origin: true,
      destination: true,
      originLat: true,
      originLng: true,
      destLat: true,
      destLng: true,
      status: true,
      seats: true,
      departureTime: true,
      createdAt: true,
    },
  });

  const nameById = new Map(creators.map((c) => [c.id, c.name]));

  if (search) {
    console.log(`\nMatched ${creators.length} user(s): ${creators.map((c) => c.name).join(', ')}`);
    console.log(`${rides.length} ride(s) found.\n`);

    for (const ride of rides) {
      const reasons = verdicts(ride, now);
      console.log('─'.repeat(72));
      console.log(`ride       ${ride.id}`);
      console.log(`creator    ${nameById.get(ride.userId) ?? ride.userId}`);
      console.log(`route      ${ride.origin} → ${ride.destination}`);
      console.log(`origin     lat=${ride.originLat} lng=${ride.originLng}`);
      console.log(`dest       lat=${ride.destLat} lng=${ride.destLng}`);
      console.log(`status     ${ride.status}`);
      console.log(`seats      ${ride.seats}`);
      console.log(`departs    ${ride.departureTime?.toISOString() ?? 'null'}`);
      console.log(`created    ${ride.createdAt.toISOString()}`);
      console.log(
        reasons.length === 0
          ? 'VERDICT    visible — no rule hides this ride'
          : `VERDICT    HIDDEN by:\n           - ${reasons.join('\n           - ')}`,
      );
    }
    console.log('─'.repeat(72));
  }

  // The systemic question, answered by counting rather than by opinion.
  const [total, nullOrigin, nullOriginJoinable] = await Promise.all([
    prisma.ride.count(),
    prisma.ride.count({ where: { OR: [{ originLat: null }, { originLng: null }] } }),
    prisma.ride.count({
      where: {
        status: { in: JOINABLE },
        OR: [{ originLat: null }, { originLng: null }],
      },
    }),
  ]);

  console.log('\n=== Fleet-wide ===');
  console.log(`rides total                          ${total}`);
  console.log(`with NULL origin coordinates         ${nullOrigin}`);
  console.log(`  ...and otherwise joinable          ${nullOriginJoinable}  <- silently invisible`);
  console.log(
    nullOrigin > 1
      ? '\nMore than one affected ride: this is the systemic bug, not a one-off.'
      : '\nAt most one affected ride.',
  );
}

main()
  .catch((error) => {
    console.error('\nQuery failed:', error.message);
    console.error('\nIf this is a connection error, check DATABASE_URL in backend/.env.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
