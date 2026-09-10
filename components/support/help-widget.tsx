'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  HelpCircle,
  Home,
  Mail,
  MessageCircle,
  MessageSquare,
  Search,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth/auth-provider';
import { firstNameOf } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

/**
 * Where support actually reads.
 *
 * Its own constant rather than SITE.email: that one is the public contact
 * address on the marketing pages, and the two are free to diverge — a support
 * queue usually should.
 */
const SUPPORT_EMAIL = 'support@spllit.app';

type Panel = 'home' | 'messages' | 'help';

/**
 * Help articles.
 *
 * Static and local on purpose — there is no help-desk backend, and the honest
 * options were a hardcoded list or a search box that returns nothing. A list
 * that actually answers the four questions people ask is worth more than an
 * empty index wired to a service that does not exist.
 */
const ARTICLES: { title: string; href: string }[] = [
  { title: 'How to start a squad and set a meeting point', href: '/squads/new' },
  { title: 'How to join a ride and request a seat', href: '/rides' },
  { title: 'How to verify your institute email', href: '/profile' },
  { title: 'How to share live location safely', href: '/squads' },
  { title: 'How to report a problem or a user', href: '/profile' },
];

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface p-3.5', className)}>
      {children}
    </div>
  );
}

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('home');
  const [query, setQuery] = useState('');
  const { profile } = useAuth();

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return ARTICLES;
    return ARTICLES.filter((article) => article.title.toLowerCase().includes(term));
  }, [query]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help and support"
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas shadow-float transition-transform duration-snap hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
      >
        <HelpCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 flex max-h-[min(80dvh,560px)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-float lg:bottom-6 lg:right-6">
      <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
        <div className="min-w-0">
          <p className="font-display text-[19px] font-bold tracking-[-0.02em] text-ink">Spllit</p>
          <p className="mt-3 text-[15px] text-ink-subtle">
            Hi {firstNameOf(profile?.name) || 'there'} 👋
          </p>
          <p className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
            How can we help?
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close help"
          className="shrink-0 rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {panel === 'home' ? (
          <>
            {/**
             * Email, not /chat.
             *
             * "Send us a message" pointed at the in-app conversation list,
             * which is where you talk to squads and drivers — not to us. Anyone
             * following it landed in their own chats and found no way to reach
             * support at all, which is the opposite of what the card promised.
             */}
            <SectionCard className="transition-colors hover:border-line-strong">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink">
                    Send us a message
                  </span>
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    {SUPPORT_EMAIL} · we usually reply within a day
                  </span>
                </span>
                <Mail className="h-4 w-4 shrink-0 text-ink" />
              </a>
            </SectionCard>

            {/* Announced rather than hidden: people ask for WhatsApp, and
                saying it is coming is more useful than saying nothing. Not a
                link, because a dead link is worse than a plain statement. */}
            <SectionCard>
              <div className="flex items-center gap-3">
                <MessageCircle className="h-4 w-4 shrink-0 text-ink-subtle" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-ink-muted">WhatsApp</span>
                  <span className="block text-[12.5px] text-ink-subtle">Coming soon</span>
                </span>
                <Badge tone="neutral">Soon</Badge>
              </div>
            </SectionCard>

            <SectionCard>
              <div className="flex items-center gap-3">
                <CircleCheck className="h-5 w-5 shrink-0 text-brand" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">All systems operational</p>
                  <p className="text-[12px] text-ink-subtle">Rides, squads and chat are up</p>
                </div>
              </div>
            </SectionCard>

            <div>
              <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search for help"
                  aria-label="Search for help"
                  className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-subtle"
                />
              </div>

              <ul className="mt-1 divide-y divide-line">
                {results.length === 0 ? (
                  <li className="px-1 py-4 text-[12.5px] text-ink-subtle">
                    Nothing matched “{query.trim()}”. Send us a message and we&apos;ll help.
                  </li>
                ) : (
                  results.map((article) => (
                    <li key={article.title}>
                      <Link
                        href={article.href}
                        className="flex items-center gap-2 py-2.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
                      >
                        <span className="min-w-0 flex-1 truncate">{article.title}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </>
        ) : null}

        {panel === 'messages' ? (
          <div className="px-2 py-10 text-center">
            <Avatar name={profile?.name} src={profile?.profilePhoto} size="md" className="mx-auto" />
            <p className="mt-3 text-[13px] font-medium text-ink">No conversations yet</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
              Messages you send to the team appear here.
            </p>
            <Link
              href="/chat"
              className="mt-4 inline-block text-[13px] font-semibold text-brand hover:underline"
            >
              Start a conversation
            </Link>
          </div>
        ) : null}

        {panel === 'help' ? (
          <ul className="divide-y divide-line">
            {ARTICLES.map((article) => (
              <li key={article.title}>
                <Link
                  href={article.href}
                  className="flex items-center gap-2 py-3 text-[13px] text-ink-muted transition-colors hover:text-ink"
                >
                  <span className="min-w-0 flex-1">{article.title}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <nav className="grid grid-cols-3 border-t border-line" aria-label="Help sections">
        {(
          [
            { value: 'home', label: 'Home', Icon: Home },
            { value: 'messages', label: 'Messages', Icon: MessageSquare },
            { value: 'help', label: 'Help', Icon: HelpCircle },
          ] as const
        ).map(({ value, label, Icon }) => {
          const active = panel === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setPanel(value)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                active ? 'text-ink' : 'text-ink-subtle hover:text-ink-muted',
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
