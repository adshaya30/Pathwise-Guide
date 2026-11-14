'use client';

import React, { useEffect, useState } from 'react';
import {
  getCutoffs,
  createCutoff,
  updateCutoff,
  deleteCutoff,
  getUniCodes,
} from '@/services/adminApi';
import { Cutoff, UniCode } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

const DISTRICT_KEYS: { key: keyof Cutoff; label: string }[] = [
  { key: 'colombo', label: 'Colombo' },
  { key: 'gampaha', label: 'Gampaha' },
  { key: 'kalutara', label: 'Kalutara' },
  { key: 'kandy', label: 'Kandy' },
  { key: 'matale', label: 'Matale' },
  { key: 'nuwaraEliya', label: 'Nuwara Eliya' },
  { key: 'galle', label: 'Galle' },
  { key: 'matara', label: 'Matara' },
  { key: 'hambantota', label: 'Hambantota' },
  { key: 'jaffna', label: 'Jaffna' },
  { key: 'kilinochchi', label: 'Kilinochchi' },
  { key: 'mannar', label: 'Mannar' },
  { key: 'vavuniya', label: 'Vavuniya' },
  { key: 'mullaitivu', label: 'Mullaitivu' },
  { key: 'batticaloa', label: 'Batticaloa' },
  { key: 'ampara', label: 'Ampara' },
  { key: 'trincomalee', label: 'Trincomalee' },
  { key: 'kurunegala', label: 'Kurunegala' },
  { key: 'puttalam', label: 'Puttalam' },
  { key: 'anuradhapura', label: 'Anuradhapura' },
  { key: 'polonnaruwa', label: 'Polonnaruwa' },
  { key: 'badulla', label: 'Badulla' },
  { key: 'monaragala', label: 'Monaragala' },
  { key: 'ratnapura', label: 'Ratnapura' },
  { key: 'kegalle', label: 'Kegalle' },
];

