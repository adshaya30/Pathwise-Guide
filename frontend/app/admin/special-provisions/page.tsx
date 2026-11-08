'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  getSpecialProvisions,
  createSpecialProvision,
  updateSpecialProvision,
  deleteSpecialProvision,
} from '@/services/adminApi';
import { SpecialProvision } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function SpecialProvisionsPage() {
  const [provisions, setProvisions] = useState<SpecialProvision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SpecialProvision>>({
    universityName: '',
    courseOfStudy: '',
    uniCode: '',
    differentlyAbled: 1,
    blindBraille: 0,
    category: 'BLIND_AND_DIFFERENTLY_ABLED',
  });

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

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      universityName: '',
      courseOfStudy: '',
      uniCode: '',
      differentlyAbled: 1,
      blindBraille: 0,
      category: 'BLIND_AND_DIFFERENTLY_ABLED',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sp: SpecialProvision) => {
    setEditingId(sp.id);
    setFormData({
      universityName: sp.universityName || '',
      courseOfStudy: sp.courseOfStudy || sp.title || '',
      uniCode: sp.uniCode || '',
      differentlyAbled: sp.differentlyAbled ?? 0,
      blindBraille: sp.blindBraille ?? 0,
      category: sp.category || 'BLIND_AND_DIFFERENTLY_ABLED',
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
        ...formData,
        universityName: formData.universityName?.trim() || '',
        courseOfStudy: formData.courseOfStudy?.trim() || '',
        uniCode: formData.uniCode?.trim().toUpperCase() || '',
        differentlyAbled: Number(formData.differentlyAbled ?? 0),
        blindBraille: Number(formData.blindBraille ?? 0),
        title: `${formData.courseOfStudy} - ${formData.universityName}`,
        description: `UGC Section 6.1 Special Provision for ${formData.courseOfStudy} (${formData.uniCode})`,
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

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return provisions;
    const q = searchQuery.toLowerCase();
    return provisions.filter(
      (p) =>
        (p.universityName || '').toLowerCase().includes(q) ||
        (p.courseOfStudy || p.title || '').toLowerCase().includes(q) ||
        (p.uniCode || '').toLowerCase().includes(q)
    );
  }, [provisions, searchQuery]);

  const stats = useMemo(() => {
    const totalAllocations = provisions.length;
    const totalDifferentlyAbled = provisions.reduce((sum, p) => sum + (p.differentlyAbled || 0), 0);
    const totalBlindBraille = provisions.reduce((sum, p) => sum + (p.blindBraille || 0), 0);
    const uniqueUnis = new Set(provisions.map((p) => p.universityName).filter(Boolean)).size;
    return { totalAllocations, totalDifferentlyAbled, totalBlindBraille, uniqueUnis };
  }, [provisions]);

  const formatSeats = (num?: number | null) => {
    if (num === undefined || num === null || num === 0) {
      return <span className="text-gray-400 dark:text-zinc-500 font-semibold">—</span>;
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
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by university, course of study or uni-code..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-96 text-gray-900 dark:text-zinc-100 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <span>+ Add Allocation</span>
        </button>
      </div>

      {/* Table matching Screenshot 3 UGC Handbook Format */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100/80 dark:bg-zinc-900/80 border-b border-gray-200 dark:border-zinc-800 text-xs font-bold text-gray-700 dark:text-zinc-300">
                <th rowSpan={2} className="px-5 py-3.5 align-middle border-r border-gray-200 dark:border-zinc-800">
                  University
                </th>
                <th rowSpan={2} className="px-5 py-3.5 align-middle border-r border-gray-200 dark:border-zinc-800">
                  Course of Study
                </th>
                <th rowSpan={2} className="px-4 py-3.5 align-middle text-center border-r border-gray-200 dark:border-zinc-800">
                  Uni-Codes
                </th>
                <th colSpan={2} className="px-4 py-2 text-center border-b border-r border-gray-200 dark:border-zinc-800 uppercase tracking-wider text-2xs">
                  No of Students
                </th>
                <th rowSpan={2} className="px-5 py-3.5 text-right align-middle">
                  Actions
                </th>
              </tr>
              <tr className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400">
                <th className="px-4 py-2.5 text-center border-r border-gray-200 dark:border-zinc-800">
                  Differently abled
                </th>
                <th className="px-4 py-2.5 text-center border-r border-gray-200 dark:border-zinc-800 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold">
                  Blind (Braille)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading special provisions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No special provisions found.
                  </td>
                </tr>
              ) : (
                filtered.map((sp) => (
                  <tr key={sp.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-zinc-100 border-r border-gray-100 dark:border-zinc-900">
                      {sp.universityName || '—'}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-zinc-100 border-r border-gray-100 dark:border-zinc-900">
                      {sp.courseOfStudy || sp.title || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-xs text-indigo-700 dark:text-indigo-400 border-r border-gray-100 dark:border-zinc-900">
                      <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded">
                        {sp.uniCode || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-sm text-gray-900 dark:text-zinc-100 border-r border-gray-100 dark:border-zinc-900">
                      {formatSeats(sp.differentlyAbled)}
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-sm text-amber-600 dark:text-amber-400 border-r border-gray-100 dark:border-zinc-900 bg-amber-50/30 dark:bg-amber-950/10">
                      {formatSeats(sp.blindBraille)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(sp)}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(sp.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded"
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

      {/* Create / Edit Modal */}
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
              placeholder="e.g. University of Colombo"
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
              placeholder="e.g. Arts, Biological Science, Physical Science"
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
              placeholder="e.g. 019A"
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
