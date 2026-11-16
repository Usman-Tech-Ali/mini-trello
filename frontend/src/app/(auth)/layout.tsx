import { AuthLayout } from '@/features/auth/components/auth-layout';
import { GuestGuard } from '@/features/auth/components/auth-guard';

export default function AuthRouteLayout({ children }: LayoutProps<'/'>) {
  return (
    <AuthLayout>
      <GuestGuard>{children}</GuestGuard>
    </AuthLayout>
  );
}
