/**
 * The platforms' own marks, in their own colours, for links that go to our
 * profiles on them. Lucide's outline glyphs are generic stand-ins; next to a
 * profile handle the real mark is what makes the link read as the real thing.
 */

/**
 * `gradientId` must be unique on the page — two logos sharing one id would
 * share one gradient. A prop rather than useId(), which a Server Component
 * cannot call.
 */
export function InstagramLogo({
  className,
  gradientId = 'instagram-logo-gradient',
}: {
  className?: string;
  gradientId?: string;
}) {
  const id = gradientId;
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <defs>
        <radialGradient id={id} cx="30%" cy="107%" r="150%">
          <stop offset="0" stopColor="#fdf497" />
          <stop offset="0.05" stopColor="#fdf497" />
          <stop offset="0.45" stopColor="#fd5949" />
          <stop offset="0.6" stopColor="#d6249f" />
          <stop offset="0.9" stopColor="#285aeb" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill={`url(#${id})`} />
      <rect
        x="5"
        y="5"
        width="14"
        height="14"
        rx="4.2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.9" />
      <circle cx="16.4" cy="7.6" r="1.05" fill="#fff" />
    </svg>
  );
}

export function LinkedInLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect width="24" height="24" rx="4" fill="#0a66c2" />
      <path
        fill="#fff"
        d="M7.1 9.4H4.6v9.1h2.5V9.4Zm.2-2.9a1.45 1.45 0 1 0-2.9 0 1.45 1.45 0 0 0 2.9 0ZM19.5 13c0-2.6-1.4-3.8-3.3-3.8-1.5 0-2.2.8-2.6 1.4V9.4h-2.5v9.1h2.5v-4.6c0-1.2.2-2.4 1.7-2.4s1.5 1.4 1.5 2.5v4.5h2.5V13Z"
      />
    </svg>
  );
}

export const BRAND_LOGOS = {
  Instagram: InstagramLogo,
  LinkedIn: LinkedInLogo,
} as const;
