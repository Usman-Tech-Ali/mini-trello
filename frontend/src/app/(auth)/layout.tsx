import { GuestGuard } from '@/features/auth/components/auth-guard';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <GuestGuard>{children}</GuestGuard>
    </main>
  );
}
