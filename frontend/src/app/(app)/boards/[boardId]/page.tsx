import type { Metadata } from 'next';

import { BoardView } from '@/features/boards/components/board-view';

export const metadata: Metadata = { title: 'Board' };

export default async function BoardPage({ params }: PageProps<'/boards/[boardId]'>) {
  const { boardId } = await params;
  return <BoardView boardId={boardId} />;
}
