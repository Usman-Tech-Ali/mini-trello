import { AppBreadcrumb } from '@/components/layout/app-breadcrumb';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AuthGuard } from '@/features/auth/components/auth-guard';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { ConnectionStatusBadge } from '@/features/realtime/components/connection-status';
import { RealtimeProvider } from '@/features/realtime/realtime-provider';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <AuthGuard>
      <RealtimeProvider>
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Skip to content
        </a>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
              <AppBreadcrumb />
              <ConnectionStatusBadge />
              <NotificationBell />
            </header>
            <main
              id="main-content"
              tabIndex={-1}
              className="flex min-h-0 flex-1 flex-col px-4 py-6 outline-none sm:px-6"
            >
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </RealtimeProvider>
    </AuthGuard>
  );
}
