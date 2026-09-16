#!/usr/bin/env node
/**
 * Provision — and if asked, rotate — the Cloud Run service behind api.spllit.app.
 *
 *   npm run gcloud:bootstrap             # provision / re-apply, never overwrites a secret
 *   npm run gcloud:bootstrap -- --rotate # also push changed values from backend/.env
 *
 * ## This is not the deploy
 *
 * Deploying is `git push origin main`; .github/workflows/deploy-backend.yml
 * builds and rolls out, then gates on /health/ready and a Socket.IO handshake.
 * That workflow deliberately passes no scaling, env or secret flags, because
 * `gcloud run deploy` only changes what it is given — so omitting them carries
 * the live configuration forward instead of restating it.
 *
 * This script is for what that workflow cannot do: enabling APIs, creating the
 * Secret Manager entries, granting the runtime identity access to them, and
 * setting the scaling shape. Run it when standing the service up, or after
 * deliberately changing one of those. Then go back to pushing.
 *
 * ## Why it will not quietly overwrite your secrets
 *
 * The earlier version of this file read backend/.env, pushed a new version of
 * every secret in it, and deployed with --set-secrets and --set-env-vars. Both
 * of those flags *replace the whole set*: anything attached out of band — a key
 * added from the console, a value rotated by somebody else — was detached on
 * the next run. A DATABASE_URL went missing exactly that way, and the symptom
 * was every authenticated request failing while the health check stayed green.
 *
 * So: --update-secrets and --update-env-vars, which are additive. And values
 * are pushed only under --rotate, after comparing against what is live, because
 * a laptop holding a stale .env is otherwise a rollback waiting to happen.
 *
 * Overridable: GCP_PROJECT, GCP_REGION, GCP_SERVICE
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const rotate = process.argv.includes('--rotate');

let env = {};
try {
  env = dotenv.parse(readFileSync(join(backendDir, '.env'), 'utf8'));
} catch {
  // Only fatal when we are being asked to push values out of it.
  if (rotate) {
    console.error('--rotate needs backend/.env, and it could not be read.');
    process.exit(1);
  }
  console.log('No backend/.env — working from what is already in Secret Manager.\n');
}

/** Defaults to the Firebase project already in .env, so both halves agree. */
const PROJECT = process.env.GCP_PROJECT ?? env.FIREBASE_PROJECT_ID ?? 'spllit-app-94194';
/** Mumbai. Closest region to the campuses these requests come from. */
const REGION = process.env.GCP_REGION ?? 'asia-south1';
const SERVICE = process.env.GCP_SERVICE ?? 'spllit-api';

/** Secret env var -> Secret Manager secret id. */
const SECRETS = {
  DATABASE_URL: 'spllit-database-url',
  JWT_SECRET: 'spllit-jwt-secret',
  JWT_REFRESH_SECRET: 'spllit-jwt-refresh-secret',
  FIREBASE_PROJECT_ID: 'spllit-firebase-project-id',
  FIREBASE_CLIENT_EMAIL: 'spllit-firebase-client-email',
  FIREBASE_PRIVATE_KEY: 'spllit-firebase-private-key',
  MAPBOX_SECRET_TOKEN: 'spllit-mapbox-secret-token',
  RAZORPAY_KEY_ID: 'spllit-razorpay-key-id',
  RAZORPAY_KEY_SECRET: 'spllit-razorpay-key-secret',
  OPENAI_API_KEY: 'spllit-openai-api-key',
  // Admin console reports. Not in REQUIRED: without it the Reports tab says so
  // and disables its button, which is a working install missing one feature
  // rather than a broken one.
  GEMINI_API_KEY: 'spllit-gemini-api-key',
  // Shared secret for /api/maintenance/*, which Cloud Scheduler calls. Not in
  // REQUIRED: the routes 404 without it, so an install that has not set one up
  // is safe rather than broken. See routes/maintenance.ts.
  MAINTENANCE_KEY: 'spllit-maintenance-key',
  // Transactional email. Also not REQUIRED — services/email.ts sends nothing
  // without it and throws nothing either. See docs/EMAIL-SYSTEM.md.
  RESEND_API_KEY: 'spllit-resend-api-key',
  RESEND_WEBHOOK_SECRET: 'spllit-resend-webhook-secret',
};

