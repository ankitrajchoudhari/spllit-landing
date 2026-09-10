'use client';

import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'glass';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    // `disabled:opacity-60`, not `disabled:bg-brand/50`: an opacity modifier on
    // a token compiles to nothing here, so the disabled primary button was
    // rendering at full brand green and looked pressable. Fading the whole
    // element also dims the label with it, which the background-only version
    // never did.
    'bg-brand text-brand-fg hover:bg-brand-hover active:scale-[0.985] shadow-soft disabled:opacity-60',
  secondary:
    'bg-surface-sunken text-ink hover:bg-line active:scale-[0.985] border border-line',
  outline: 'border border-line-strong text-ink hover:bg-surface-sunken active:scale-[0.985]',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90 active:scale-[0.985]',
  glass: 'glass text-ink hover:bg-surface shadow-float',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-11 px-5 text-sm gap-2 rounded-lg',
  lg: 'h-[52px] px-7 text-[15px] gap-2.5 rounded-lg',
  icon: 'h-10 w-10 rounded-md',
};

/** Shared by Button and ButtonLink so the two can never drift apart. */
export function buttonClasses(
  variant: Variant = 'primary',
  size: Size = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
    'transition-all duration-snap disabled:pointer-events-none disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

/**
 * A link that looks like a button.
 *
 * Exists because navigation must render an anchor: wrapping <Button> in a
 * <Link> nests interactive elements, which is invalid HTML and costs the
 * middle-click, right-click and keyboard behaviour people expect from a link.
 * There is no `asChild` here on purpose — one extra component is cheaper than
 * a Slot implementation and the Radix dependency it needs.
 */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, 'className'> & {
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
