'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { BrandMark } from '@/components/ui';
import { NAV_ITEMS } from '@/lib/auth/roles';
import { authStore, useAuth } from '@/lib/auth/store';

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round">
      {open
        ? <path d="M5 5l10 10M15 5L5 15" />
        : <><path d="M3 6h14" /><path d="M3 10h14" /><path d="M3 14h14" /></>}
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = auth.status === 'ready' ? auth.session?.user : undefined;
  const items = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          // Closing here, rather than on a pathname effect, keeps the open menu off the screen
          // the user just chose without a second render pass.
          <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`rounded-sm px-3 py-2 text-body no-underline transition-colors ${active
              ? 'border border-hairline bg-canvas font-medium text-ink'
              : 'border border-transparent text-body hover:text-ink'}`}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="flex flex-col gap-3 border-t border-hairline pt-4">
      <div className="min-w-0">
        <p className="truncate text-body font-medium text-ink" title={user?.email}>{user?.email}</p>
        <p className="meta capitalize">{user?.role}</p>
      </div>
      <button className="btn btn-sm btn-secondary" onClick={() => authStore.signOut()}>Sign out</button>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* A second neutral layer separates the chrome from the content surface. */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-hairline bg-surface-soft p-6 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="flex flex-col gap-8">
          <BrandMark />
          {nav}
        </div>
        {account}
      </aside>

      <header className="flex items-center justify-between border-b border-hairline bg-surface-soft px-4 py-3 lg:hidden">
        <BrandMark />
        <button className="btn btn-sm btn-secondary" aria-expanded={menuOpen} aria-controls="mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}>
          <MenuIcon open={menuOpen} />
          Menu
        </button>
      </header>
      {menuOpen && (
        <div id="mobile-nav" className="flex flex-col gap-5 border-b border-hairline bg-surface-soft p-6 lg:hidden">
          {nav}
          {account}
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
