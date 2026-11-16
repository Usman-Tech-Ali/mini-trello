import { AppHeader } from '@/components/layout/app-header';
import { AuthGuard } from '@/features/auth/components/auth-guard';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <AuthGuard>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:py-8">
        {children}
      </main>
    </AuthGuard>
  );
}
