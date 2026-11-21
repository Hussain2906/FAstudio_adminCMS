'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { apiClient } from '../../lib/api/client';
import { adminRoutes } from '../../config/routes';

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    setIsPending(true);
    try {
      await apiClient.post<{ status: 'ok' }>('auth/logout');
    } finally {
      router.replace(adminRoutes.login);
      router.refresh();
    }
  }

  return <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending} onClick={logout} type="button"><LogOut aria-hidden="true" className="size-4" />{isPending ? 'Signing out…' : 'Sign out'}</button>;
}
