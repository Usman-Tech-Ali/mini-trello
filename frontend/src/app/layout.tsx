import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';

import { Providers } from './providers';

import './globals.css';

// One engineered family for everything; hierarchy comes from weight, size and tracking.
const sans = IBM_Plex_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const mono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: {
    default: 'Mini Trello',
    template: '%s · Mini Trello',
  },
  description: 'Collaborative Kanban boards with real-time updates.',
};

// Matches --background, so mobile browser chrome blends with the page.
export const viewport: Viewport = {
  themeColor: '#f5f6f4',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
