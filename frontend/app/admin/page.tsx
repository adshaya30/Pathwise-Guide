'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDashboardStats } from '@/services/adminApi';
import { DashboardStats } from '@/types/admin';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getDashboardStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Admin Control Center"
        description="University Grants Commission (UGC) Handbook Extraction & Academic Data Management"
      />

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={loadStats}
            className="px-3 py-1 bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 rounded-md text-xs font-semibold hover:bg-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">Total Uploaded</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-zinc-100">
            {isLoading ? '...' : stats?.totalUploaded ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-emerald-100 dark:border-emerald-950/50 p-4 rounded-xl shadow-xs">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Completed</p>
          <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">
            {isLoading ? '...' : stats?.completed ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-blue-100 dark:border-blue-950/50 p-4 rounded-xl shadow-xs">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Processing</p>
          <p className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-300">
            {isLoading ? '...' : stats?.processing ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-rose-100 dark:border-rose-950/50 p-4 rounded-xl shadow-xs">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Failed</p>
          <p className="text-2xl font-bold mt-1 text-rose-700 dark:text-rose-300">
            {isLoading ? '...' : stats?.failed ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-amber-100 dark:border-amber-950/50 p-4 rounded-xl shadow-xs">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Pending Review</p>
          <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-300">
            {isLoading ? '...' : stats?.pendingVerification ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-emerald-100 dark:border-emerald-950/50 p-4 rounded-xl shadow-xs">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Approved</p>
          <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">
            {isLoading ? '...' : stats?.approved ?? 0}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-950 border border-rose-100 dark:border-rose-950/50 p-4 rounded-xl shadow-xs">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Rejected</p>
          <p className="text-2xl font-bold mt-1 text-rose-700 dark:text-rose-300">
            {isLoading ? '...' : stats?.rejected ?? 0}
          </p>
        </div>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link
          href="/admin/documents"
          className="group p-5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors">
            Upload Handbook
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
            Upload UGC PDF handbooks for automated AI extraction.
          </p>
        </Link>

        <Link
          href="/admin/extracted-records"
          className="group p-5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100 group-hover:text-amber-600 transition-colors">
            Review Staged Data
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
            Validate, edit and approve extracted academic records.
          </p>
        </Link>

        <Link
          href="/admin/cutoffs"
          className="group p-5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100 group-hover:text-emerald-600 transition-colors">
            25-District Cutoffs
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
            View & edit Z-scores across all 25 Sri Lankan administrative districts.
          </p>
        </Link>

        <Link
          href="/admin/courses"
          className="group p-5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors">
            Academic Courses
          </h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
            Manage course offerings, durations, university intakes & requirements.
          </p>
        </Link>
      </div>

      {/* Recent Handbook Activity Table */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-zinc-100">Recent Handbook Activity</h3>
          <Link href="/admin/documents" className="text-xs text-indigo-600 hover:underline font-medium">
            View All Documents →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3">Handbook Title</th>
                <th className="px-4 py-3">Academic Year</th>
                <th className="px-4 py-3">Pages</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Loading recent uploads...
                  </td>
                </tr>
              ) : !stats?.recentDocuments?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-zinc-400 text-sm">
                    No documents uploaded yet. Start by uploading a UGC Handbook.
                  </td>
                </tr>
              ) : (
                stats.recentDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
                      {doc.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">{doc.academicYear}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-zinc-400">
                      {doc.processedPages} / {doc.totalPages}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/documents/${doc.id}/pages`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Inspect Pages →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
