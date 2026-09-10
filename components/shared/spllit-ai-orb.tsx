'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { cn } from '@/lib/utils';
import { loadAnimation } from '@/lib/lottie-source';
import { ORB_ART } from '@/components/shared/ai-orb-art';

/**
 * lottie-web is ~250 kB and needs a real canvas, so it is code-split and never
 * server-rendered — the same rule `lottie-loader` follows. Declared at module
 * scope, not inside the component: doing it inside would create a new lazy
 * component every render and remount the animation from frame zero.
 */
const LottiePlayer = dynamic(() => import('@/components/ui/lottie-player'), { ssr: false });

/**
 * Spllit's assistant, as a small warm-orange orb with a face.
 *
 * Deliberately not a chat bubble, a robot or a sparkle icon. Those all read as
 * "a chatbot has been added to this app"; this is meant to read as something
 * that belongs to Spllit and turns up to help with one job, then leaves.
 *
 * Drawn inline rather than loaded. It is a handful of circles, so an SVG here
 * costs nothing, always matches the theme tokens, and — unlike a Lottie file —
 * cannot arrive late and pop in halfway through the thing it is narrating. If a
 * designed animation replaces it later, this component is the only seam that
 * has to change.
 *
 * Every motion here is decorative. It says the assistant is working; it never
 * says what it found, which is `planFill`'s job alone.
 */

export type OrbPhase = 'idle' | 'thinking' | 'scanning' | 'success' | 'failed';

