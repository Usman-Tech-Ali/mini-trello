import { SquareKanbanIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { AuthShowcase } from './auth-showcase';

/** Split-screen layout: product showcase on the left (large screens), form on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <AuthShowcase />
      <main className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center gap-2 font-semibold lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <SquareKanbanIcon className="size-5" aria-hidden="true" />
          </span>
          Mini Trello
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Mini Trello
        </p>
      </main>
    </div>
  );
}

export function AuthHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
