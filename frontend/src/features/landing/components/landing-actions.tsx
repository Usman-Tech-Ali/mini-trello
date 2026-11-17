'use client';

import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSession } from '@/features/auth/hooks/use-session';

/**
 * Sign-in / sign-up links for visitors, or a single "Open workspaces" link for signed-in users.
 * While the session is loading (or the API is waking up) visitors still see the guest links.
 */
export function LandingActions({
  size = 'default',
  onDark = false,
  className,
}: {
  size?: 'default' | 'lg';
  /** Light outline button for use on the dark hero background. */
  onDark?: boolean;
  className?: string;
}) {
  const { data: user } = useSession();
  const buttonClass = size === 'lg' ? 'h-11 px-5 text-base' : undefined;
  const outlineClass = onDark
    ? 'border-white/25 bg-transparent text-[#e6efea] hover:bg-white/10 hover:text-white'
    : undefined;
  const primaryClass = onDark ? 'bg-[#e6efea] text-[#123a2d] hover:bg-white' : undefined;

  if (user) {
    return (
      <div className={cn('flex flex-wrap items-center gap-3', className)}>
        <Button asChild className={cn(buttonClass, primaryClass)}>
          <Link href="/workspaces">
            Open your workspaces <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <Button asChild variant="outline" className={cn(buttonClass, outlineClass)}>
        <Link href="/login">Sign in</Link>
      </Button>
      <Button asChild className={cn(buttonClass, primaryClass)}>
        <Link href="/register">
          Get started <ArrowRightIcon aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