export default function CutoffsPage() {
  const [cutoffs, setCutoffs] = useState<Cutoff[]>([]);
  const [uniCodes, setUniCodes] = useState<UniCode[]>([]);
  const [academicYear, setAcademicYear] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Cutoff>>({
    academicYear: '',
    uniCode: '',
    courseName: '',
    universityName: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [cutoffList, codeList] = await Promise.all([
        getCutoffs(academicYear || undefined),
        getUniCodes(),
      ]);
      setCutoffs(cutoffList);
      setUniCodes(codeList);
    } catch (err: any) {
      alert('Failed to load cutoffs: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [academicYear]);

  // Dynamically extract distinct academic years from existing cutoffs
  const distinctYears = Array.from(new Set(cutoffs.map((c) => c.academicYear).filter(Boolean))).sort().reverse();

  const handleUniCodeChange = (codeVal: string) => {
    const match = uniCodes.find((u) => u.code.toLowerCase() === codeVal.trim().toLowerCase());
    if (match) {
      setFormData((prev) => ({
        ...prev,
        uniCodeId: match.id,
        uniCode: match.code,
        courseName: match.courseName,
        universityName: match.universityName,
      }));
    } else {
      setFormData((prev) => ({ ...prev, uniCode: codeVal }));
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      academicYear: academicYear || (distinctYears[0] || ''),
      uniCode: '',
      courseName: '',
      universityName: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Cutoff) => {
    setEditingId(c.id);
    setFormData({ ...c });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cutoff entry?')) return;
    try {
      await deleteCutoff(id);
      loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateCutoff(editingId, formData);
      } else {
        await createCutoff(formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const isDistrictNvq = (dKey: string) => {
    const list = (formData.nvqDistricts || '').split(',').map((s: string) => s.trim().toLowerCase());
    return list.includes(dKey.toLowerCase()) || String((formData as Record<string, any>)[dKey] || '').toUpperCase() === 'NVQ';
  };

  const getDistrictDisplayVal = (dKey: string) => {
    if (isDistrictNvq(dKey)) return 'NVQ';
    const v = (formData as Record<string, any>)[dKey];
    if (v !== undefined && v !== null && v !== '') return String(v);
    return '';
  };

  const handleDistrictValChange = (dKey: string, inputVal: string) => {
    const trimmed = inputVal.trim();
    let currentNvq = (formData.nvqDistricts || '')
      .split(',')
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean);

    if (trimmed.toUpperCase() === 'NVQ') {
      if (!currentNvq.includes(dKey.toLowerCase())) {
        currentNvq.push(dKey.toLowerCase());
      }
      setFormData({
        ...formData,
        [dKey]: null,
        nvqDistricts: currentNvq.join(','),
      });
    } else if (trimmed === '' || trimmed === '-' || trimmed.toUpperCase() === 'NQC' || trimmed.toUpperCase() === 'N/A') {
      currentNvq = currentNvq.filter((k: string) => k !== dKey.toLowerCase());
      setFormData({
        ...formData,
        [dKey]: null,
        nvqDistricts: currentNvq.length ? currentNvq.join(',') : null,
      });
    } else {
      const parsed = parseFloat(trimmed);
      currentNvq = currentNvq.filter((k: string) => k !== dKey.toLowerCase());
      setFormData({
        ...formData,
        [dKey]: isNaN(parsed) ? null : parsed,
        nvqDistricts: currentNvq.length ? currentNvq.join(',') : null,
      });
    }
  };

  const toggleDistrictNvq = (dKey: string) => {
    let currentNvq = (formData.nvqDistricts || '')
      .split(',')
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean);

    if (isDistrictNvq(dKey)) {
      currentNvq = currentNvq.filter((k: string) => k !== dKey.toLowerCase());
      setFormData({
        ...formData,
        [dKey]: null,
        nvqDistricts: currentNvq.length ? currentNvq.join(',') : null,
      });
    } else {
      if (!currentNvq.includes(dKey.toLowerCase())) {
        currentNvq.push(dKey.toLowerCase());
      }
      setFormData({
        ...formData,
        [dKey]: null,
        nvqDistricts: currentNvq.join(','),
      });
    }
  };

  const filteredCutoffs = cutoffs.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (q === 'nvq') {
      return Boolean(c.nvqDistricts && c.nvqDistricts.trim().length > 0);
    }
    return (
      c.uniCode.toLowerCase().includes(q) ||
      c.courseName.toLowerCase().includes(q) ||
      c.universityName.toLowerCase().includes(q) ||
      (c.nvqDistricts && c.nvqDistricts.toLowerCase().includes(q))
    );
  });

  const totalNvqCount = cutoffs.filter((c) => Boolean(c.nvqDistricts && c.nvqDistricts.trim().length > 0)).length;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Cutoff (Z-Score) Management"
        description="Single-table design containing all 25 Sri Lankan administrative districts with horizontal scrolling."
      />

      {/* Action & Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-950 p-4 border border-gray-200 dark:border-zinc-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-gray-500">Academic Year:</label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-md text-gray-800 dark:text-zinc-200"
          >
            <option value="">All Academic Years</option>
            {distinctYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Uni-Code, Course, University or 'NVQ'..."
            className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-md w-80 text-gray-900 dark:text-zinc-100"
          />

          {totalNvqCount > 0 && (
            <button
              type="button"
              onClick={() => setSearchQuery(searchQuery === 'nvq' ? '' : 'nvq')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${
                searchQuery.toLowerCase() === 'nvq'
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
              }`}
              title="Filter cutoffs with NVQ requirements"
            >
              <span className="font-bold">NVQ Pathways:</span> {totalNvqCount}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 text-[11px] text-gray-500 dark:text-zinc-400">
            <span className="font-mono bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">1.8500</span> Score
            <span>•</span>
            <span className="px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">NVQ</span> Vocational
            <span>•</span>
            <span className="font-mono text-gray-400">—</span> NQC / None
          </div>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <span>+ Add Cutoff Entry</span>
          </button>
        </div>
      </div>

      {/* 25-District Horizontal Scrolling Table */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-900/80 border-b border-gray-200 dark:border-zinc-800 text-[11px] font-bold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-3 py-3 sticky left-0 bg-gray-50 dark:bg-zinc-900 z-10 shadow-r">
                  Uni-Code
                </th>
                <th className="px-3 py-3 sticky left-20 bg-gray-50 dark:bg-zinc-900 z-10 shadow-r">
                  Course & University
                </th>
                <th className="px-3 py-3">Year</th>
                {DISTRICT_KEYS.map((d) => (
                  <th key={d.key} className="px-2.5 py-3 text-center">
                    {d.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-right sticky right-0 bg-gray-50 dark:bg-zinc-900 z-10">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={29} className="px-6 py-12 text-center text-gray-500">
                    Loading cutoffs...
                  </td>
                </tr>
              ) : filteredCutoffs.length === 0 ? (
                <tr>
                  <td colSpan={29} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No cutoff records found for {academicYear}.
                  </td>
                </tr>
              ) : (
                filteredCutoffs.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                    <td className="px-3 py-2.5 font-bold font-mono text-indigo-700 dark:text-indigo-400 sticky left-0 bg-white dark:bg-zinc-950 z-10 shadow-r">
                      {c.uniCode}
                    </td>

                    <td className="px-3 py-2.5 sticky left-20 bg-white dark:bg-zinc-950 z-10 shadow-r max-w-xs truncate">
                      <div className="font-semibold text-gray-900 dark:text-zinc-100">{c.courseName}</div>
                      <div className="text-[11px] text-gray-400">{c.universityName}</div>
                    </td>

                    <td className="px-3 py-2.5 text-gray-500 font-mono">{c.academicYear}</td>

                    {DISTRICT_KEYS.map((d) => {
                      const val = c[d.key];
                      const nvqList = (c.nvqDistricts || '').split(',').map((s) => s.trim().toLowerCase());
                      const isNvq = nvqList.includes(d.key.toLowerCase()) || String(val || '').toUpperCase() === 'NVQ';
                      return (
                        <td key={d.key} className="px-2.5 py-2.5 text-center font-mono text-[11px]">
                          {isNvq ? (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300/50 dark:border-amber-700/50"
                              title={`${d.label}: NVQ (National Vocational Qualification) Candidate Requirement`}
                            >
                              NVQ
                            </span>
                          ) : val !== undefined && val !== null && String(val).trim() !== '' ? (
                            <span className="text-gray-800 dark:text-zinc-200 font-medium">
                              {Number(val).toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-zinc-700">—</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2.5 text-right sticky right-0 bg-white dark:bg-zinc-950 z-10">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="px-2 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-50 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cutoff Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Cutoff Entry' : 'Create Cutoff Entry'}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Academic Year *
              </label>
              <input
                type="text"
                required
                value={formData.academicYear || ''}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                placeholder="Enter Academic Year"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
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
                onChange={(e) => handleUniCodeChange(e.target.value)}
                placeholder="Type Uni-Code to autofill..."
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Course Name *
              </label>
              <input
                type="text"
                required
                value={formData.courseName || ''}
                onChange={(e) => setFormData({ ...formData, courseName: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                University Name *
              </label>
              <input
                type="text"
                required
                value={formData.universityName || ''}
                onChange={(e) => setFormData({ ...formData, universityName: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                District Minimum Z-Scores (All 25 Districts)
              </label>
              <div className="text-[11px] text-gray-500 dark:text-zinc-400">
                Enter decimal cutoff (e.g. <span className="font-mono font-semibold">1.8500</span>) or type <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">NVQ</span> (or click the NVQ toggle)
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 p-3 bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 max-h-60 overflow-y-auto">
              {DISTRICT_KEYS.map((d) => {
                const isNvq = isDistrictNvq(d.key);
                return (
                  <div key={d.key}>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[11px] font-semibold text-gray-600 dark:text-zinc-400 truncate pr-1">
                        {d.label}
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleDistrictNvq(d.key)}
                        className={`text-[9px] px-1 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                          isNvq
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-gray-200 dark:bg-zinc-800 text-gray-500 hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-900/40'
                        }`}
                        title="Click to toggle NVQ qualification for this district"
                      >
                        NVQ
                      </button>
                    </div>
                    <input
                      type="text"
                      value={getDistrictDisplayVal(d.key)}
                      onChange={(e) => handleDistrictValChange(d.key, e.target.value)}
                      placeholder="1.8500 or NVQ"
                      className={`w-full px-2 py-1 text-xs font-mono rounded-md border transition-colors ${
                        isNvq
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-400 text-amber-900 dark:text-amber-300 font-bold'
                          : 'bg-white dark:bg-zinc-950 border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-zinc-100'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              Save Cutoff
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

