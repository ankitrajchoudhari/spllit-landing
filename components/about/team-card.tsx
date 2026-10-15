import Image from 'next/image';
import { Github, Globe, Instagram, Linkedin, Twitter, type LucideIcon } from 'lucide-react';

import type { ProfileLink, TeamMember } from '@/content/about';

const ICONS: Record<ProfileLink['label'], LucideIcon> = {
  LinkedIn: Linkedin,
  GitHub: Github,
  X: Twitter,
  Instagram,
  Website: Globe,
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * One person. The links are the point of the card: a reviewer checking that
 * the team is real follows them, so they are labelled in words as well as
 * icons, and open the profile itself rather than a search.
 */
export function TeamCard({ member }: { member: TeamMember }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-7">
      <div className="flex items-center gap-4">
        {member.photo ? (
          <Image
            src={member.photo}
            alt={member.name}
            width={128}
            height={128}
            sizes="64px"
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-muted font-display text-[20px] font-semibold tracking-[-0.02em] text-brand"
          >
            {initials(member.name)}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="font-sans text-[19px] font-medium leading-tight tracking-[-0.02em] text-ink">
            {member.name}
          </h3>
          <p className="mt-1 text-[13px] font-semibold uppercase tracking-[0.1em] text-brand">
            {member.role}
          </p>
        </div>
      </div>

      {member.bio && (
        <p className="mt-5 text-[15px] leading-relaxed text-ink-muted">{member.bio}</p>
      )}

      {member.links.length > 0 && (
        <ul className="mt-auto flex flex-wrap gap-2 pt-6">
          {member.links.map(({ label, href }) => {
            const Icon = ICONS[label];
            return (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-line px-3.5 text-[13.5px] font-medium text-ink transition-colors duration-snap hover:border-line-strong hover:bg-surface-sunken"
                >
                  <Icon aria-hidden className="h-4 w-4 text-ink-muted" />
                  {label}
                  <span className="sr-only">profile of {member.name} (opens in a new tab)</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
