'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { getPublicSpecialProvisions } from '@/services/adminApi';
import { SpecialProvision } from '@/types/admin';

export default function PublicSpecialProvisionsPage() {
  const [provisions, setProvisions] = useState<SpecialProvision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState<string>('ALL');

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await getPublicSpecialProvisions();
        setProvisions(data);
      } catch (err: any) {
        console.error('Failed to load special provisions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const universitiesList = useMemo(() => {
    const unis = Array.from(new Set(provisions.map((p) => p.universityName).filter(Boolean))) as string[];
    return unis.sort();
  }, [provisions]);

  const filtered = useMemo(() => {
    return provisions.filter((p) => {
      const matchesUni = selectedUniversity === 'ALL' || p.universityName === selectedUniversity;
      if (!matchesUni) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (p.universityName || '').toLowerCase().includes(q) ||
        (p.courseOfStudy || p.title || '').toLowerCase().includes(q) ||
        (p.uniCode || '').toLowerCase().includes(q)
      );
    });
  }, [provisions, searchQuery, selectedUniversity]);

  const stats = useMemo(() => {
    const totalAllocations = provisions.length;
    const totalDifferentlyAbled = provisions.reduce((sum, p) => sum + (p.differentlyAbled || 0), 0);
    const totalBlindBraille = provisions.reduce((sum, p) => sum + (p.blindBraille || 0), 0);
    const uniqueUnis = new Set(provisions.map((p) => p.universityName).filter(Boolean)).size;
    return { totalAllocations, totalDifferentlyAbled, totalBlindBraille, uniqueUnis };
  }, [provisions]);

  const formatSeats = (num?: number | null) => {
    if (num === undefined || num === null || num === 0) {
      return <span className="text-gray-500 dark:text-zinc-400 font-bold">-</span>;
    }
    return String(num).padStart(2, '0');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-sans">
      {/* Navigation Header */}
      <header className="border-b border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              PW
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight">PathWise</h1>
              <p className="text-2xs text-gray-500 dark:text-zinc-400">Sri Lanka University Admissions</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg"
            >
              Home
            </Link>
            <Link
              href="/admin/special-provisions"
              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-lg shadow-xs transition"
            >
              Admin Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* Breadcrumb & Title */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/70 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300 text-xs font-bold mb-3">
            <span>UGC Admissions Handbook — Section 6.1</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-zinc-100">
            Special Provisions: Blind and Differently Abled Candidates
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400 max-w-4xl leading-relaxed">
            The University Grants Commission (UGC) of Sri Lanka admits blind candidates who sat the G.C.E. (Advanced Level) Examination using the Braille system and differently abled candidates (medically certified) to designated university degree programs.
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Total Program Allocations</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1">{stats.totalAllocations}</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Differently Abled Seats</div>
            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{stats.totalDifferentlyAbled}</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Blind (Braille) Seats</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.totalBlindBraille}</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Participating Universities</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1">{stats.uniqueUnis}</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by university, course of study, or Uni-Code..."
              className="px-3.5 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg w-full max-w-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <select
              value={selectedUniversity}
              onChange={(e) => setSelectedUniversity(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-800 dark:text-zinc-200"
            >
              <option value="ALL">All Universities ({universitiesList.length})</option>
              {universitiesList.map((uni) => (
                <option key={uni} value={uni}>
                  {uni}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-gray-500 dark:text-zinc-400">
            Showing <strong>{filtered.length}</strong> of {provisions.length} courses
          </div>
        </div>

        {/* UGC Handbook Format Table */}
        <div className="bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#9bb7d4] dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-400 dark:border-zinc-700">
                  <th
                    rowSpan={2}
                    className="px-5 py-3.5 align-middle border-r border-slate-400 dark:border-zinc-700 text-sm tracking-wide"
                  >
                    University
                  </th>
                  <th
                    rowSpan={2}
                    className="px-5 py-3.5 align-middle border-r border-slate-400 dark:border-zinc-700 text-sm tracking-wide"
                  >
                    Course of Study
                  </th>
                  <th
                    rowSpan={2}
                    className="px-4 py-3.5 align-middle text-center border-r border-slate-400 dark:border-zinc-700 text-sm tracking-wide"
                  >
                    Uni-Codes
                  </th>
                  <th
                    colSpan={2}
                    className="px-4 py-2 text-center border-b border-r border-slate-400 dark:border-zinc-700 text-sm tracking-wide"
                  >
                    No of Students
                  </th>
                </tr>
                <tr className="bg-[#9bb7d4] dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-400 dark:border-zinc-700 text-xs">
                  <th className="px-4 py-2 text-center border-r border-slate-400 dark:border-zinc-700">
                    Differently abled
                  </th>
                  <th className="px-4 py-2 text-center">
                    Blind (Braille)
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-gray-500">
                      Loading UGC Special Provisions allocations...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-gray-500 dark:text-zinc-400">
                      No special provisions found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map((sp, idx) => {
                    const isStripe = idx % 2 === 1;
                    return (
                      <tr
                        key={sp.id}
                        className={`border-b border-slate-300 dark:border-zinc-800 transition-colors ${
                          isStripe
                            ? 'bg-[#dce8f5] dark:bg-slate-900/60 hover:bg-[#d0e0f0] dark:hover:bg-slate-900/90'
                            : 'bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900/60'
                        }`}
                      >
                        <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-zinc-100 border-r border-slate-300 dark:border-zinc-800 text-sm">
                          {sp.universityName || '—'}
                        </td>
                        <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-zinc-100 border-r border-slate-300 dark:border-zinc-800 text-sm">
                          {sp.courseOfStudy || sp.title || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono font-semibold text-xs text-slate-900 dark:text-indigo-400 border-r border-slate-300 dark:border-zinc-800">
                          {sp.uniCode || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono font-semibold text-sm text-slate-900 dark:text-zinc-100 border-r border-slate-300 dark:border-zinc-800">
                          {formatSeats(sp.differentlyAbled)}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono font-semibold text-sm text-slate-900 dark:text-amber-400">
                          {formatSeats(sp.blindBraille)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Information Callout */}
        <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 text-xs text-indigo-950 dark:text-indigo-200 space-y-2">
          <div className="font-bold text-sm">Important Admission Notes:</div>
          <ul className="list-disc pl-5 space-y-1 leading-relaxed">
            <li>Candidates applying under the <strong>Blind (Braille)</strong> category must have sat the G.C.E. (A/L) examination using the Braille system.</li>
            <li>Candidates applying under the <strong>Differently Abled</strong> category must submit valid medical certifications issued by the designated Government Medical Board.</li>
            <li>Applications must be forwarded in accordance with UGC Handbook Section 6.1 instructions along with official university admissions forms.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
