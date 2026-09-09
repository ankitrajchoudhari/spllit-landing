import type { Metadata } from 'next';

import './globals.css';
import { Providers } from '@/app/providers';
import { Guard } from '@/components/guard';

export const metadata: Metadata = {
  title: 'Spllit Console',
  description: 'Operations and administration for Spllit.',
  // Belt and braces with the header in next.config.mjs. An admin console
  // appearing in search results is a straightforward information leak about
  // what the platform runs.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Guard>{children}</Guard>
        </Providers>
      </body>
    </html>
  );
}
