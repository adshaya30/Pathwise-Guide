'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { getDocument, getDocumentPages, updatePage } from '@/services/adminApi';
import { DocumentRecord, DocumentPage } from '@/types/admin';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default function DocumentPagesViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: documentId } = use(params);

  const [documentRecord, setDocumentRecord] = useState<DocumentRecord | null>(null);
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states for the selected page
  const [editedType, setEditedType] = useState('GENERAL');
  const [editedJson, setEditedJson] = useState('{}');

  useEffect(() => {
    if (!documentId) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [doc, pgList] = await Promise.all([
          getDocument(documentId),
          getDocumentPages(documentId),
        ]);
        setDocumentRecord(doc);
        setPages(pgList);
        if (pgList.length > 0) {
          setSelectedPageIndex(0);
          setEditedType(pgList[0].pageType || 'GENERAL');
          setEditedJson(pgList[0].extractedJson || '{}');
        }
      } catch (err: any) {
        alert('Failed to load document pages: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [documentId]);

  const activePage = pages[selectedPageIndex];

  const handleSelectPage = (index: number) => {
    setSelectedPageIndex(index);
    const pg = pages[index];
    setEditedType(pg.pageType || 'GENERAL');
    setEditedJson(pg.extractedJson || '{}');
    setSaveSuccess(false);
  };

  const handleSavePage = async () => {
    if (!activePage) return;
    try {
      setIsSaving(true);
      const updated = await updatePage(activePage.id, {
        pageType: editedType,
        extractedJson: editedJson,
        status: 'VERIFIED',
      });
      setPages((prev) => {
        const copy = [...prev];
        copy[selectedPageIndex] = updated;
        return copy;
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Page Verification & AI Extraction Inspector"
        description="Inspect raw PDF text side-by-side with Gemini-structured classification for each handbook page."
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/documents"
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
          >
            ← Back to Documents
          </Link>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
            {documentRecord?.title}
          </span>
          <span className="text-xs text-gray-400">({documentRecord?.academicYear})</span>
        </div>

        <Link
          href="/admin/extracted-records"
          className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
        >
          Go to Staging Review →
        </Link>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-zinc-950 p-12 text-center text-gray-500 rounded-xl border border-gray-200 dark:border-zinc-800">
          Loading document pages...
        </div>
      ) : pages.length === 0 ? (
        <div className="bg-white dark:bg-zinc-950 p-12 text-center text-gray-500 rounded-xl border border-gray-200 dark:border-zinc-800">
          No pages found for this handbook.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Page Selector Sidebar */}
          <div className="col-span-12 md:col-span-3 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-3 max-h-[78vh] overflow-y-auto space-y-1.5">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 py-1">
              Handbook Pages ({pages.length})
            </h4>
            {pages.map((pg, idx) => {
              const isSelected = idx === selectedPageIndex;
              return (
                <button
                  key={pg.id}
                  onClick={() => handleSelectPage(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-900 border border-transparent'
                  }`}
                >
                  <span className="font-semibold">Page {pg.pageNumber}</span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
                    {pg.pageType}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Side-by-Side Verification Workspace */}
          <div className="col-span-12 md:col-span-9 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col min-h-[78vh]">
            {/* Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-gray-900 dark:text-zinc-100">
                  Page {activePage?.pageNumber} Verification
                </span>
                <StatusBadge status={activePage?.status || 'PENDING'} size="sm" />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400">
                  Classification:
                </label>
                <select
                  value={editedType}
                  onChange={(e) => setEditedType(e.target.value)}
                  className="px-2.5 py-1 text-xs font-semibold bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-md text-gray-900 dark:text-zinc-100"
                >
                  <option value="CUTOFF">CUTOFF (Z-Scores)</option>
                  <option value="COURSE">COURSE (Offerings & Intakes)</option>
                  <option value="UNI_CODE">UNI_CODE (University Codes)</option>
                  <option value="ARTS_BASKET">ARTS_BASKET (Subject Baskets)</option>
                  <option value="DISTRICT">DISTRICT (District Classifications)</option>
                  <option value="SPECIAL_PROVISION">SPECIAL_PROVISION (Differently Abled / Quota)</option>
                  <option value="APTITUDE">APTITUDE (Aptitude Requirements)</option>
                  <option value="STREAM_SUBJECT">STREAM_SUBJECT (A/L Stream Subjects)</option>
                  <option value="GENERAL">GENERAL (Intro / General Text)</option>
                </select>

                <button
                  onClick={handleSavePage}
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Verify & Save Page'}
                </button>
              </div>
            </div>

            {saveSuccess && (
              <div className="my-2 p-2.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200">
                ✓ Page verified and saved successfully!
              </div>
            )}

            {/* Split Screen Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 mt-4">
              {/* Left Column: Raw PDF Text */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Apache PDFBox Extracted Raw Text
                  </h5>
                  <span className="text-[11px] text-gray-400">Read-Only</span>
                </div>
                <div className="flex-1 p-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-xs font-mono whitespace-pre-wrap overflow-y-auto max-h-[55vh] text-gray-800 dark:text-zinc-200 select-all">
                  {activePage?.rawText || 'No text content extracted for this page.'}
                </div>
              </div>

              {/* Right Column: Gemini Structured JSON */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                    Gemini AI Structured Payload (JSON)
                  </h5>
                  <span className="text-[11px] text-gray-400">Editable</span>
                </div>
                <textarea
                  value={editedJson}
                  onChange={(e) => setEditedJson(e.target.value)}
                  rows={20}
                  className="flex-1 w-full p-3 bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg text-xs font-mono text-gray-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Bottom Navigation */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200 dark:border-zinc-800">
              <button
                onClick={() => handleSelectPage(Math.max(0, selectedPageIndex - 1))}
                disabled={selectedPageIndex === 0}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-zinc-800 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                ← Previous Page
              </button>
              <span className="text-xs text-gray-400">
                Page {selectedPageIndex + 1} of {pages.length}
              </span>
              <button
                onClick={() => handleSelectPage(Math.min(pages.length - 1, selectedPageIndex + 1))}
                disabled={selectedPageIndex === pages.length - 1}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-zinc-800 rounded-md disabled:opacity-40 hover:bg-gray-50"
              >
                Next Page →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
