import type { Metadata } from 'next';
import { BrandMark } from '@/components/ui';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[1fr_minmax(0,34rem)]">
      {/*
        The signature surface carries the product's claim; the form sits on plain canvas beside it.
        On a phone the panel would push the form below the fold, so it drops out entirely.
      */}
      <aside className="hidden flex-col justify-between bg-surface-dark p-12 text-canvas lg:flex">
        <BrandMark large inverted />
        <div>
          <p className="text-page max-w-[20ch]">An empty chair is the most expensive thing in a clinic.</p>
          <p className="mt-5 max-w-prose" style={{ color: '#9aa3b0' }}>
            FastRev scores every appointment for no-show risk, schedules the reminders that match, and
            tells your front desk who to call first.
          </p>
        </div>
        <p style={{ color: '#9aa3b0' }}>Staff access only.</p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-6 py-16 lg:min-h-0">
        <LoginForm />
      </main>
    </div>
  );
}
