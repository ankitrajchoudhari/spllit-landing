import { BlockList, isIP } from 'node:net';
import type { Request } from 'express';

/**
 * The caller's real address, for rate limits and the audit log.
 *
 * Production is client → Cloudflare → Google Front End → this container. Each
 * hop *appends* the address it received from, so X-Forwarded-For arrives as
 *
 *     <anything the client sent>, <client, per Cloudflare>, <Cloudflare edge, per Google>
 *
 * Reading the left-most entry, as this used to, read the part the client
 * writes: one spoofed header gave every request a fresh rate-limit bucket.
 * Reading the right-most alone would read a Cloudflare edge address and put
 * thousands of users in one bucket.
 *
 * So: walk from the right, skip every address that belongs to a proxy we
 * trust, and stop at the first one that does not. A request that bypasses
 * Cloudflare and hits the run.app URL directly has no Cloudflare hop, so the
 * walk stops at the address Google saw — which the client cannot forge either.
 */

/** Cloudflare's published ranges — https://www.cloudflare.com/ips/ */
const CLOUDFLARE = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

function buildTrusted(extra: string | undefined): BlockList {
  const list = new BlockList();
  // Extra hops (a new CDN, a load balancer) without a code change:
  // TRUSTED_PROXY_CIDRS="10.0.0.0/8,fd00::/8"
  const cidrs = [...CLOUDFLARE, ...(extra ?? '').split(',').map((c) => c.trim()).filter(Boolean)];
  for (const cidr of cidrs) {
    const [net, bits] = cidr.split('/');
    const family = isIP(net ?? '');
    if (!family || !bits) continue;
    list.addSubnet(net!, Number(bits), family === 6 ? 'ipv6' : 'ipv4');
  }
  return list;
}

let trusted = buildTrusted(process.env.TRUSTED_PROXY_CIDRS);

/** For tests: rebuild after changing TRUSTED_PROXY_CIDRS. */
export function reloadTrustedProxies(): void {
  trusted = buildTrusted(process.env.TRUSTED_PROXY_CIDRS);
}

/** `::ffff:1.2.3.4` → `1.2.3.4`; anything unparseable → null. */
function normalise(raw: string): string | null {
  let ip = raw.trim();
  if (ip.startsWith('[') && ip.includes(']')) ip = ip.slice(1, ip.indexOf(']'));
  if (ip.toLowerCase().startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return isIP(ip) ? ip : null;
}

function isTrusted(ip: string): boolean {
  return trusted.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4');
}

/** The right-most untrusted address in a forwarded chain, else the peer. */
export function resolveClientIp(forwardedFor: string | string[] | undefined, peer: string | undefined): string | null {
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor ?? '';
  const hops = header.split(',').map(normalise).filter((ip): ip is string => ip !== null);

  // Behind Cloud Run the socket peer is an internal address, so it is only
  // the answer when there is no forwarded chain at all (local development).
  const peerIp = peer ? normalise(peer) : null;

  for (let i = hops.length - 1; i >= 0; i -= 1) {
    if (!isTrusted(hops[i]!)) return hops[i]!;
  }
  // Every hop was a trusted proxy (or there were none): best remaining guess.
  return hops[0] ?? peerIp;
}

/**
 * Zones whose Workers are ours (the admin console runs on one). Anyone else's
 * Worker can put any X-Forwarded-For it likes on a request and still arrive
 * from a Cloudflare address, so the walk above would trust its word. Cloudflare
 * stamps those subrequests with a `CF-Worker: <zone>` header the Worker cannot
 * remove, and that zone becomes the identity instead.
 */
const OWN_ZONES = new Set(
  (process.env.OWN_WORKER_ZONES ?? 'spllit.app').split(',').map((z) => z.trim().toLowerCase()).filter(Boolean),
);

export function clientIpOf(req: Request): string | null {
  const worker = req.headers['cf-worker'];
  if (typeof worker === 'string' && worker && !OWN_ZONES.has(worker.toLowerCase())) {
    return `cf-worker:${worker.toLowerCase()}`;
  }
  return resolveClientIp(req.headers['x-forwarded-for'], req.socket?.remoteAddress ?? req.ip);
}
