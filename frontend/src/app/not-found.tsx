import Link from 'next/link';
import { BrandMark } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-4 text-center">
      <BrandMark />
      <div>
        <h1>Page not found</h1>
        <p className="muted mt-1.5">That screen does not exist.</p>
      </div>
      <Link href="/" className="btn btn-primary no-underline">Back to FastRev</Link>
    </main>
  );
}
