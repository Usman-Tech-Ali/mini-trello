import type { AddMemberInput, CreateWorkspaceInput, WorkspaceRole } from '@mini-trello/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addMember,
  createWorkspace,
  getWorkspace,
  listMembers,
  listWorkspaces,
  removeMember,
  updateMemberRole,
} from '../api/workspaces.api';
import { workspaceKeys } from '../api/workspaces.keys';

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: ({ signal }) => listWorkspaces(signal),
  });
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: ({ signal }) => getWorkspace(workspaceId, signal),
  });
}

export function useWorkspaceMembers(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: ({ signal }) => listMembers(workspaceId, signal),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) => createWorkspace(input),
    onSuccess: (workspace) => {
      queryClient.setQueryData(workspaceKeys.detail(workspace.id), workspace);
      return queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export function useAddMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMemberInput) => addMember(workspaceId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
  });
}

/** Role changes can affect the current user's own role too, so the whole workspace is refreshed. */
export function useUpdateMemberRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      updateMemberRole(workspaceId, userId, role),
    onSettled: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
  });
}

export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId: string; isSelf: boolean }) =>
      removeMember(workspaceId, userId),
    onSettled: (_data, _error, { isSelf }) =>
      // After leaving, the caller navigates away; refetching this workspace would only 404.
      queryClient.invalidateQueries({
        queryKey: isSelf ? workspaceKeys.list() : workspaceKeys.members(workspaceId),
      }),
  });
}
