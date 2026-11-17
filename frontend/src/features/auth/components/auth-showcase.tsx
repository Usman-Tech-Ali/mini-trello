import { SquareKanbanIcon, UsersIcon, ZapIcon } from 'lucide-react';

import { ProductPreview } from '@/components/product-preview';

const highlights = [
  { icon: ZapIcon, label: 'Live updates' },
  { icon: SquareKanbanIcon, label: 'Drag & drop boards' },
  { icon: UsersIcon, label: 'Roles & permissions' },
];

/** Decorative product preview shown beside the sign-in and sign-up forms on large screens. */
export function AuthShowcase() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#123a2d] p-10 text-[#e6efea] lg:flex lg:flex-col lg:justify-between xl:p-14">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.08)_1px,transparent_1px)] bg-size-[24px_24px]"
      />

      <div className="relative flex items-center gap-2.5 text-lg font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <SquareKanbanIcon className="size-5" aria-hidden="true" />
        </span>
        Mini Trello
      </div>

      <ProductPreview className="py-10" />

      <div className="relative space-y-5">
        <h2 className="max-w-md text-3xl leading-tight font-semibold tracking-tight text-balance xl:text-4xl">
          Plan, track and ship together, in real time.
        </h2>
        <p className="max-w-md text-[#e6efea]/75">
          Boards your whole team can work on at once. Every change appears instantly for everyone.
        </p>
        <ul className="flex flex-wrap gap-2">
          {highlights.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-medium"
            >
              <Icon className="size-3.5 text-brand" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
