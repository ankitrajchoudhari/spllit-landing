'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion, MotionConfig } from 'motion/react';
import { ArrowLeft, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useClickOutside } from '@/lib/hooks/use-click-outside';

/**
 * Search that unfolds from a button into a field, then folds away again when
 * dismissed.
 *
 * It replaces the always-open search box the top bar used to carry. With the
 * sidebar gone the top bar is down to a logo and two controls, and a permanent
 * 400px input was the only thing still making it look like a toolbar rather
 * than a header.
 */

const transition = {
  type: 'spring',
  bounce: 0.1,
  duration: 0.2,
} as const;

function ToolbarButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'relative flex h-9 w-9 shrink-0 select-none appearance-none items-center justify-center',
        'rounded-lg text-ink-muted transition-colors',
        'hover:bg-line hover:text-ink active:scale-[0.98]',
      )}
    >
      {children}
    </button>
  );
}

export function SearchToolbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const submit = () => {
    const term = query.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
    setIsOpen(false);
  };

  return (
    <MotionConfig transition={transition}>
      <div ref={containerRef}>
        {/* Recessed, not white. The header is already a near-white surface, so
            a white panel on it had no edge at all — sinking the control is what
            makes it read as something you can act on. */}
        <div
          className={cn(
            'rounded-xl border border-line bg-surface-sunken transition-colors duration-snap',
            isOpen && 'border-line-strong bg-surface shadow-soft',
          )}
        >
          <motion.div
            // Animating a width rather than a scale keeps the neighbouring
            // controls sliding rather than being overlapped by the panel.
            animate={{ width: isOpen ? 320 : 53 }}
            initial={false}
          >
            <div className="overflow-hidden p-2">
              {!isOpen ? (
                /**
                 * Search only. The avatar that used to sit here was a second
                 * route to the profile, next to the account menu's own avatar —
                 * the same face twice in one header, which read as a bug.
                 * Identity belongs to the account menu; this control searches.
                 */
                <ToolbarButton onClick={() => setIsOpen(true)} ariaLabel="Search Spllit">
                  <Search className="h-5 w-5" />
                </ToolbarButton>
              ) : (
                <div className="flex gap-2">
                  <ToolbarButton onClick={() => setIsOpen(false)} ariaLabel="Close search">
                    <ArrowLeft className="h-5 w-5" />
                  </ToolbarButton>
                  <div className="relative w-full">
                    <input
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') submit();
                        // Escape folds the toolbar without navigating — the
                        // click-outside handler cannot see a key press.
                        if (event.key === 'Escape') setIsOpen(false);
                      }}
                      placeholder="People, group rides, events, places"
                      aria-label="Search"
                      className={cn(
                        'h-9 w-full rounded-lg border border-line bg-transparent px-2.5',
                        'text-sm text-ink outline-none placeholder:text-ink-subtle',
                        'focus:border-brand',
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}
