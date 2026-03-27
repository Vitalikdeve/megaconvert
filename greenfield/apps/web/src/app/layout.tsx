import '@megaconvert/design-system/styles.css';

import { IBM_Plex_Mono, Manrope, Sora } from 'next/font/google';

import { getAppRuntimeConfig } from '@/lib/config/app-runtime-config';
import { ThemeScript } from '@/lib/theme/theme-script';
import { AppProviders } from '@/providers/app-providers';

import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

import './globals.css';

const bodyFont = Manrope({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-body',
});

const displayFont = Sora({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-display',
});

const monoFont = IBM_Plex_Mono({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  description: 'Premium messenger frontend foundation for chats, meetings, files, search, and settings.',
  title: 'Megaconvert Messenger',
};

export default function RootLayout({ children }: PropsWithChildren) {
  const runtimeConfig = getAppRuntimeConfig();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}>
        <ThemeScript />
        <AppProviders runtimeConfig={runtimeConfig}>{children}</AppProviders>
      </body>
    </html>
  );
}
