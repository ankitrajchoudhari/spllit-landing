'use client';

import { useMemo } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/primitives';

/**
 * A live QR code for a registration link, generated as it is typed.
 *
 * Drawn the same way as the ticket on spllit.app — round dots, rounded eyes,
 * error correction Q — so what is checked here is what visitors will scan.
 * PNG (1,200px, for posters and print) and SVG (for designers) downloads
 * are generated from the same link.
 *
 * Nothing is drawn for a link that is not https:// — a code to a broken link
 * is worse than no code.
 */

const INK = '#0e0e0d';
const PAPER = '#ffffff';

function isUsable(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

/** The same drawing the site uses: dots for data, rounded finder eyes. */
function qrSvg(value: string): string {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'Q' });
  const size = qr.modules.size;
  const finders: [number, number][] = [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
  const inFinder = (r: number, c: number) =>
    finders.some(([fr, fc]) => r >= fr && r < fr + 7 && c >= fc && c < fc + 7);

  const parts: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c) && !inFinder(r, c)) {
        parts.push(`<circle cx="${c + 0.5}" cy="${r + 0.5}" r="0.48"/>`);
      }
    }
  }
  for (const [r, c] of finders) {
    parts.push(
      `<rect x="${c + 0.5}" y="${r + 0.5}" width="6" height="6" rx="1.8" fill="none" stroke="${INK}" stroke-width="1"/>`,
      `<rect x="${c + 2}" y="${r + 2}" width="3" height="3" rx="0.9"/>`,
    );
  }
  // A four-module quiet zone, as the standard asks, so a printed copy scans.
  const pad = 4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${size + pad * 2} ${size + pad * 2}" fill="${INK}"><rect x="${-pad}" y="${-pad}" width="${size + pad * 2}" height="${size + pad * 2}" fill="${PAPER}"/>${parts.join('')}</svg>`;
}

function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}

function slug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'event'
  );
}

export function RegisterQr({ url, title }: { url: string; title: string }) {
  const usable = isUsable(url);
  const svg = useMemo(() => (usable ? qrSvg(url.trim()) : ''), [url, usable]);

  if (!url.trim()) {
    return (
      <div className="flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-lg border border-dashed border-line px-3 text-center text-[11px] text-ink-subtle">
        Paste the form link and its QR appears here
      </div>
    );
  }
  if (!usable) {
    return (
      <div className="flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-lg border border-dashed border-danger/50 px-3 text-center text-[11px] text-danger">
        Not a full https:// link yet
      </div>
    );
  }

  async function savePng() {
    // Rasterised from the same SVG, at print size.
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 1200, 1200);
    download(canvas.toDataURL('image/png'), `${slug(title)}-register-qr.png`);
  }

  function saveSvg() {
    download(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      `${slug(title)}-register-qr.svg`,
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div
        className="h-[132px] w-[132px] rounded-lg border border-line bg-white p-1"
        // Generated locally from a validated https URL; no user markup.
        dangerouslySetInnerHTML={{ __html: svg }}
        role="img"
        aria-label="QR code for the registration link"
      />
      <div className="flex gap-1.5">
        <Button size="sm" onClick={() => void savePng()}>
          <Download className="mr-1 h-3 w-3" aria-hidden />
          PNG
        </Button>
        <Button size="sm" onClick={saveSvg}>
          <Download className="mr-1 h-3 w-3" aria-hidden />
          SVG
        </Button>
      </div>
    </div>
  );
}
