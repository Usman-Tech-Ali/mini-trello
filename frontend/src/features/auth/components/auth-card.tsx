import { SquareKanbanIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AuthCardProps {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}

export function AuthCard({ title, description, footer, children }: AuthCardProps) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <div className="flex items-center gap-2 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <SquareKanbanIcon className="size-5" aria-hidden="true" />
        </span>
        Mini Trello
      </div>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>{title}</h1>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{footer}</p>
    </div>
  );
}
