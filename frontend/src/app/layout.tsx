import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Instrument_Sans, Instrument_Serif } from 'next/font/google';

import { Providers } from './providers';

import './globals.css';

const sans = Instrument_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
});

// Display face for large headlines only; it has a single weight.
const serif = Instrument_Serif({
  variable: '--font-display-serif',
  subsets: ['latin'],
  weight: '400',
});

const mono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
  themeColor: 'oklch(0.985 0.004 85)',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
