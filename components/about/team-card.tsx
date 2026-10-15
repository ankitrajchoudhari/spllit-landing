import Image from 'next/image';
import {
  ArrowUpRight,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Twitter,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { blurProps } from '@/lib/image-blur';
import type { ProfileLink, TeamMember } from '@/content/about';

const ICONS: Record<ProfileLink['label'], LucideIcon> = {
  LinkedIn: Linkedin,
  GitHub: Github,
  X: Twitter,
  Instagram,
  Website: Globe,
};

/**
 * Stacked, slightly tilted bands of green — the same device as the people
 * illustration that heads this section — standing in for a photo. No
 * initials on it: set large they read as a placeholder avatar, and the name
 * is right underneath anyway.
 */
const GREENS = ['#8cc63f', '#3aaa4f', '#169447', '#0b7a3b', '#0b5e30'];
/** Alumni get the same bands in greys: the same team, a past tense. */
const GREYS = ['#c9c9c6', '#a9a9a5', '#8a8a86', '#6b6b67', '#4d4d4a'];

function Bands({ alumni }: { alumni?: boolean }) {
  const shades = alumni ? GREYS : GREENS;
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ background: shades[shades.length - 1] }}
    >
      {shades.map((shade, index) => (
        <span
          key={shade}
          className="absolute -left-[10%] h-[24%] w-[115%]"
          style={{
            top: `${index * 20 - 4}%`,
            background: shade,
            transform: `rotate(${index % 2 === 0 ? -2.5 : 2}deg)`,
            boxShadow: '0 6px 0 rgba(0,0,0,0.06)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * One person: a portrait that dissolves into the card, name and role set over
 * the fade, profile links underneath.
 *
 * The fade runs into the card's own surface colour rather than to black, so
 * the type sits on the card and not on a darkened photo. `featured` lays the
 * founder out sideways from sm up — photo on the left fading right — so the
 * section opens on one person rather than a row of equals.
 */
export function TeamCard({
  member,
  featured = false,
  alumni = false,
}: {
  member: TeamMember;
  featured?: boolean;
  /** Someone who has moved on: greyscale, and marked as such. */
  alumni?: boolean;
}) {
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-line bg-surface shadow-soft',
        // Faded, not hidden: someone who has left is still part of the record.
        alumni && 'opacity-75 transition-opacity duration-sheet hover:opacity-100',
        featured && 'sm:grid sm:grid-cols-[1.05fr_1fr]',
      )}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden',
          // A face needs height; a band of colour only needs enough to read
          // as a portrait, and at the photo's proportions it was a wall.
          member.photo ? 'aspect-[4/4.2]' : 'aspect-[16/10]',
          featured && 'sm:aspect-auto sm:min-h-[440px]',
        )}
      >
        {member.photo ? (
          <Image
            src={member.photo}
            alt={`${member.name}, ${member.role}`}
            fill
            sizes={
              featured
                ? '(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw'
                : '(min-width: 640px) 360px, 100vw'
            }
            {...blurProps(member.photo)}
            className={cn(
              'object-cover object-[50%_28%] transition-transform duration-700 ease-out group-hover:scale-[1.03]',
              alumni && 'grayscale',
            )}
          />
        ) : (
          <Bands alumni={alumni} />
        )}

        {/* Dissolve into the card. Downwards on every stacked card; sideways
            into the text column on the featured one once it sits beside it. */}
        <div
          aria-hidden
          className={cn(
            'absolute inset-x-0 bottom-0',
            member.photo ? 'h-[55%]' : 'h-[42%]',
            featured && 'sm:hidden',
          )}
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--surface) 55%, transparent) 50%, var(--surface) 100%)',
          }}
        />
        {featured && (
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 hidden w-[45%] sm:block"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--surface) 60%, transparent) 55%, var(--surface) 100%)',
            }}
          />
        )}
      </div>

      <div
        className={cn(
          'relative -mt-20 flex flex-1 flex-col px-6 pb-6 sm:px-7 sm:pb-7',
          featured && 'sm:mt-0 sm:justify-center sm:py-10 sm:pl-2 sm:pr-9',
        )}
      >
        <span
          className={cn(
            'inline-flex w-fit items-center rounded-full border border-line bg-surface px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em]',
            alumni ? 'text-ink-muted' : 'text-brand',
          )}
        >
          {member.role}
        </span>
        <h3
          className={cn(
            'mt-3 font-sans font-medium leading-[1.05] tracking-[-0.035em] text-ink',
            featured ? 'text-[30px] sm:text-[36px]' : 'text-[26px]',
          )}
        >
          {member.name}
        </h3>
        {member.bio && (
          <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-ink-muted">
            {member.bio}
          </p>
        )}

        {member.links.length > 0 && (
          <ul className={cn('flex flex-wrap gap-2 pt-5', !featured && 'mt-auto')}>
            {member.links.map(({ label, href }) => {
              const Icon = ICONS[label];
              return (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-ink px-4 text-[13.5px] font-medium text-canvas transition-opacity duration-snap hover:opacity-85"
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                    {label}
                    <ArrowUpRight aria-hidden className="h-3.5 w-3.5 opacity-70" />
                    <span className="sr-only">profile of {member.name} (opens in a new tab)</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}
