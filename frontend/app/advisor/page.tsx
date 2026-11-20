'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { askAdvisor, getRagStats, AdvisorChatResponse, RagStats } from '@/services/advisorApi';

const SRI_LANKAN_DISTRICTS = [
  'COLOMBO', 'GAMPAHA', 'KALUTARA', 'KANDY', 'MATALE', 'NUWARA ELIYA',
  'GALLE', 'MATARA', 'HAMBANTOTA', 'JAFFNA', 'KILINOCHCHI', 'MANNAR',
  'VAVUNIYA', 'MULLAITIVU', 'BATTICALOA', 'AMPARA', 'TRINCOMALEE',
  'KURUNEGALA', 'PUTTALAM', 'ANURADHAPURA', 'POLONNARUWA',
  'BADULLA', 'MONARAGALA', 'RATNAPURA', 'KEGALLE'
];

const STREAMS = [
  'Physical Science (Maths)',
  'Biological Science',
  'Commerce',
  'Arts',
  'Technology (ET / BST)',
  'Indigenous Medicine'
];

interface ChatMessage {
  id: string;
  sender: 'user' | 'advisor';
  text: string;
  citedPages?: number[];
  citedSections?: string[];
  structuredMatchesCount?: number;
  timestamp: string;
}

export default function AdvisorPage() {
  const [district, setDistrict] = useState<string>('COLOMBO');
  const [zScore, setZScore] = useState<string>('1.7500');
  const [stream, setStream] = useState<string>('Physical Science (Maths)');

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ragStats, setRagStats] = useState<RagStats | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'advisor',
      text: 'Hello! I am your **PathWise Hybrid AI Academic Advisor**.\n\nI combine **official SQL database cutoffs** with **semantic RAG vector search** across the official UGC Sri Lanka University Admission Handbook.\n\nEnter your District and Z-Score on the left, then ask me anything about cutoffs, eligibility, quotas, or degree requirements!',
      timestamp: 'Online',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getRagStats()
      .then(setRagStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const parsedZScore = parseFloat(zScore);
      const res: AdvisorChatResponse = await askAdvisor({
        question: textToSend.trim(),
        district: district || undefined,
        zScore: !isNaN(parsedZScore) ? parsedZScore : undefined,
        stream: stream || undefined,
      });

      const advisorMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'advisor',
        text: res.answer,
        citedPages: res.citedPages,
        citedSections: res.citedSections,
        structuredMatchesCount: res.structuredMatchesCount,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, advisorMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'advisor',
          text: `⚠️ Error contacting the advisor service: ${err.message}. Please check backend connection.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    `Can I get into Computer Science at UOC with my Z-Score in ${district}?`,
    'What are the rules and criteria for Special Admission under Sports Quota?',
    'What are the G.C.E. O/L English requirements for Software Engineering?',
    'Which state universities offer Artificial Intelligence or Data Science?',
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              PW
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                PathWise Hybrid AI Advisor
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  SQL + RAG Active
                </span>
              </h1>
              <p className="text-[11px] text-gray-500">Official UGC Sri Lanka Handbook Guidance Engine</p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {ragStats && (
            <div className="hidden sm:flex items-center gap-2 text-xs bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 px-3 py-1 rounded-lg text-indigo-700 dark:text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{ragStats.totalHandbookChunks} Handbook Vector Chunks Indexed</span>
            </div>
          )}
          <Link
            href="/admin"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
          >
            Admin Portal
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Profile Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 dark:border-zinc-800 pb-3">
              <span className="text-lg">🎯</span>
              <h2 className="font-bold text-sm">Your Student Profile</h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                Your District:
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 bg-gray-50 dark:bg-zinc-800/70 border border-gray-200 dark:border-zinc-700 rounded-xl"
              >
                {SRI_LANKAN_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                A/L Z-Score:
              </label>
              <input
                type="number"
                step="0.0001"
                value={zScore}
                onChange={(e) => setZScore(e.target.value)}
                placeholder="e.g. 1.7450"
                className="w-full text-xs font-semibold p-2.5 bg-gray-50 dark:bg-zinc-800/70 border border-gray-200 dark:border-zinc-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 mb-1">
                A/L Stream:
              </label>
              <select
                value={stream}
                onChange={(e) => setStream(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 bg-gray-50 dark:bg-zinc-800/70 border border-gray-200 dark:border-zinc-700 rounded-xl"
              >
                {STREAMS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed bg-gray-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-800">
              💡 <strong>How it works:</strong> The advisor automatically passes your profile to SQL tables to find exact cutoffs while simultaneously doing RAG over the handbook prose.
            </div>
          </div>

          {/* Quick Suggestions Box */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-xs space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Suggested Questions</h3>
            <div className="space-y-2">
              {samplePrompts.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  disabled={isLoading}
                  className="w-full text-left text-xs p-2.5 rounded-xl bg-gray-50 hover:bg-indigo-50 dark:bg-zinc-800/50 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-100 dark:border-zinc-800 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Chat Column */}
        <div className="lg:col-span-3 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-xs overflow-hidden h-[720px]">
          {/* Chat Messages Log */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-2xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                      : 'bg-gray-50 dark:bg-zinc-800/70 text-gray-800 dark:text-zinc-200 rounded-bl-none border border-gray-100 dark:border-zinc-700/60 shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>

                  {/* Badges for Cited Sources & SQL Match */}
                  {m.sender === 'advisor' && (
                    <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-zinc-700/60 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {m.structuredMatchesCount !== undefined && m.structuredMatchesCount > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold flex items-center gap-1">
                          ✓ {m.structuredMatchesCount} SQL Cutoff Records Matched
                        </span>
                      )}

                      {m.citedPages && m.citedPages.length > 0 && (
                        <>
                          <span className="text-gray-400 ml-1">Citations:</span>
                          {m.citedPages.map((p) => (
                            <span
                              key={p}
                              className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono font-semibold"
                            >
                              📄 Page {p}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">{m.timestamp}</span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900 w-fit">
                <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span>Searching SQL tables + handbook vector chunks with Gemini...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 bg-gray-50/75 dark:bg-zinc-900/90 border-t border-gray-200 dark:border-zinc-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about admissions, minimum cutoffs, subject baskets, aptitude tests..."
                disabled={isLoading}
                className="flex-1 text-xs sm:text-sm p-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
              <button
                type="submit"
                disabled={isLoading || !inputQuery.trim()}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Send</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
