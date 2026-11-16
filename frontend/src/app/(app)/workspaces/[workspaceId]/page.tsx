import type { Metadata } from 'next';

import { WorkspaceDetail } from '@/features/workspaces/components/workspace-detail';

export const metadata: Metadata = { title: 'Workspace' };

export default async function WorkspacePage({ params }: PageProps<'/workspaces/[workspaceId]'>) {
  const { workspaceId } = await params;
  return <WorkspaceDetail workspaceId={workspaceId} />;
}
