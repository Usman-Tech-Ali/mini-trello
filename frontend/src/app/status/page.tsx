import type { Metadata } from 'next';

import { SystemStatus } from '@/features/system/components/system-status';

export const metadata: Metadata = {
  title: 'System status',
};

export default function StatusPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <SystemStatus />
    </main>
  );
}
