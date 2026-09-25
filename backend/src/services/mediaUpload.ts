import crypto from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';

/**
 * Images uploaded from the admin console.
 *
 * Cloud Run has no disk worth writing to — an instance can be replaced between
 * two requests — so an uploaded file has to leave the container immediately.
 * It goes to a Cloud Storage bucket that is world-readable, because the whole
 * point is that a visitor's browser can fetch it off a public page.
 *
 * firebase-admin is already a dependency and carries the storage client, so
 * this needs no new package and no separate credentials: on Cloud Run it
 * authenticates as the runtime service account, which has object write on the
 * bucket and nothing else.
 */

const BUCKET = process.env.MEDIA_BUCKET?.trim() || 'spllit-media';

/**
 * What a browser will actually render, and nothing that executes.
 *
 * SVG is deliberately absent. It is an image to a person and a document with
 * scripting to a browser, so serving one from our own origin hands an author
 * the ability to run script on a page that trusts us.
 */
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Magic bytes, not the declared type.
 *
 * The Content-Type on an upload is whatever the client typed. Checking the
 * first few bytes is what actually distinguishes a PNG from an HTML file with
 * a picture's name, and it is the second of those that matters.
 */
function sniff(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.subarray(0, 3).toString('latin1') === 'GIF') return 'image/gif';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
      buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp' &&
      buffer.subarray(8, 12).toString('latin1').startsWith('avif')) {
    return 'image/avif';
  }
  return null;
}

/**
 * One shape rather than a discriminated union.
 *
 * The backend's tsconfig does not narrow a union on a boolean discriminant,
 * so a union here reads as clean and then fails to compile at every call
 * site. `error` set means nothing was stored.
 */
export interface UploadResult {
  url?: string;
  contentType?: string;
  bytes?: number;
  error?: string;
}

export async function uploadImage(buffer: Buffer): Promise<UploadResult> {
  if (buffer.length === 0) return { error: 'The file is empty' };
  if (buffer.length > MAX_IMAGE_BYTES) {
    return { error: 'Images must be under 8 MB' };
  }

  const contentType = sniff(buffer);
  if (!contentType || !ALLOWED[contentType]) {
    return {
      error: 'That is not an image we can serve. Use JPEG, PNG, WebP, GIF or AVIF.',
    };
  }

  /**
   * A random name, not the uploaded one.
   *
   * The original is attacker-controlled and would let one upload overwrite
   * another by reusing a name — including a picture already live on a post.
   * Nothing downstream needs the original filename.
   */
  const key = `blog/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ALLOWED[contentType]}`;

  const file = getStorage().bucket(BUCKET).file(key);
  await file.save(buffer, {
    contentType,
    // A year, immutable: the name is unique per upload, so a cached copy can
    // never be stale — there is no second object with this name.
    metadata: { cacheControl: 'public, max-age=31536000, immutable' },
  });

  return {
    url: `https://storage.googleapis.com/${BUCKET}/${key}`,
    contentType,
    bytes: buffer.length,
  };
}
