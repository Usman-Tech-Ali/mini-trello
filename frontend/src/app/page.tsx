import { SquareKanbanIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <SquareKanbanIcon className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Mini Trello</h1>
        <p className="max-w-sm text-muted-foreground">
          Collaborative Kanban boards with real-time updates.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/status">View system status</Link>
      </Button>
    </main>
  );
}
