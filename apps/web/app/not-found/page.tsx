'use client';

import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <p className="text-[96px] font-bold leading-none tracking-tight text-indigo-600">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Page Not Found</h1>
        <p className="mt-3 text-slate-500">
          This route is not part of the implemented assessment flow.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
