import React from "react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-white to-gray-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 text-gray-900 dark:text-zinc-100 font-sans">
      {/* Navigation */}
      <header className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
            PW
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">PathWise</h1>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Sri Lanka University Admissions</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/special-provisions"
            className="text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg transition"
          >
            Special Provisions
          </Link>
          <Link
            href="/ol-requirements"
            className="text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg transition"
          >
            O/L Requirements
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md transition-all hover:shadow-indigo-500/20"
          >
            <span>Admin Portal</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
          <span>UGC Admissions Handbook Platform</span>
        </div>

        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-zinc-100 max-w-3xl mx-auto leading-tight">
          Find Your Path to Sri Lankan State Universities
        </h2>

        <p className="mt-6 text-base sm:text-lg text-gray-600 dark:text-zinc-400 max-w-2xl mx-auto">
          Explore official minimum Z-score cutoffs across all 25 administrative districts, undergraduate course intake capacities, aptitude tests, and university admissions criteria.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/admin"
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition-all hover:-translate-y-0.5"
          >
            Launch Admin Portal Control Center
          </Link>
          <Link
            href="/special-provisions"
            className="px-6 py-3.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-sm font-semibold rounded-xl shadow-xs transition-all"
          >
            Special Provisions
          </Link>
          <Link
            href="/ol-requirements"
            className="px-6 py-3.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-sm font-semibold rounded-xl shadow-xs transition-all"
          >
            O/L Requirements
          </Link>
          <Link
            href="/admin/cutoffs"
            className="px-6 py-3.5 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-800 dark:text-zinc-200 border border-gray-200 dark:border-zinc-800 text-sm font-semibold rounded-xl shadow-xs transition-all"
          >
            View 25-District Z-Scores
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold text-lg mb-4">
              📄
            </div>
            <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-base">
              AI Handbook Extraction
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 leading-relaxed">
              Upload official UGC Handbook PDFs. Apache PDFBox extracts raw page text while Gemini API structures candidate data for administrator review.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold text-lg mb-4">
              📈
            </div>
            <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-base">
              Single-Table 25 District Cutoffs
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 leading-relaxed">
              Unified database schema capturing all 25 Sri Lankan administrative districts with horizontal scrolling and Uni-Code auto-fill.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold text-lg mb-4">
              🛡️
            </div>
            <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-base">
              Staging & Verification Workflow
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 leading-relaxed">
              No unverified data goes live. Admins inspect page-by-page extractions, edit candidate payloads, and publish atomically with rollback protection.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
