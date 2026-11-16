import { BellIcon, CheckIcon, SquareKanbanIcon, UsersIcon, ZapIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type Priority = 'High' | 'Medium' | 'Low';

interface PreviewCard {
  title: string;
  priority: Priority;
  assignee: string;
  due?: string;
  typing?: string;
  done?: boolean;
}

const priorityStyles: Record<Priority, string> = {
  High: 'bg-destructive/10 text-destructive',
  Medium: 'bg-warning/25 text-warning-foreground',
  Low: 'bg-success/15 text-success',
};

const columns: { title: string; count: number; cards: PreviewCard[] }[] = [
  {
    title: 'To do',
    count: 4,
    cards: [
      { title: 'Design onboarding flow', priority: 'High', assignee: 'AR', due: 'Nov 20' },
      { title: 'Write API docs', priority: 'Low', assignee: 'SK', due: 'Nov 24' },
    ],
  },
  {
    title: 'In progress',
    count: 2,
    cards: [
      { title: 'Real-time board sync', priority: 'High', assignee: 'UA', typing: 'Sara' },
      { title: 'Activity feed filters', priority: 'Medium', assignee: 'ZK', due: 'Nov 22' },
    ],
  },
  {
    title: 'Done',
    count: 7,
    cards: [
      { title: 'Set up CI pipeline', priority: 'Medium', assignee: 'UA', done: true },
      { title: 'Workspace roles', priority: 'Low', assignee: 'AR', done: true },
    ],
  },
];

const presence = [
  { initials: 'UA', className: 'bg-amber-300 text-amber-950' },
  { initials: 'SK', className: 'bg-sky-300 text-sky-950' },
  { initials: 'AR', className: 'bg-emerald-300 text-emerald-950' },
];

const highlights = [
  { icon: ZapIcon, label: 'Live updates' },
  { icon: SquareKanbanIcon, label: 'Drag & drop boards' },
  { icon: UsersIcon, label: 'Roles & permissions' },
];

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-5 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-accent-foreground',
        className,
      )}
    >
      {initials}
    </span>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-0.5" aria-hidden="true">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1 animate-typing rounded-full bg-primary"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function Card({ card }: { card: PreviewCard }) {
  return (
    <div className="space-y-2 rounded-lg bg-card p-2.5 text-card-foreground shadow-sm">
      <span
        className={cn(
          'inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold',
          priorityStyles[card.priority],
        )}
      >
        {card.priority}
      </span>
      <p
        className={cn(
          'text-[11px] leading-snug font-medium',
          card.done && 'text-muted-foreground line-through',
        )}
      >
        {card.title}
      </p>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        {card.typing ? (
          <span className="flex items-center gap-1 font-medium text-primary">
            {card.typing} is typing <TypingDots />
          </span>
        ) : card.done ? (
          <span className="flex items-center gap-0.5 font-medium text-success">
            <CheckIcon className="size-2.5" /> Done
          </span>
        ) : (
          <span>{card.due}</span>
        )}
        <Avatar initials={card.assignee} />
      </div>
    </div>
  );
}

/** Decorative product preview shown beside the sign-in and sign-up forms on large screens. */
export function AuthShowcase() {
  return (
    <aside className="relative hidden overflow-hidden bg-[linear-gradient(135deg,oklch(0.5_0.21_266),oklch(0.42_0.22_288)_55%,oklch(0.24_0.11_272))] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
      {/* Background texture */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] bg-size-[22px_22px]"
      />
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-24 size-96 rounded-full bg-fuchsia-400/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -left-20 size-96 rounded-full bg-sky-400/20 blur-3xl"
      />

      <div className="relative flex items-center gap-2 text-lg font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
          <SquareKanbanIcon className="size-5" aria-hidden="true" />
        </span>
        Mini Trello
      </div>

      {/* Product preview */}
      <div className="relative mx-auto w-full max-w-xl py-10" aria-hidden="true">
        <div className="animate-float rounded-2xl border border-white/20 bg-white/10 p-4 shadow-2xl shadow-black/20 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Product launch</p>
              <p className="text-[11px] text-white/70">Q4 roadmap · 13 tasks</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1.5">
                {presence.map((person) => (
                  <Avatar
                    key={person.initials}
                    initials={person.initials}
                    className={cn('size-6 text-[10px] ring-2 ring-white/40', person.className)}
                  />
                ))}
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" />
                </span>
                Live
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {columns.map((column) => (
              <div key={column.title} className="space-y-2 rounded-xl bg-black/15 p-2">
                <div className="flex items-center justify-between px-0.5 text-[11px] font-medium text-white/85">
                  {column.title}
                  <span className="rounded-full bg-white/15 px-1.5 text-[10px]">
                    {column.count}
                  </span>
                </div>
                {column.cards.map((card) => (
                  <Card key={card.title} card={card} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-2 -left-4 flex w-64 animate-float-delayed items-center gap-3 rounded-xl bg-card p-3 text-card-foreground shadow-xl xl:-left-8">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <BellIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold">Ayesha assigned you a task</p>
            <p className="truncate text-[11px] text-muted-foreground">Design onboarding flow</p>
          </div>
        </div>
      </div>

      <div className="relative space-y-5">
        <h2 className="max-w-md text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">
          Plan, track and ship together — in real time.
        </h2>
        <p className="max-w-md text-white/75">
          Boards your whole team can work on at once. Every change appears instantly for everyone.
        </p>
        <ul className="flex flex-wrap gap-2">
          {highlights.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20"
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
