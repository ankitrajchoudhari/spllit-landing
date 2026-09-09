import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * OpenNext adapter config for the console. Same reasoning as the main app's:
 * `opennextjs-cloudflare build` requires this file to exist, and committing it
 * stops Cloudflare's auto-detection from trying to generate one at deploy time
 * through `npx`, where the `wrangler` import fails to resolve.
 *
 * Minimal on purpose. The console has no ISR at all — every page is client
 * rendered against an authenticated API, and caching an admin's view of user
 * data at the edge is the last thing this app should do.
 */
export default defineCloudflareConfig();
