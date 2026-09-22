import Image from 'next/image';

import { cn } from '@/lib/utils';
import { blurProps } from '@/lib/image-blur';

/**
 * A screenshot in a device bezel, drawn rather than baked into the asset.
 *
 * The screenshots arrive inconsistently — some raw, some already sitting in a
 * device render — which reads as unrelated pictures rather than screens of one
 * product. Cropping the baked frame off in the asset and drawing the bezel here
 * means every screen is the same device at the same scale, and the radius and
 * weight can be tuned in one place.
 */
export function PhoneFrame({
  src,
  alt,
  width = 740,
  height = 1600,
  sizes = '(min-width: 640px) 230px, 62vw',
  className,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[1.4rem] border-[5px] border-[#15181a] bg-[#15181a]',
        'shadow-float sm:rounded-[1.75rem] sm:border-[6px]',
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        {...blurProps(src)}
        className="block h-auto w-full"
      />
    </div>
  );
}
