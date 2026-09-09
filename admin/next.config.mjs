/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // This app sits inside a repo that has two other lockfiles (root and
  // backend/). Without pinning the trace root, Next walks up and picks one of
  // theirs, which traces the wrong dependency set into the build.
  outputFileTracingRoot: import.meta.dirname,

  /**
   * The console must never be indexed or framed.
   *
   * These are set here as well as at the edge because the header that stops
   * this page being embedded in someone else's site is the one thing that
   * should not depend on a CDN rule being configured correctly.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default nextConfig;