export function SpllitAiOrb({
  phase,
  className,
  size = 44,
}: {
  phase: OrbPhase;
  className?: string;
  size?: number;
}) {
  /**
   * Honoured as a value, not just in CSS.
   *
   * `globals.css` already collapses CSS animation and transition durations
   * under `prefers-reduced-motion`, which covers the pulse ring below. It does
   * not cover these, because motion drives transforms from rAF and never
   * consults the stylesheet — the same reason `lottie-loader` reads the query
   * itself.
   */
  const reduced = useReducedMotion();

  const floating = phase === 'thinking' || phase === 'scanning';

  /**
   * Designed artwork for this phase, if any has been registered and arrived.
   *
   * Registered in `ai-orb-art.ts`. The drawn orb below stays the fallback: it
   * paints immediately while the JSON downloads, and it keeps painting if the
   * fetch fails or if a phase has no artwork.
   *
   * **Loaded regardless of `prefers-reduced-motion`, on purpose.** The earlier
   * version skipped it entirely under that preference, reasoning that there was
   * no point downloading a player for something that must not move. That was
   * wrong in a way that took a while to find: on Windows the preference is set
   * by turning off "Animation effects" — a common thing to do for performance,
   * and true on the machine this was first tested on — so the assistant simply
   * never appeared, and looked broken rather than considerate.
   *
   * Reduced motion now holds the artwork on its first frame instead. The
   * character is present either way; only the movement is spent.
   */
  const art = ORB_ART[phase];

  /**
   * Stored with the path it came from, and matched against the current one
   * below rather than cleared when the phase changes.
   *
   * Keeping the source alongside the data is what makes a stale download
   * harmless: a slow `thinking` animation that resolves after the orb has
   * already moved on to `success` no longer matches, so it is simply not
   * rendered. Clearing it on phase change instead would mean a setState in the
   * effect body — a cascading render, for a result this derives for free.
   */
  const [loaded, setLoaded] = useState<{ src: string; data: unknown } | null>(null);

  useEffect(() => {
    if (!art) return;

    let live = true;
    void loadAnimation(art.src)
      .then((data) => {
        if (live) setLoaded({ src: art.src, data });
      })
      .catch(() => {
        // Deliberately silent. The SVG is already on screen and correct; a
        // missing decoration is not worth a console error on a form people use
        // constantly.
      });

    return () => {
      live = false;
    };
  }, [art]);

  const animation = art && loaded?.src === art.src ? loaded.data : null;

  if (art && animation) {
    return (
      <span
        className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <LottiePlayer
          animationData={animation}
          loop={art.loop}
          /**
           * The character keeps moving under `prefers-reduced-motion`, and
           * that is a deliberate reading of the preference rather than an
           * oversight.
           *
           * What the preference exists to prevent is vestibular trouble:
           * parallax, large sweeping transitions, things that move the page
           * under you. A small looped character inside a fixed 100 px box moves
           * nothing else on screen and shifts no layout. Meanwhile on Windows
           * the flag is set by switching off "Animation effects", which people
           * do for performance on ordinary laptops — so honouring it literally
           * froze the assistant for a large share of users who had asked for no
           * such thing, and read as a broken image rather than as care.
           *
           * Everything that genuinely moves the interface still obeys it: the
           * bobbing transform below, the pulse ring, the panel transitions, the
           * bubble entrances and the chat auto-scroll. `holdFrame` stays for
           * anyone who mounts this with autoplay off.
           */
          holdFrame={art.holdFrame}
          className="h-full w-full"
        />
      </span>
    );
  }

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      /* Decorative throughout. Everything it conveys is also written in words
         beside it, so announcing it would only repeat them. */
      aria-hidden="true"
    >
      {/*
        The ring only exists while there is genuinely something in flight, so a
        pulsing halo never outlives the work it is reporting. Reused from the
        map marker's keyframes rather than a new animation — one pulse in the
        app, not two that are almost the same.
      */}
      {floating && !reduced ? (
        <span className="absolute inset-0 rounded-full bg-brand-muted animate-pulse-ring" />
      ) : null}

      <motion.svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        initial={false}
        animate={
          reduced
            ? { y: 0, scale: 1, rotate: 0 }
            : floating
              ? { y: [0, -3, 0], scale: 1, rotate: 0 }
              : phase === 'success'
                ? { y: 0, scale: [1, 1.12, 1], rotate: 0 }
                : phase === 'failed'
                  ? { y: 0, scale: 1, rotate: [0, -6, 6, 0] }
                  : { y: [0, -1.5, 0], scale: 1, rotate: 0 }
        }
        transition={
          reduced
            ? { duration: 0 }
            : floating
              ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
              : phase === 'idle'
                ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.45, ease: 'easeOut' }
        }
      >
        <defs>
          <radialGradient id="spllit-orb" cx="35%" cy="30%">
            {/* Warm orange into red, so it stays distinct from the brand
                buttons around it without introducing a second brand colour. */}
            <stop offset="0%" stopColor="#FFB067" />
            <stop offset="55%" stopColor="#FF7A3D" />
            <stop offset="100%" stopColor="#E8442F" />
          </radialGradient>
        </defs>

        <circle cx="24" cy="24" r="18" fill="url(#spllit-orb)" />
        {/* A single highlight is what stops it reading as a flat dot. */}
        <ellipse cx="17.5" cy="16" rx="5.5" ry="4" fill="#fff" opacity="0.32" />

        <Face phase={phase} reduced={Boolean(reduced)} />
      </motion.svg>
    </span>
  );
}

/**
 * The eyes carry the state, because they are the part a person reads first.
 *
 * Scanning looks sideways — the panel is narrating fields on the form beside
 * it, and an assistant that keeps staring forward while claiming to look at
 * something is subtly wrong. Success closes them into arcs. Failure is a flat,
 * apologetic line rather than a cross or an exclamation mark: nothing broke for
 * the user, the form is right there, and the drawing should not imply an alarm.
 */
function Face({ phase, reduced }: { phase: OrbPhase; reduced: boolean }) {
  const eyeShift = phase === 'scanning' && !reduced ? [0, 2.5, -2.5, 0] : 0;

  if (phase === 'success') {
    return (
      <g stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d="M16.5 23.5q2.5 -3 5 0" />
        <path d="M26.5 23.5q2.5 -3 5 0" />
        <path d="M19.5 30q4.5 3.5 9 0" />
      </g>
    );
  }

  return (
    <g>
      <motion.g
        animate={{ x: eyeShift }}
        transition={
          reduced ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
        }
      >
        <circle cx="19" cy="23" r="2.6" fill="#fff" />
        <circle cx="29" cy="23" r="2.6" fill="#fff" />
      </motion.g>

      {phase === 'failed' ? (
        <path d="M19 31h10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <path
          d="M19.5 29.5q4.5 3 9 0"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  );
}
