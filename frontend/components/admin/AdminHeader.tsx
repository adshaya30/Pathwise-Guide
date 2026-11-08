'use client';

import React from 'react';
import Link from 'next/link';

interface AdminHeaderProps {
  title?: string;
  description?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, description }) => {
  return (
    <header className="h-16 bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-6 flex items-center justify-between sticky top-0 z-30">
      <div>
        {title && <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{title}</h2>}
        {description && <p className="text-xs text-gray-500 dark:text-zinc-400">{description}</p>}
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/"
          target="_blank"
          className="text-xs font-medium text-gray-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-zinc-800 hover:border-indigo-300 transition-colors"
        >
          <span>Student Portal</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-zinc-800">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
            AD
          </div>
          <div className="hidden sm:block text-left text-xs">
            <p className="font-semibold text-gray-800 dark:text-zinc-200">Administrator</p>
            <p className="text-gray-400 dark:text-zinc-500">Super Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
};

