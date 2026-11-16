'use client';

import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fragment } from 'react';

import { useBoard } from '@/features/boards/hooks/use-boards';
import { useWorkspace } from '@/features/workspaces/hooks/use-workspaces';

interface Crumb {
  label: string;
  href?: string;
}

export function AppBreadcrumb() {
  const params = useParams<{ workspaceId?: string; boardId?: string }>();
  const board = useBoard(params.boardId);
  const workspaceId = params.workspaceId ?? board.data?.workspaceId;
  const workspace = useWorkspace(workspaceId);

  const crumbs: Crumb[] = [{ label: 'Workspaces', href: '/workspaces' }];
  if (workspaceId) {
    crumbs.push({
      label: workspace.data?.name ?? '…',
      href: params.boardId ? `/workspaces/${workspaceId}` : undefined,
    });
  }
  if (params.boardId) crumbs.push({ label: board.data?.name ?? '…' });

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((crumb, i) => (
          <Fragment key={i}>
            {i > 0 && <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden="true" />}
            <li className="min-w-0 truncate">
              {crumb.href ? (
                <Link href={crumb.href} className="transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground" aria-current="page">
                  {crumb.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
