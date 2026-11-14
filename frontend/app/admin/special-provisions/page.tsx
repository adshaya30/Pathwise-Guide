'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  getSpecialProvisions,
  createSpecialProvision,
  updateSpecialProvision,
  deleteSpecialProvision,
  batchCreateSpecialProvisions,
} from '@/services/adminApi';
import { SpecialProvision } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function SpecialProvisionsPage() {
  const [provisions, setProvisions] = useState<SpecialProvision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState<string>('ALL');

  // Single record Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SpecialProvision>>({
    universityName: '',
    courseOfStudy: '',
    uniCode: '',
    differentlyAbled: 1,
    blindBraille: 0,
  });

  // Batch Import / Paste Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await getSpecialProvisions();
      setProvisions(data);
    } catch (err: any) {
      alert('Failed to load special provisions: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const universitiesList = useMemo(() => {
    const unis = Array.from(new Set(provisions.map((p) => p.universityName).filter(Boolean))) as string[];
    return unis.sort();
  }, [provisions]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      universityName: '',
      courseOfStudy: '',
      uniCode: '',
      differentlyAbled: 1,
      blindBraille: 0,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sp: SpecialProvision) => {
    setEditingId(sp.id);
    setFormData({
      universityName: sp.universityName || '',
      courseOfStudy: sp.courseOfStudy || '',
      uniCode: sp.uniCode || '',
      differentlyAbled: sp.differentlyAbled ?? 0,
      blindBraille: sp.blindBraille ?? 0,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this special provision allocation?')) return;
    try {
      await deleteSpecialProvision(id);
      loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<SpecialProvision> = {
        universityName: formData.universityName?.trim() || '',
        courseOfStudy: formData.courseOfStudy?.trim() || '',
        uniCode: formData.uniCode?.trim().toUpperCase() || '',
        differentlyAbled: Number(formData.differentlyAbled ?? 0),
        blindBraille: Number(formData.blindBraille ?? 0),
      };

      if (editingId) {
        await updateSpecialProvision(editingId, payload);
      } else {
        await createSpecialProvision(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  // Dynamic parser for pasted table / handbook lines (no hardcoding)
  const parsedImportRows = useMemo(() => {
    if (!importRawText.trim()) return [];

    const lines = importRawText.split(/\r?\n/);
    const results: Array<{
      universityName: string;
      courseOfStudy: string;
      uniCode: string;
      differentlyAbled: number;
      blindBraille: number;
    }> = [];

    let currentUniversity = '';
    const rowPattern = /^(.*?)\b(\d{3}[A-Z]?)\s+([0-9]+|[-–—]+)\s+([0-9]+|[-–—]+)\s*$/;
    const genericInstPattern = /^(University\s+of\s+[\w\s&'-]+?|[\w\s&'-]+?\s+(?:University|Campus|Institute|College|Faculty)(?:,\s*[\w\s&'-]+?)?)\s+(.+)$/i;

    const parseSeat = (val: string): number => {
      const c = val.trim();
      if (c === '-' || c === '–' || c === '—' || c.toLowerCase() === 'nil' || c.toLowerCase() === 'none') {
        return 0;
      }
      const num = parseInt(c, 10);
      return isNaN(num) ? 0 : num;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const lower = line.toLowerCase();
      // Skip header rows
      if (
        lower.includes('differently abled') ||
        lower.includes('blind (braille)') ||
        lower.includes('course of study') ||
        lower.includes('uni-codes') ||
        lower.includes('no of students')
      ) {
        continue;
      }

      // 1. Try CSV / TSV / Pipe format
      const delimParts = line.split(/\t|\||,/);
      if (delimParts.length >= 5 && /\b\d{3}[A-Z]?\b/.test(delimParts[2])) {
        const uni = delimParts[0].trim().replace(/^["']/, '').replace(/["']$/, '');
        const course = delimParts[1].trim().replace(/^["']/, '').replace(/["']$/, '');
        const code = delimParts[2].trim().toUpperCase().replace(/^["']/, '').replace(/["']$/, '');
        const diff = parseSeat(delimParts[3]);
        const blind = parseSeat(delimParts[4]);
        if (uni) currentUniversity = uni;
        results.push({
          universityName: uni || currentUniversity,
          courseOfStudy: course,
          uniCode: code,
          differentlyAbled: diff,
          blindBraille: blind,
        });
        continue;
      }

      // 2. Try regex match for whitespace separated handbook lines
      const match = line.match(rowPattern);
      if (match) {
        const prefix = match[1].trim();
        const uniCode = match[2].trim().toUpperCase();
        const differentlyAbled = parseSeat(match[3]);
        const blindBraille = parseSeat(match[4]);

        let uni = '';
        let course = '';

        const splitParts = prefix.split(/\t|\||,|;|\s{2,}/);
        if (splitParts.length >= 2) {
          uni = splitParts[0].trim();
          course = splitParts[1].trim();
          currentUniversity = uni;
        } else {
          // Dynamic match against registered universities from database
          let matched = false;
          for (const u of universitiesList) {
            if (prefix.toLowerCase().startsWith(u.toLowerCase())) {
              uni = u;
              course = prefix.slice(u.length).trim();
              currentUniversity = uni;
              matched = true;
              break;
            }
          }

          // Generic academic institution pattern
          if (!matched) {
            const instMatch = prefix.match(genericInstPattern);
            if (instMatch) {
              uni = instMatch[1].trim();
              course = instMatch[2].trim();
              currentUniversity = uni;
              matched = true;
            }
          }

          if (!matched) {
            if (currentUniversity) {
              uni = currentUniversity;
              course = prefix;
            } else {
              uni = prefix;
              course = '';
            }
          }
        }

        course = course.replace(/^[-:,\s]+/, '').trim();
        uni = uni.replace(/^[-:,\s]+/, '').trim();

        if (course || uni) {
          results.push({
            universityName: uni,
            courseOfStudy: course,
            uniCode,
            differentlyAbled,
            blindBraille,
          });
        }
      }
    }

    return results;
  }, [importRawText, universitiesList]);

  const handleExecuteBatchImport = async () => {
    if (parsedImportRows.length === 0) {
      setImportError('No valid Special Provision rows could be parsed from the pasted text.');
      return;
    }
    try {
      setIsImporting(true);
      setImportError(null);
      await batchCreateSpecialProvisions(parsedImportRows);
      setIsImportModalOpen(false);
      setImportRawText('');
      loadData();
    } catch (err: any) {
      setImportError('Import failed: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportCSV = () => {
    if (provisions.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['University', 'Course of Study', 'Uni-Codes', 'Differently abled', 'Blind (Braille)'];
    const rows = provisions.map((p) => [
      `"${(p.universityName || '').replace(/"/g, '""')}"`,
      `"${(p.courseOfStudy || '').replace(/"/g, '""')}"`,
      `"${p.uniCode || ''}"`,
      p.differentlyAbled ?? 0,
      p.blindBraille ?? 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ugc_special_provisions_section_6.1_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = useMemo(() => {
    return provisions.filter((p) => {
      const matchesUni = selectedUniversity === 'ALL' || p.universityName === selectedUniversity;
      if (!matchesUni) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (p.universityName || '').toLowerCase().includes(q) ||
        (p.courseOfStudy || '').toLowerCase().includes(q) ||
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
    <div className="space-y-6">
      <AdminHeader
        title="Special Provisions Management"
        description="Section 6.1: Admission of Blind and Differently Abled Candidates per University, Course of Study & Uni-Code."
      />

      {/* UGC Handbook Section 6.1 Official Policy Header */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-blue-600 text-white">
            UGC Handbook Section 6.1
          </span>
          <h3 className="text-sm font-bold text-blue-950 dark:text-blue-100">
            Admission of Students Under Special Provisions: Blind and Differently Abled Candidates
          </h3>
        </div>
        <p className="text-xs text-blue-900/80 dark:text-blue-200/80 leading-relaxed mt-1">
          The UGC, at the request of the universities concerned, decided to admit blind students [who sat the G.C.E. (Advanced Level) Examination using the Braille system] and differently abled students (who are medically certified as disabled) for the following courses of study.
        </p>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Total Allocations</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1">{stats.totalAllocations}</div>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Differently Abled Seats</div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{stats.totalDifferentlyAbled}</div>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Blind (Braille) Seats</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.totalBlindBraille}</div>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Universities</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1">{stats.uniqueUnis}</div>
        </div>
      </div>

      {/* Search and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[320px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search university, course of study or uni-code..."
            className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-full max-w-sm text-gray-900 dark:text-zinc-100 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

          <select
            value={selectedUniversity}
            onChange={(e) => setSelectedUniversity(e.target.value)}
            className="px-3 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-800 dark:text-zinc-200 shadow-xs"
          >
            <option value="ALL">All Universities ({universitiesList.length})</option>
            {universitiesList.map((uni) => (
              <option key={uni} value={uni}>
                {uni}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-800 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              setImportRawText('');
              setImportError(null);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Paste Handbook Table / Import</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <span>+ Add Allocation</span>
          </button>
        </div>
      </div>

      {/* UGC Handbook Format Table */}
      <div className="bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              {/* Top Level Header */}
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
                <th rowSpan={2} className="px-5 py-3.5 text-right align-middle text-xs font-semibold">
                  Actions
                </th>
              </tr>
              {/* Sub-Header for No of Students */}
              <tr className="bg-[#9bb7d4] dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-400 dark:border-zinc-700 text-xs">
                <th className="px-4 py-2 text-center border-r border-slate-400 dark:border-zinc-700">
                  Differently abled
                </th>
                <th className="px-4 py-2 text-center border-r border-slate-400 dark:border-zinc-700">
                  Blind (Braille)
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading special provisions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No special provisions found. Click <strong>&quot;Paste Handbook Table / Import&quot;</strong> or <strong>&quot;+ Add Allocation&quot;</strong> to insert data dynamically.
                  </td>
                </tr>
              ) : (
                filtered.map((sp, idx) => {
                  // Alternating background matching UGC handbook screenshot (White vs soft steel blue)
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
                        {sp.courseOfStudy || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-semibold text-xs text-slate-900 dark:text-indigo-400 border-r border-slate-300 dark:border-zinc-800">
                        {sp.uniCode || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-semibold text-sm text-slate-900 dark:text-zinc-100 border-r border-slate-300 dark:border-zinc-800">
                        {formatSeats(sp.differentlyAbled)}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-semibold text-sm text-slate-900 dark:text-amber-400 border-r border-slate-300 dark:border-zinc-800">
                        {formatSeats(sp.blindBraille)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(sp)}
                            className="px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(sp.id)}
                            className="px-2 py-0.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paste Handbook Table / Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Dynamic Batch Import: Special Provisions Table"
        maxWidth="4xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
            Paste rows directly from the UGC Handbook, PDF text, Excel, or CSV. The parser dynamically detects universities, courses, Uni-Codes, and seat allocations without hardcoding any static code.
          </p>

          <div>
            <div className="mb-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                Paste Table Data:
              </label>
            </div>
            <textarea
              value={importRawText}
              onChange={(e) => setImportRawText(e.target.value)}
              placeholder="Paste table lines directly from PDF, Excel, TSV, CSV, or handbook table..."
              rows={8}
              className="w-full p-3 font-mono text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              spellCheck={false}
            />
          </div>

          {importError && (
            <div className="p-3 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              {importError}
            </div>
          )}

          {/* Live Parsing Preview */}
          {parsedImportRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-zinc-300">
                <span>Detected Rows ({parsedImportRows.length})</span>
                <span className="text-emerald-600 dark:text-emerald-400">Ready to ingest into database</span>
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-zinc-800 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#9bb7d4] text-slate-900 sticky top-0 font-bold">
                    <tr>
                      <th className="px-3 py-1.5">University</th>
                      <th className="px-3 py-1.5">Course</th>
                      <th className="px-2 py-1.5 text-center">Code</th>
                      <th className="px-2 py-1.5 text-center">Differently Abled</th>
                      <th className="px-2 py-1.5 text-center">Blind</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {parsedImportRows.map((r, i) => (
                      <tr key={i} className={i % 2 === 1 ? 'bg-[#dce8f5] dark:bg-slate-900/50' : 'bg-white dark:bg-zinc-950'}>
                        <td className="px-3 py-1 font-medium">{r.universityName}</td>
                        <td className="px-3 py-1">{r.courseOfStudy}</td>
                        <td className="px-2 py-1 text-center font-mono font-bold">{r.uniCode}</td>
                        <td className="px-2 py-1 text-center font-mono">{r.differentlyAbled || '-'}</td>
                        <td className="px-2 py-1 text-center font-mono">{r.blindBraille || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteBatchImport}
              disabled={isImporting || parsedImportRows.length === 0}
              className="px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg shadow-xs transition"
            >
              {isImporting ? 'Ingesting to Database...' : `Save ${parsedImportRows.length} Allocations to Database`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create / Edit Single Record Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Special Provision Allocation' : 'Add Special Provision Allocation'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              University *
            </label>
            <input
              type="text"
              required
              value={formData.universityName || ''}
              onChange={(e) => setFormData({ ...formData, universityName: e.target.value })}
              placeholder="Enter University Name"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Course of Study *
            </label>
            <input
              type="text"
              required
              value={formData.courseOfStudy || ''}
              onChange={(e) => setFormData({ ...formData, courseOfStudy: e.target.value })}
              placeholder="Enter Course of Study"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Uni-Code *
            </label>
            <input
              type="text"
              required
              value={formData.uniCode || ''}
              onChange={(e) => setFormData({ ...formData, uniCode: e.target.value.toUpperCase() })}
              placeholder="Enter Uni-Code"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                No. of Differently Abled Students
              </label>
              <input
                type="number"
                min="0"
                value={formData.differentlyAbled ?? 0}
                onChange={(e) => setFormData({ ...formData, differentlyAbled: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                No. of Blind (Braille) Students
              </label>
              <input
                type="number"
                min="0"
                value={formData.blindBraille ?? 0}
                onChange={(e) => setFormData({ ...formData, blindBraille: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs"
            >
              {editingId ? 'Update Allocation' : 'Create Allocation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
