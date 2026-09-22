/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The backend/ workspace has its own lockfile; pin the trace root so Next
  // doesn't walk up and pick the wrong one.
  outputFileTracingRoot: import.meta.dirname,
  images: {
    /**
     * AVIF first, WebP as the fallback. The artwork on the landing page is flat
     * illustration, which is exactly what AVIF compresses best.
     *
     * The cache TTL is the important one: without it the optimiser re-derives
     * every image on a short cycle, so the same picture is rebuilt on the server
     * again and again for no benefit — these files only change when somebody
     * replaces them by hand. NOTE the trade-off: replacing an image while
     * keeping its filename will keep serving the old one until this expires, so
     * either change the filename or clear the image cache when you swap art.
     */
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google profile photos
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'api.mapbox.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  // mapbox-gl ships untranspiled ESM that Next's server compiler chokes on; it is
  // only ever loaded client-side via next/dynamic, so exclude it from RSC bundling.
  transpilePackages: ['mapbox-gl'],

  /**
   * Routes carried over from the Vite app this replaced.
   *
   * Those URLs are still in Google's index, in bookmarks, and in links people
   * have already shared — `/login?signin=1` is where Google Sign-In used to
   * land, and it now 404s. A 308 keeps those links working and tells crawlers
   * to update, which matters more here because the sitemap was only just
   * corrected.
   *
   * Query strings are preserved automatically, so `?signin=1` survives the hop.
   */
  /**
   * Serves Firebase's auth handler from our own domain.
   *
   * This exists for the phone-OTP SMS. Google composes that message as
   * "<code> is your verification code for <authDomain>", and the app name in
   * it is not a template we can set from the client — it is whatever
   * `authDomain` is. Today that is `spllit-app-94194.firebaseapp.com`, so
   * every OTP text shows the raw Firebase project id to the user.
   *
   * Pointing `authDomain` at `spllit.app` fixes the wording, but on its own it
   * breaks Google sign-in: the popup and redirect flows load
   * `https://<authDomain>/__/auth/handler`, and this app is served by
   * Cloudflare Workers, which has nothing at that path. This rewrite is that
   * missing piece — it proxies the handler through to Firebase, so the browser
   * sees the flow on spllit.app while Firebase still answers it.
   *
   * Deliberately inert until `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is switched:
   * while authDomain remains firebaseapp.com nothing requests `/__/auth/*` on
   * our origin, so this rewrite matches nothing. Ordering matters when you do
   * switch — see docs/FIREBASE-AUTH-DOMAIN.md.
   *
   * The destination is built from the *project id*, never from authDomain: the
   * whole point is that authDomain is about to become our own domain, and
   * proxying to it would be a loop.
   */
  async rewrites() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) return [];

    return [
      {
        source: '/__/auth/:path*',
        destination: `https://${projectId}.firebaseapp.com/__/auth/:path*`,
      },
    ];
  },

  async redirects() {
    return [
      { source: '/login', destination: '/auth', permanent: true },
      { source: '/signup', destination: '/auth', permanent: true },
      { source: '/register', destination: '/auth', permanent: true },
      { source: '/dashboard', destination: '/home', permanent: true },
      { source: '/admin-login', destination: '/auth', permanent: true },
      // Marketing pages folded into /about when the site was rebuilt.
      { source: '/features', destination: '/about', permanent: true },
      { source: '/how-it-works', destination: '/about', permanent: true },
      { source: '/pricing', destination: '/about', permanent: true },
      { source: '/faq', destination: '/about', permanent: true },
      { source: '/iit-madras', destination: '/about', permanent: true },

      /**
       * Bare legal paths.
       *
       * `/terms` and `/privacy` were live 404s linked from the sign-up consent
       * line — the one place the link has to resolve, since agreeing to a
       * document you cannot open is not agreement. The callsite now points at
       * /legal/*, and these stay because the short forms are what people type,
       * what other sites link to, and what a payment provider's compliance
       * check looks for.
       *
       * Note `/legal` itself is NOT redirected any more: it is an index page
       * listing all six documents. A redirect here would shadow it.
       */
      { source: '/terms', destination: '/legal/terms', permanent: true },
      { source: '/terms-of-service', destination: '/legal/terms', permanent: true },
      { source: '/privacy', destination: '/legal/privacy', permanent: true },
      { source: '/privacy-policy', destination: '/legal/privacy', permanent: true },
      { source: '/safety', destination: '/legal/safety', permanent: true },
      { source: '/cookies', destination: '/legal/cookies', permanent: true },
      { source: '/cookie-policy', destination: '/legal/cookies', permanent: true },
      // Singular and plural: Razorpay's own documentation uses "Refund Policy",
      // so that is the spelling a reviewer is most likely to try.
      { source: '/refund', destination: '/legal/refunds', permanent: true },
      { source: '/refunds', destination: '/legal/refunds', permanent: true },
      { source: '/refund-policy', destination: '/legal/refunds', permanent: true },
      { source: '/cancellation', destination: '/legal/refunds', permanent: true },
      { source: '/ip', destination: '/legal/intellectual-property', permanent: true },
      { source: '/copyright', destination: '/legal/intellectual-property', permanent: true },
      { source: '/contact', destination: '/about', permanent: true },
      { source: '/contact-us', destination: '/about', permanent: true },
    ];
  },
};

export default nextConfig;
