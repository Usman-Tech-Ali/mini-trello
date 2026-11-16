'use client';

import { LayoutGridIcon, SquareKanbanIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useBoard, useBoards } from '@/features/boards/hooks/use-boards';
import { useWorkspaces } from '@/features/workspaces/hooks/use-workspaces';
import { gradientFor, initialOf } from '@/lib/colors';
import { cn } from '@/lib/utils';

import { UserMenu } from './user-menu';

/** The workspace being viewed: from the URL, or from the board being viewed. */
function useActiveWorkspaceId(): string | undefined {
  const params = useParams<{ workspaceId?: string; boardId?: string }>();
  const board = useBoard(params.boardId);
  return params.workspaceId ?? board.data?.workspaceId;
}

function WorkspaceBoards({ workspaceId }: { workspaceId: string }) {
  const params = useParams<{ boardId?: string }>();
  const boards = useBoards(workspaceId);

  if (boards.isPending) {
    return (
      <SidebarMenuSub>
        <SidebarMenuSkeleton />
      </SidebarMenuSub>
    );
  }
  if (!boards.data?.length) return null;
  return (
    <SidebarMenuSub>
      {boards.data.map((board) => (
        <SidebarMenuSubItem key={board.id}>
          <SidebarMenuSubButton asChild isActive={params.boardId === board.id}>
            <Link href={`/boards/${board.id}`}>
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full bg-linear-to-br',
                  gradientFor(board.id),
                )}
              />
              <span className="truncate">{board.name}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const workspaces = useWorkspaces();
  const activeWorkspaceId = useActiveWorkspaceId();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/workspaces">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <SquareKanbanIcon className="size-4" aria-hidden="true" />
                </span>
                <span className="font-semibold">Mini Trello</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/workspaces'}
                  tooltip="All workspaces"
                >
                  <Link href="/workspaces">
                    <LayoutGridIcon aria-hidden="true" />
                    <span>All workspaces</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaces.isPending &&
                Array.from({ length: 3 }, (_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              {workspaces.data?.map((workspace) => {
                const active = workspace.id === activeWorkspaceId;
                return (
                  <SidebarMenuItem key={workspace.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/workspaces/${workspace.id}`}
                      tooltip={workspace.name}
                    >
                      <Link href={`/workspaces/${workspace.id}`}>
                        <span
                          className={cn(
                            'flex size-5 shrink-0 items-center justify-center rounded bg-linear-to-br text-[10px] font-semibold text-white',
                            gradientFor(workspace.id),
                          )}
                          aria-hidden="true"
                        >
                          {initialOf(workspace.name)}
                        </span>
                        <span className="truncate">{workspace.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    {active && <WorkspaceBoards workspaceId={workspace.id} />}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
