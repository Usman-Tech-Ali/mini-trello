import type {
  AddMemberInput,
  CreateWorkspaceInput,
  MemberDto,
  MemberListResponse,
  MemberResponse,
  WorkspaceDto,
  WorkspaceListResponse,
  WorkspaceResponse,
  WorkspaceRole,
} from '@mini-trello/shared';

import { apiRequest } from '@/lib/api/client';

const base = '/api/workspaces';

export async function listWorkspaces(signal?: AbortSignal): Promise<WorkspaceDto[]> {
  const { workspaces } = await apiRequest<WorkspaceListResponse>(base, { signal });
  return workspaces;
}

export async function getWorkspace(id: string, signal?: AbortSignal): Promise<WorkspaceDto> {
  const { workspace } = await apiRequest<WorkspaceResponse>(`${base}/${id}`, { signal });
  return workspace;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceDto> {
  const { workspace } = await apiRequest<WorkspaceResponse>(base, { method: 'POST', body: input });
  return workspace;
}

export async function listMembers(workspaceId: string, signal?: AbortSignal): Promise<MemberDto[]> {
  const { members } = await apiRequest<MemberListResponse>(`${base}/${workspaceId}/members`, {
    signal,
  });
  return members;
}

export async function addMember(workspaceId: string, input: AddMemberInput): Promise<MemberDto> {
  const { member } = await apiRequest<MemberResponse>(`${base}/${workspaceId}/members`, {
    method: 'POST',
    body: input,
  });
  return member;
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<MemberDto> {
  const { member } = await apiRequest<MemberResponse>(`${base}/${workspaceId}/members/${userId}`, {
    method: 'PATCH',
    body: { role },
  });
  return member;
}

export function removeMember(workspaceId: string, userId: string): Promise<void> {
  return apiRequest<void>(`${base}/${workspaceId}/members/${userId}`, { method: 'DELETE' });
}
