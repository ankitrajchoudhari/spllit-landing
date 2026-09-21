import Link from 'next/link';
import Image from 'next/image';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '#rides', label: 'Ride Together' },
      { href: '#squads', label: 'Group Rides' },
      { href: '#events', label: 'Events' },
      { href: '#soon', label: 'Coming soon' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/careers', label: 'Careers' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacy' },
      { href: '/legal/terms', label: 'Terms' },
      { href: '/safety', label: 'Safety' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/logo-icon.png"
                alt="Spllit"
                width={30}
                height={30}
                className="h-[30px] w-[30px] rounded-md"
              />
              <span className="font-display text-[16px] font-semibold tracking-[-0.02em] text-ink">
                Spllit
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ink-muted">
              A location-based community platform. Rides, group rides, events and
              communities — on one map.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-ink-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-ink-subtle">
            © {new Date().getFullYear()} Spllit. All rights reserved.
          </p>
          <p className="text-[12.5px] text-ink-subtle">Built in Chennai.</p>
        </div>
      </div>
    </footer>
  );
}
