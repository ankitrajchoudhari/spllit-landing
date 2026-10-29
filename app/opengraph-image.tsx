import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

import { SITE } from '@/content/site';

/**
 * The link-preview card for every page that does not bring its own.
 *
 * Previews used to be logo-full.png, a 666x375 lockup, below the 1200x630
 * WhatsApp, LinkedIn and X expect, so it was letterboxed or shown as a small
 * thumbnail. This is that same wordmark — the protected file, read and never
 * modified — set on a full-size card with the one line that says what Spllit
 * is, so a shared link explains itself before anyone taps it.
 *
 * Generated at build time and cached; nothing here reads the request.
 */

export const alt = `${SITE.name} — campus ride sharing and travel group rides for students in India`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const wordmark = await readFile(join(process.cwd(), 'public/logo-full.png'));
  const src = `data:image/png;base64,${wordmark.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#202020',
          padding: '40px 0 56px',
        }}
      >
        {/* Cropped a few pixels in: the source has a hairline border that
            would otherwise frame the wordmark like a screenshot. */}
        <div style={{ display: 'flex', width: 800, height: 420, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
          <img src={src} width={840} height={473} style={{ margin: '-26px 0 0 -20px' }} alt="" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 36, color: '#e6e8e7', letterSpacing: -0.5 }}>
            Campus ride sharing &amp; group rides for students
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28 }}>
            <div style={{ width: 12, height: 12, borderRadius: 12, background: '#00c853' }} />
            <div style={{ color: '#00c853', fontWeight: 700 }}>spllit.app</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
