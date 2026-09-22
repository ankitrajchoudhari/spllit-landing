/**
 * Turning a pasted Google Form link into one that can be embedded.
 *
 * Google Forms renders inside an iframe only from the long `docs.google.com`
 * URL with `?embedded=true`. The console is given a `forms.gle` short link most
 * of the time — that is what the Send dialog offers — and the parameter is lost
 * through the redirect, so the short link has to be resolved first.
 *
 * Whatever is pasted is admin-supplied, but it is still only ever fetched when
 * the host is one of Google's two shorteners, and only ever embedded when it
 * resolves to a Google Forms URL. Anything else returns null and the apply page
 * sends the applicant out to the link instead of framing something unknown.
 */

const SHORTENERS = new Set(['forms.gle', 'goo.gl']);

function isGoogleForm(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const onGoogle = host === 'google.com' || host.endsWith('.google.com');
  return onGoogle && url.pathname.includes('/forms/');
}

/**
 * Follow the shortener to the real form URL.
 *
 * Cached for a day: a form link does not move, and resolving it on every
 * request would put a Google round trip in front of the page.
 */
async function resolveShortLink(href: string): Promise<URL | null> {
  try {
    const res = await fetch(href, { redirect: 'follow', next: { revalidate: 86_400 } });
    return new URL(res.url);
  } catch {
    return null;
  }
}

export async function toEmbedUrl(applyUrl: string): Promise<string | null> {
  const raw = applyUrl.trim();
  if (!/^https?:\/\//i.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (SHORTENERS.has(url.hostname.toLowerCase())) {
    const resolved = await resolveShortLink(url.toString());
    if (!resolved) return null;
    url = resolved;
  }

  if (!isGoogleForm(url)) return null;

  // `/edit` is the author's view. Framing it would show an applicant a sign-in
  // wall at best, so every path collapses to the public `viewform`.
  url.pathname = url.pathname.replace(/\/(edit|viewform)[^/]*$/, '/viewform');
  if (!url.pathname.endsWith('/viewform')) url.pathname = `${url.pathname.replace(/\/$/, '')}/viewform`;
  url.searchParams.set('embedded', 'true');
  return url.toString();
}
