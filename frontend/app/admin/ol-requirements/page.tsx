'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  getOlRequirements,
  createOlRequirement,
  updateOlRequirement,
  deleteOlRequirement,
  batchCreateOlRequirements,
} from '@/services/adminApi';
import { OlRequirement } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function OlRequirementsPage() {
  const [requirements, setRequirements] = useState<OlRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Single record Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<OlRequirement>>({
    uniCodes: '',
    courseOfStudy: '',
    sinhalaLanguage: '',
    english: 'C',
    mathematics: '',
    science: '',
    tamilLanguage: '',
    notes: '',
  });

  // Batch Import / Paste Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRawText, setImportRawText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await getOlRequirements();
      setRequirements(data);
    } catch (err: any) {
      alert('Failed to load O/L requirements: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      uniCodes: '',
      courseOfStudy: '',
      sinhalaLanguage: '',
      english: 'C',
      mathematics: '',
      science: '',
      tamilLanguage: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (req: OlRequirement) => {
    setEditingId(req.id);
    setFormData({
      uniCodes: req.uniCodes || '',
      courseOfStudy: req.courseOfStudy || '',
      sinhalaLanguage: req.sinhalaLanguage || '',
      english: req.english || '',
      mathematics: req.mathematics || '',
      science: req.science || '',
      tamilLanguage: req.tamilLanguage || '',
      notes: req.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this O/L requirement?')) return;
    try {
      await deleteOlRequirement(id);
      loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<OlRequirement> = {
        uniCodes: formData.uniCodes?.trim() || '',
        courseOfStudy: formData.courseOfStudy?.trim() || '',
        sinhalaLanguage: formData.sinhalaLanguage?.trim() || '',
        english: formData.english?.trim() || '',
        mathematics: formData.mathematics?.trim() || '',
        science: formData.science?.trim() || '',
        tamilLanguage: formData.tamilLanguage?.trim() || '',
        notes: formData.notes?.trim() || '',
      };

      if (editingId) {
        await updateOlRequirement(editingId, payload);
      } else {
        await createOlRequirement(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  // Dynamic parser for pasted table lines (TSV, CSV, pipe, spaces - NO hardcoded records)
  const parsedImportRows = useMemo(() => {
    if (!importRawText.trim()) return [];

    const lines = importRawText.split(/\r?\n/);
    const results: Array<Partial<OlRequirement>> = [];
    const uniCodePattern = /^([0-9]{3}[A-Z]?(?:\s*\/\s*[0-9]{3}[A-Z]?)*)\b/;

    const cleanGrade = (val?: string) => {
      if (!val) return '';
      const c = val.trim();
      if (c === '-' || c === '–' || c === '—') return '';
      return c;
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const lower = line.toLowerCase();
      // Skip header rows
      if (
        lower.includes('course of study') ||
        lower.includes('sin. lang') ||
        lower.includes('g.c.e') ||
        lower.includes('ordinary level')
      ) {
        continue;
      }

      // 1. Delimited format (tab, pipe, comma)
      const delimParts = line.split(/\t|\||,/);
      if (delimParts.length >= 7 && uniCodePattern.test(delimParts[0].trim())) {
        results.push({
          uniCodes: delimParts[0].trim().replace(/^["']/, '').replace(/["']$/, ''),
          courseOfStudy: delimParts[1].trim().replace(/^["']/, '').replace(/["']$/, ''),
          sinhalaLanguage: cleanGrade(delimParts[2]),
          english: cleanGrade(delimParts[3]),
          mathematics: cleanGrade(delimParts[4]),
          science: cleanGrade(delimParts[5]),
          tamilLanguage: cleanGrade(delimParts[6]),
          notes: delimParts[7] ? delimParts[7].trim() : '',
        });
        continue;
      }

      // 2. Whitespace-separated line
      const m = line.match(uniCodePattern);
      if (m) {
        const uniCodes = m[1].trim();
        const rest = line.substring(m[0].length).trim();
        const parts = rest.split(/\s{2,}/);

        if (parts.length >= 2) {
          const course = parts[0].trim();
          let sinLang = '';
          let eng = '';
          let mat = '';
          let sci = '';
          let tamLang = '';

          if (parts.length >= 6) {
            sinLang = cleanGrade(parts[1]);
            eng = cleanGrade(parts[2]);
            mat = cleanGrade(parts[3]);
            sci = cleanGrade(parts[4]);
            tamLang = cleanGrade(parts[5]);
          } else {
            // Assign sequential grades
            const gradeParts = parts.slice(1).map(cleanGrade);
            if (gradeParts.length > 0) eng = gradeParts[0];
            if (gradeParts.length > 1) mat = gradeParts[1];
            if (gradeParts.length > 2) sci = gradeParts[2];
          }

          results.push({
            uniCodes,
            courseOfStudy: course,
            sinhalaLanguage: sinLang,
            english: eng,
            mathematics: mat,
            science: sci,
            tamilLanguage: tamLang,
          });
        }
      }
    }

    return results;
  }, [importRawText]);

  const handleExecuteBatchImport = async () => {
    if (parsedImportRows.length === 0) {
      setImportError('No valid O/L requirement rows could be parsed from the pasted text.');
      return;
    }
    try {
      setIsImporting(true);
      setImportError(null);
      await batchCreateOlRequirements(parsedImportRows);
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
    if (requirements.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Uni-Codes', 'Course of Study', 'Sin. Lang.', 'Eng.', 'Mat.', 'Sci.', 'Tam. Lang.', 'Notes'];
    const rows = requirements.map((r) => [
      `"${(r.uniCodes || '').replace(/"/g, '""')}"`,
      `"${(r.courseOfStudy || '').replace(/"/g, '""')}"`,
      `"${r.sinhalaLanguage || ''}"`,
      `"${r.english || ''}"`,
      `"${r.mathematics || ''}"`,
      `"${r.science || ''}"`,
      `"${r.tamilLanguage || ''}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gce_ol_examination_requirements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return requirements;
    const q = searchQuery.toLowerCase();
    return requirements.filter(
      (r) =>
        (r.courseOfStudy || '').toLowerCase().includes(q) ||
        (r.uniCodes || '').toLowerCase().includes(q) ||
        (r.english || '').toLowerCase().includes(q) ||
        (r.mathematics || '').toLowerCase().includes(q) ||
        (r.science || '').toLowerCase().includes(q)
    );
  }, [requirements, searchQuery]);

  const stats = useMemo(() => {
    const totalCourses = requirements.length;
    const requiresEng = requirements.filter((r) => r.english && r.english.trim() !== '').length;
    const requiresMath = requirements.filter((r) => r.mathematics && r.mathematics.trim() !== '').length;
    const requiresSci = requirements.filter((r) => r.science && r.science.trim() !== '').length;
    return { totalCourses, requiresEng, requiresMath, requiresSci };
  }, [requirements]);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="G.C.E. (Ordinary Level) Requirements"
        description="Course-specific Ordinary Level examination passes, minimum subject grades, and certified certificate submission criteria."
      />

      {/* UGC Handbook Official Instruction Header (Matching Screenshot) */}
      <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-rose-600 text-white">
            G.C.E. (Ordinary Level) Examination Requirements
          </span>
        </div>
        <p className="text-xs text-amber-950/90 dark:text-amber-200/90 leading-relaxed">
          Every candidate who has listed under mentioned courses of study among his/ her preferences, must send the duly <strong>certified copy of the original G.C.E. (Ordinary Level) Examination certificate</strong> indicating that he/ she has obtained the necessary passes at the G.C.E. (Ordinary Level) Examination, along with the printed online application. If the required certificates have not been sent along with the printed application, the candidates will not be considered for those courses of study. <strong>The candidates should have fulfilled the G.C.E. (Ordinary Level) Examination requirements relevant for the courses of study requested, by the deadline given for submission of applications for university admission.</strong>
        </p>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Total Courses with O/L Req.</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1">{stats.totalCourses}</div>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">English Language Required</div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{stats.requiresEng}</div>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Mathematics Required</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.requiresMath}</div>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Science Required</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.requiresSci}</div>
        </div>
      </div>

      {/* Search and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Uni-Code, course of study, or grade (e.g. 011G, Law, C*)..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-full max-w-sm text-gray-900 dark:text-zinc-100 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />

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
            <span>Paste Table / Import</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <span>+ Add Requirement</span>
          </button>
        </div>
      </div>

      {/* UGC Handbook Format Table */}
      <div className="bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              {/* Top Level Header */}
              <tr className="bg-[#b4cce4] dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-400 dark:border-zinc-700">
                <th
                  rowSpan={2}
                  className="px-4 py-3 align-middle border-r border-slate-400 dark:border-zinc-700 text-xs tracking-wide w-48"
                >
                  Uni-Codes
                </th>
                <th
                  rowSpan={2}
                  className="px-5 py-3 align-middle border-r border-slate-400 dark:border-zinc-700 text-xs tracking-wide"
                >
                  Course of Study
                </th>
                <th
                  colSpan={5}
                  className="px-4 py-2 text-center border-b border-r border-slate-400 dark:border-zinc-700 text-xs tracking-wide"
                >
                  G.C.E (O/L)
                </th>
                <th rowSpan={2} className="px-4 py-3 text-right align-middle text-xs font-semibold w-24">
                  Actions
                </th>
              </tr>
              {/* Sub-Header for G.C.E (O/L) Subjects */}
              <tr className="bg-[#b4cce4] dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 font-bold border-b border-slate-400 dark:border-zinc-700 text-2xs">
                <th className="px-3 py-1.5 text-center border-r border-slate-400 dark:border-zinc-700 w-16">
                  Sin. Lang.
                </th>
                <th className="px-3 py-1.5 text-center border-r border-slate-400 dark:border-zinc-700 w-16">
                  Eng.
                </th>
                <th className="px-3 py-1.5 text-center border-r border-slate-400 dark:border-zinc-700 w-16">
                  Mat.
                </th>
                <th className="px-3 py-1.5 text-center border-r border-slate-400 dark:border-zinc-700 w-16">
                  Sci.
                </th>
                <th className="px-3 py-1.5 text-center border-r border-slate-400 dark:border-zinc-700 w-16">
                  Tam. Lang.
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Loading O/L requirements...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No O/L requirements found. Click <strong>&quot;Paste Table / Import&quot;</strong> or <strong>&quot;+ Add Requirement&quot;</strong> to insert data dynamically.
                  </td>
                </tr>
              ) : (
                filtered.map((req, idx) => {
                  // Alternating background matching UGC handbook screenshot (White vs soft cream/tan)
                  const isStripe = idx % 2 === 1;
                  return (
                    <tr
                      key={req.id}
                      className={`border-b border-slate-300 dark:border-zinc-800 transition-colors ${isStripe
                        ? 'bg-[#ede6d4]/70 dark:bg-amber-950/20 hover:bg-[#e4dbca] dark:hover:bg-amber-950/40'
                        : 'bg-white dark:bg-zinc-950 hover:bg-slate-50 dark:hover:bg-zinc-900/60'
                        }`}
                    >
                      <td className="px-4 py-2.5 font-mono font-bold text-xs text-slate-900 dark:text-indigo-400 border-r border-slate-300 dark:border-zinc-800">
                        {req.uniCodes || '—'}
                      </td>
                      <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-zinc-100 border-r border-slate-300 dark:border-zinc-800 text-sm">
                        {req.courseOfStudy || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-sm text-slate-900 dark:text-zinc-100 border-r border-slate-300 dark:border-zinc-800">
                        {req.sinhalaLanguage || ''}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-sm text-slate-900 dark:text-zinc-100 border-r border-slate-300 dark:border-zinc-800">
                        {req.english || ''}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-sm text-slate-900 dark:text-zinc-100 border-r border-slate-300 dark:border-zinc-800">
                        {req.mathematics || ''}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-sm text-slate-900 dark:text-zinc-100 border-r border-slate-300 dark:border-zinc-800">
                        {req.science || ''}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-sm text-slate-900 dark:text-zinc-100 border-r border-slate-300 dark:border-zinc-800">
                        {req.tamilLanguage || ''}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(req)}
                            className="px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(req.id)}
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

      {/* Paste Table / Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Dynamic Batch Import: G.C.E. (O/L) Requirements Table"
        maxWidth="4xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
            Paste rows directly from the UGC Handbook, PDF text, Excel, or CSV. The parser dynamically reads Uni-Codes, Course of Study, and the 5 O/L subject grades (Sin. Lang., Eng., Mat., Sci., Tam. Lang.).
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
              placeholder="Paste table lines directly (e.g. from PDF, Excel, TSV, CSV, or handbook table)...&#10;011G&#9;Quantity Surveying&#9;&#9;C&#9;C&#9;S&#9;&#10;020S&#9;Arts (SP) - Mass Media&#9;&#9;S&#9;&#9;&#9;"
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
                  <thead className="bg-[#b4cce4] text-slate-900 sticky top-0 font-bold">
                    <tr>
                      <th className="px-3 py-1.5">Uni-Codes</th>
                      <th className="px-3 py-1.5">Course of Study</th>
                      <th className="px-2 py-1.5 text-center">Sin.</th>
                      <th className="px-2 py-1.5 text-center">Eng.</th>
                      <th className="px-2 py-1.5 text-center">Mat.</th>
                      <th className="px-2 py-1.5 text-center">Sci.</th>
                      <th className="px-2 py-1.5 text-center">Tam.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {parsedImportRows.map((r, i) => (
                      <tr key={i} className={i % 2 === 1 ? 'bg-[#ede6d4]/70 dark:bg-amber-950/20' : 'bg-white dark:bg-zinc-950'}>
                        <td className="px-3 py-1 font-mono font-bold">{r.uniCodes}</td>
                        <td className="px-3 py-1 font-medium">{r.courseOfStudy}</td>
                        <td className="px-2 py-1 text-center font-bold">{r.sinhalaLanguage || '-'}</td>
                        <td className="px-2 py-1 text-center font-bold">{r.english || '-'}</td>
                        <td className="px-2 py-1 text-center font-bold">{r.mathematics || '-'}</td>
                        <td className="px-2 py-1 text-center font-bold">{r.science || '-'}</td>
                        <td className="px-2 py-1 text-center font-bold">{r.tamilLanguage || '-'}</td>
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
              {isImporting ? 'Ingesting to Database...' : `Save ${parsedImportRows.length} Requirements to Database`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create / Edit Single Record Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit O/L Requirement' : 'Add O/L Requirement'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Uni-Codes *
            </label>
            <input
              type="text"
              required
              value={formData.uniCodes || ''}
              onChange={(e) => setFormData({ ...formData, uniCodes: e.target.value })}
              placeholder="e.g. 011G or 025A/025B/025E"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
              placeholder="e.g. Quantity Surveying, Law, Architecture"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-5 gap-2">
            <div>
              <label className="block text-2xs font-semibold text-gray-700 dark:text-zinc-300 mb-1 text-center">
                Sin. Lang.
              </label>
              <input
                type="text"
                value={formData.sinhalaLanguage || ''}
                onChange={(e) => setFormData({ ...formData, sinhalaLanguage: e.target.value })}
                placeholder="e.g. C*"
                className="w-full px-2 py-2 text-xs text-center font-bold bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold text-gray-700 dark:text-zinc-300 mb-1 text-center">
                Eng.
              </label>
              <input
                type="text"
                value={formData.english || ''}
                onChange={(e) => setFormData({ ...formData, english: e.target.value })}
                placeholder="e.g. C"
                className="w-full px-2 py-2 text-xs text-center font-bold bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold text-gray-700 dark:text-zinc-300 mb-1 text-center">
                Mat.
              </label>
              <input
                type="text"
                value={formData.mathematics || ''}
                onChange={(e) => setFormData({ ...formData, mathematics: e.target.value })}
                placeholder="e.g. C"
                className="w-full px-2 py-2 text-xs text-center font-bold bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold text-gray-700 dark:text-zinc-300 mb-1 text-center">
                Sci.
              </label>
              <input
                type="text"
                value={formData.science || ''}
                onChange={(e) => setFormData({ ...formData, science: e.target.value })}
                placeholder="e.g. S"
                className="w-full px-2 py-2 text-xs text-center font-bold bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold text-gray-700 dark:text-zinc-300 mb-1 text-center">
                Tam. Lang.
              </label>
              <input
                type="text"
                value={formData.tamilLanguage || ''}
                onChange={(e) => setFormData({ ...formData, tamilLanguage: e.target.value })}
                placeholder="e.g. C*"
                className="w-full px-2 py-2 text-xs text-center font-bold bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Notes / Remarks (Optional)
            </label>
            <input
              type="text"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. *Pass with a credit in Sinhala Language or Tamil Language"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
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
              {editingId ? 'Update Requirement' : 'Create Requirement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
