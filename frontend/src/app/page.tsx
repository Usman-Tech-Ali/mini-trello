import {
  BellIcon,
  HistoryIcon,
  ListFilterIcon,
  ShieldCheckIcon,
  SquareKanbanIcon,
  UsersIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ProductPreview } from '@/components/product-preview';
import { LandingActions } from '@/features/landing/components/landing-actions';

export const metadata: Metadata = {
  title: { absolute: 'Mini Trello — collaborative task boards' },
};

const features: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ZapIcon,
    title: 'Real-time collaboration',
    text: 'Moves, edits and comments appear instantly for everyone on the board, with live presence and typing indicators.',
  },
  {
    icon: SquareKanbanIcon,
    title: 'Drag & drop boards',
    text: 'Organise work in columns, reorder tasks by dragging, and set priority, assignee and due date.',
  },
  {
    icon: UsersIcon,
    title: 'Workspaces & roles',
    text: 'Invite your team to a workspace. Admins manage members and boards; members get on with the work.',
  },
  {
    icon: BellIcon,
    title: 'Notifications',
    text: 'Get told when a task is assigned to you or taken off you, and when someone @mentions you in a comment.',
  },
  {
    icon: ListFilterIcon,
    title: 'Activity feed',
    text: 'See who changed what on every board, filtered by person or action, loaded page by page.',
  },
  {
    icon: HistoryIcon,
    title: 'Task history',
    text: 'Every change to a task is versioned. View any earlier version and restore it in one click.',
  },
];

const REPO_URL = 'https://github.com/Usman-Tech-Ali/mini-trello';

function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-lg font-semibold">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
        <SquareKanbanIcon className="size-5" aria-hidden="true" />
      </span>
      Mini Trello
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#123a2d] text-[#e6efea]">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] bg-size-[24px_24px]"
          />
          <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
            <Link href="/" aria-label="Mini Trello home">
              <Logo />
            </Link>
            <LandingActions onDark />
          </header>
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-2 lg:pt-12 lg:pb-24">
            <div className="space-y-6">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium">
                <ShieldCheckIcon className="size-3.5 text-[#7fc4a5]" aria-hidden="true" />
                Kanban for small teams
              </p>
              <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
                Plan, track and ship together, in real time.
              </h1>
              <p className="max-w-lg text-lg text-[#e6efea]/75">
                Boards your whole team can work on at once. Every change appears instantly for
                everyone, and nothing gets lost when two people edit the same task.
              </p>
              <LandingActions size="lg" onDark />
            </div>
            <ProductPreview className="hidden sm:block" />
          </div>
        </section>

        {/* Features */}
        <section
          aria-labelledby="features-heading"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20"
        >
          <div className="mb-10 max-w-2xl space-y-3">
            <h2 id="features-heading" className="text-3xl font-semibold tracking-tight">
              Everything a team board needs
            </h2>
            <p className="text-muted-foreground">
              Built with Next.js, Express, Socket.IO and MongoDB.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="space-y-3 rounded-xl border bg-card p-5 text-card-foreground"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span>© {new Date().getFullYear()} Mini Trello</span>
          <nav className="flex gap-5">
            <Link href="/status" className="hover:text-foreground">
              System status
            </Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Source on GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
