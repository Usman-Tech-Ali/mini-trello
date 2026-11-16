import { SquareKanbanIcon } from 'lucide-react';
import Link from 'next/link';

import { UserMenu } from './user-menu';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/workspaces" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <SquareKanbanIcon className="size-4" aria-hidden="true" />
          </span>
          Mini Trello
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
