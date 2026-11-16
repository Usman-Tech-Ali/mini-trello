'use client';

import type { MemberDto, WorkspaceDto } from '@mini-trello/shared';
import {
  EllipsisVerticalIcon,
  LogOutIcon,
  ShieldIcon,
  UserIcon,
  UserMinusIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { ErrorState } from '@/components/feedback/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { useCurrentUser } from '@/features/auth/hooks/use-session';

import { useRemoveMember, useUpdateMemberRole, useWorkspaceMembers } from '../hooks/use-workspaces';
import { AddMemberForm } from './add-member-form';

type PendingRemoval = { member: MemberDto; isSelf: boolean } | null;

function showError(error: Error) {
  toast.error(error.message);
}

export function MembersPanel({ workspace }: { workspace: WorkspaceDto }) {
  const currentUser = useCurrentUser();
  const router = useRouter();
  const isAdmin = workspace.role === 'admin';
  const membersQuery = useWorkspaceMembers(workspace.id);
  const updateRole = useUpdateMemberRole(workspace.id);
  const removeMember = useRemoveMember(workspace.id);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval>(null);

  const changeRole = (member: MemberDto) => {
    const role = member.role === 'admin' ? 'member' : 'admin';
    updateRole.mutate(
      { userId: member.userId, role },
      {
        onSuccess: (updated) => {
          toast.success(`${updated.name} is now ${role === 'admin' ? 'an admin' : 'a member'}`);
        },
        onError: showError,
      },
    );
  };

  const confirmRemoval = () => {
    if (!pendingRemoval) return;
    const { member, isSelf } = pendingRemoval;
    removeMember.mutate(
      { userId: member.userId, isSelf },
      {
        onSuccess: () => {
          setPendingRemoval(null);
          if (isSelf) {
            toast.success(`You left ${workspace.name}`);
            router.replace('/workspaces');
          } else {
            toast.success(`${member.name} was removed from the workspace`);
          }
        },
        onError: (error) => {
          setPendingRemoval(null);
          showError(error);
        },
      },
    );
  };

  const members = membersQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Members{members ? ` (${members.length})` : ''}</h2>
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? 'Add registered users and manage their roles.'
            : 'People who can see this workspace.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {isAdmin && <AddMemberForm workspaceId={workspace.id} />}

        {membersQuery.isPending ? (
          <div className="space-y-3" aria-label="Loading members">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : membersQuery.isError ? (
          <ErrorState
            title="Could not load members"
            message={membersQuery.error.message}
            onRetry={() => void membersQuery.refetch()}
            isRetrying={membersQuery.isFetching}
          />
        ) : (
          <ul className="divide-y">
            {membersQuery.data.map((member) => {
              const isSelf = member.userId === currentUser.id;
              const canManage = isAdmin && !isSelf;
              return (
                <li key={member.userId} className="flex items-center gap-3 py-3">
                  <UserAvatar name={member.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.name}
                      {isSelf && <span className="font-normal text-muted-foreground"> (you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                    {member.role === 'admin' ? 'Admin' : 'Member'}
                  </Badge>
                  {(canManage || isSelf) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${member.name}`}
                          disabled={updateRole.isPending || removeMember.isPending}
                        >
                          <EllipsisVerticalIcon aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canManage && (
                          <>
                            <DropdownMenuItem onSelect={() => changeRole(member)}>
                              {member.role === 'admin' ? (
                                <UserIcon aria-hidden="true" />
                              ) : (
                                <ShieldIcon aria-hidden="true" />
                              )}
                              {member.role === 'admin' ? 'Make member' : 'Make admin'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setPendingRemoval({ member, isSelf: false })}
                            >
                              <UserMinusIcon aria-hidden="true" />
                              Remove from workspace
                            </DropdownMenuItem>
                          </>
                        )}
                        {isSelf && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setPendingRemoval({ member, isSelf: true })}
                          >
                            <LogOutIcon aria-hidden="true" />
                            Leave workspace
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
        title={
          pendingRemoval?.isSelf
            ? `Leave ${workspace.name}?`
            : `Remove ${pendingRemoval?.member.name ?? 'member'}?`
        }
        description={
          pendingRemoval?.isSelf
            ? 'You will lose access to this workspace and its boards until an admin adds you again.'
            : 'They will lose access to this workspace and its boards. Their tasks will become unassigned.'
        }
        confirmLabel={pendingRemoval?.isSelf ? 'Leave' : 'Remove'}
        onConfirm={confirmRemoval}
        isPending={removeMember.isPending}
      />
    </Card>
  );
}
