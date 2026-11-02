import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'FastRev', template: '%s · FastRev' },
  description: 'Clinic patient management with AI-powered no-show risk prediction.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#181d26',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