/** Without these the container starts and then fails every real request. */
const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'MAPBOX_SECRET_TOKEN',
];

/** Non-secret config. FRONTEND_URL drives the CORS allowlist in server.ts. */
const PLAIN_ENV = {
  NODE_ENV: 'production',
  // Not a secret: it is the From address printed on every campaign.
  ...(process.env.CAMPAIGN_EMAIL_FROM ? { CAMPAIGN_EMAIL_FROM: process.env.CAMPAIGN_EMAIL_FROM } : {}),
  FRONTEND_URL: 'https://spllit.app',
  JWT_EXPIRES_IN: '1h',
  JWT_REFRESH_EXPIRES_IN: '7d',
};

/**
 * Same normalisation as src/utils/firebaseAdmin.ts, applied before upload.
 *
 * Fixing it only at the consumer would still store a malformed secret, which
 * anything else reading it (a second service, a debugging session) would trip
 * over. Clean it once, here, so what is stored is the key and nothing else.
 */
function cleanPrivateKey(raw) {
  let key = String(raw).trim();
  if (key.endsWith(',')) key = key.slice(0, -1).trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key;
}

function gcloud(args, { capture = false, input } = {}) {
  const result = spawnSync('gcloud', args, {
    cwd: backendDir,
    stdio: input !== undefined
      ? ['pipe', capture ? 'pipe' : 'inherit', 'pipe']
      : [ 'ignore', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'],
    shell: process.platform === 'win32',
    encoding: 'utf8',
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    out: (result.stdout ?? '').trim(),
    err: (result.stderr ?? '').trim(),
  };
}

// ---- preflight ------------------------------------------------------------

// Installed and authenticated are separate questions with separate fixes; on
// Windows (shell: true) a missing binary just exits non-zero like any other
// failure, so checking only the second reports the wrong problem.
const probe = spawnSync('gcloud', ['version'], {
  stdio: 'ignore',
  shell: process.platform === 'win32',
});
if (probe.error || probe.status !== 0) {
  console.error('Google Cloud CLI is not installed (or not on PATH). Install it, then re-run:');
  console.error('  winget install -e --id Google.CloudSDK');
  console.error('\nOpen a new terminal afterwards so PATH is picked up.');
  process.exit(1);
}

const account = gcloud(['auth', 'list', '--filter=status:ACTIVE', '--format=value(account)'],
                       { capture: true });
if (!account.ok || !account.out) {
  console.error('Google Cloud CLI is installed but not signed in. Run:  gcloud auth login');
  process.exit(1);
}

console.log(`\nProject ${PROJECT} · region ${REGION} · service ${SERVICE}`);
console.log(`Signed in as ${account.out}`);
console.log(rotate
  ? 'Mode: rotate — changed values in backend/.env will be pushed.\n'
  : 'Mode: provision — existing secret values are left alone. Pass --rotate to push changes.\n');

// ---- 1. APIs --------------------------------------------------------------

console.log('▸ Enabling APIs (no-op if already on)');
gcloud(['services', 'enable',
  'run.googleapis.com',
  'cloudbuild.googleapis.com',
  'artifactregistry.googleapis.com',
  'secretmanager.googleapis.com',
  '--project', PROJECT]);

// ---- 2. secrets -----------------------------------------------------------

/**
 * Secret Manager rather than --set-env-vars, mainly because of
 * FIREBASE_PRIVATE_KEY: it is a multi-line PEM, and multi-line values in
 * command-line arguments are mangled differently by every shell. Piping the
 * value through stdin sidesteps quoting entirely. A key that arrives corrupted
 * fails as "Invalid token" on every authenticated request, which reads as a
 * login bug rather than a deploy one.
 */
console.log('▸ Secrets');
const secretFlags = [];
const absent = [];

for (const [key, id] of Object.entries(SECRETS)) {
  const exists = gcloud(['secrets', 'describe', id, '--project', PROJECT, '--format=value(name)'],
                        { capture: true }).ok;

  const local = key === 'FIREBASE_PRIVATE_KEY' && env[key]
    ? cleanPrivateKey(env[key])
    : env[key];

  if (exists) {
    // Bind it whether or not this machine has a copy of the value. A secret
    // managed entirely outside this laptop is a normal, preferable state.
    secretFlags.push(`${key}=${id}:latest`);

    if (!rotate || !local) {
      console.log(`  ${key} -> ${id} (kept)`);
      continue;
    }

    // Compare before writing. Adding a version identical to the live one is
    // churn; adding one that differs, out of a .env nobody has refreshed in a
    // month, is a rollback nobody asked for. So say which of the two it is.
    const live = gcloud(['secrets', 'versions', 'access', 'latest', '--secret', id,
      '--project', PROJECT, '--format=value(payload.data)'], { capture: true });
    // gcloud prints the payload base64url-encoded.
    const current = live.ok && live.out
      ? Buffer.from(live.out.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
      : null;

    if (current !== null && current === local) {
      console.log(`  ${key} -> ${id} (unchanged)`);
      continue;
    }

    const added = gcloud(['secrets', 'versions', 'add', id, '--data-file=-', '--project', PROJECT],
                         { capture: true, input: local });
    if (!added.ok) {
      console.error(`  could not add a version to ${id}:\n${added.err}`);
      process.exit(1);
    }
    console.log(`  ${key} -> ${id} (new version pushed)`);
    continue;
  }

  // No secret yet. Creating one needs a value, and the only value we have is
  // whatever is in the local .env.
  if (!local) {
    absent.push(key);
    console.log(`  ${key}: no secret and no local value, skipping`);
    continue;
  }

  const created = gcloud(['secrets', 'create', id,
    '--replication-policy', 'automatic', '--project', PROJECT], { capture: true });
  if (!created.ok) {
    console.error(`  could not create ${id}:\n${created.err}`);
    process.exit(1);
  }
  const seeded = gcloud(['secrets', 'versions', 'add', id, '--data-file=-', '--project', PROJECT],
                        { capture: true, input: local });
  if (!seeded.ok) {
    console.error(`  could not seed ${id}:\n${seeded.err}`);
    process.exit(1);
  }
  secretFlags.push(`${key}=${id}:latest`);
  console.log(`  ${key} -> ${id} (created)`);
}

const missing = REQUIRED.filter((key) => absent.includes(key));
if (missing.length) {
  console.error(
    '\nRefusing to deploy. These have no Secret Manager entry and no value in backend/.env,' +
    '\nso the container would start and then fail every authenticated request:\n  ' +
    missing.join('\n  '),
  );
  process.exit(1);
}

// ---- 3. let the runtime service account read them -------------------------

const projectNumber = gcloud(['projects', 'describe', PROJECT, '--format=value(projectNumber)'],
                             { capture: true }).out;
if (projectNumber) {
  // Cloud Run's default runtime identity. Without secretAccessor the deploy
  // succeeds and the container then fails to start, which surfaces as a
  // health-check failure rather than a permissions error.
  const runtimeSa = `${projectNumber}-compute@developer.gserviceaccount.com`;
  console.log(`▸ Granting ${runtimeSa} access to the secrets`);
  for (const flag of secretFlags) {
    const id = flag.split('=')[1].replace(':latest', '');
    gcloud(['secrets', 'add-iam-policy-binding', id,
      '--member', `serviceAccount:${runtimeSa}`,
      '--role', 'roles/secretmanager.secretAccessor',
      '--project', PROJECT, '--quiet'], { capture: true });
  }
}

// ---- 4. build in the cloud and deploy -------------------------------------

/**
 * `gcloud run deploy --source .` builds through Cloud Build, so no Docker
 * daemon is needed locally.
 *
 * Cloud Run rather than Cloud Functions: functions are request-scoped, and
 * Socket.IO keeps room membership, presence and live positions in process
 * memory. Chat would work in testing and fall apart with two users.
 */
console.log('\n▸ Building through Cloud Build and deploying (first run takes several minutes)');
const envFlag = Object.entries(PLAIN_ENV).map(([k, v]) => `${k}=${v}`).join(',');

const deploy = gcloud(['run', 'deploy', SERVICE,
  '--source', '.',
  '--project', PROJECT,
  '--region', REGION,
  '--port', '8080',
  // The API is public; auth is the Firebase token checked in middleware, not
  // IAM. Without this every request is rejected by Cloud Run before reaching
  // Express.
  '--allow-unauthenticated',

  /**
   * Scale to zero — a deliberate cost choice, not an oversight.
   *
   * The trade is real and worth stating, because the symptom looks like a bug
   * when you hit it: when the last instance shuts down, every open Socket.IO
   * connection goes with it. Chat, typing indicators and live position stop
   * until someone's request wakes the container again, and the first request
   * after idle carries the cold start.
   *
   * That is acceptable while the priority is a near-zero bill. The client
   * reconnects on its own (lib/live/socket.ts sets reconnection: true), so the
   * cost is a delay rather than a dead session.
   *
   * max 1 is a correctness bound rather than a cost one: Socket.IO holds rooms,
   * presence and live positions in process memory, and Cloud Run's session
   * affinity is explicitly best-effort, so two users in one squad can land on
   * different instances and silently stop seeing each other. A Redis adapter
   * comes before raising it.
   *
   * Set min to 1 — and drop --cpu-throttling below — when live chat staying up
   * matters more than the monthly bill.
   */
  '--min-instances', '0',
  '--max-instances', '1',

  // Cloud Run's ceiling. WebSockets are HTTP requests here, so this is how
  // long one may stay open; the client sets reconnection: true, so the hourly
  // drop costs a sub-second reconnect rather than a dead session.
  '--timeout', '3600',

  /**
   * CPU only while a request is in flight — the cheaper billing mode, and the
   * other half of the scale-to-zero decision above.
   *
   * The cost: Socket.IO's heartbeat and the directions-cache sweep in
   * services/directions.ts run on timers, and those stall the moment a request
   * finishes. Idle connections can die without an error the client can act on;
   * it reconnects, but not instantly.
   *
   * Pairs with --min-instances. Change both together or neither.
   */
  '--cpu-throttling',

  '--cpu', '1',
  '--memory', '512Mi',

  // update-, not set-. See the header: the set- forms replace the whole set,
  // detaching anything configured outside this script.
  '--update-env-vars', envFlag,
  ...(secretFlags.length ? ['--update-secrets', secretFlags.join(',')] : []),
]);

if (!deploy.ok) {
  console.error('\nDeploy failed. Build log:');
  console.error(`  gcloud builds list --project ${PROJECT} --limit 1`);
  console.error(`  gcloud run services logs read ${SERVICE} --project ${PROJECT} --region ${REGION}`);
  process.exit(1);
}

// ---- 5. report ------------------------------------------------------------

const url = gcloud(['run', 'services', 'describe', SERVICE,
  '--project', PROJECT, '--region', REGION, '--format=value(status.url)'],
  { capture: true }).out;

console.log('\n─────────────────────────────');
if (url) {
  console.log(`API is live at:  ${url}`);
  console.log(`Readiness:       curl ${url}/health/ready`);
  console.log('\nRoutine deploys from here are: git push origin main');
} else {
  console.log('Deployed, but could not read the URL. Try:');
  console.log(`  gcloud run services describe ${SERVICE} --region ${REGION} --format='value(status.url)'`);
}
console.log('─────────────────────────────\n');
