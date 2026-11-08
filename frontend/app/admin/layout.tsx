import React, { Suspense } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const metadata = {
  title: 'PathWise UGC Admin Portal',
  description: 'PathWise University Admissions Handbook Admin Portal & Academic Management',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50/50 dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 font-sans">
      <Suspense fallback={<aside className="w-64 bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800" />}>
        <AdminSidebar />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading admin view...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
