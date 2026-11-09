'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  getOlRequirements,
  createOlRequirement,
  updateOlRequirement,
  deleteOlRequirement,
} from '@/services/adminApi';
import { OlRequirement } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function OlRequirementsPage() {
  const [requirements, setRequirements] = useState<OlRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<OlRequirement>>({
    courseOfStudy: '',
    uniCodes: '',
    sinhalaLanguage: '',
    english: '',
    mathematics: '',
    science: '',
    tamilLanguage: '',
    notes: '',
  });

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
      courseOfStudy: '',
      uniCodes: '',
      sinhalaLanguage: '',
      english: '',
      mathematics: '',
      science: '',
      tamilLanguage: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: OlRequirement) => {
    setEditingId(item.id);
    setFormData({
      courseOfStudy: item.courseOfStudy || '',
      uniCodes: item.uniCodes || '',
      sinhalaLanguage: item.sinhalaLanguage || '',
      english: item.english || '',
      mathematics: item.mathematics || '',
      science: item.science || '',
      tamilLanguage: item.tamilLanguage || '',
      notes: item.notes || '',
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
        courseOfStudy: formData.courseOfStudy?.trim() || '',
        uniCodes: formData.uniCodes?.trim().toUpperCase() || '',
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

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return requirements;
    const q = searchQuery.toLowerCase();
    return requirements.filter(
      (r) =>
        (r.courseOfStudy || '').toLowerCase().includes(q) ||
        (r.uniCodes || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
    );
  }, [requirements, searchQuery]);

  const handleExportCsv = () => {
    if (!requirements.length) return;
    const headers = ['Course of Study', 'Uni-Codes', 'Sinhala Language', 'English', 'Mathematics', 'Science', 'Tamil Language', 'Notes'];
    const rows = requirements.map((r) => [
      `"${(r.courseOfStudy || '').replace(/"/g, '""')}"`,
      `"${r.uniCodes || ''}"`,
      `"${r.sinhalaLanguage || ''}"`,
      `"${r.english || ''}"`,
      `"${r.mathematics || ''}"`,
      `"${r.science || ''}"`,
      `"${r.tamilLanguage || ''}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ugc_ol_requirements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="G.C.E. (O/L) Requirements Management"
        description="Specific G.C.E. (Ordinary Level) requirements extracted from UGC Admissions Handbook"
      />

      {/* Search & Actions */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          placeholder="Search by Course of Study, Uni-Code, or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 max-w-md px-3.5 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={requirements.length === 0}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            + Add O/L Requirement
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white font-semibold border-b border-slate-700">
                <th className="px-4 py-3">Uni-Codes</th>
                <th className="px-5 py-3">Course of Study</th>
                <th className="px-3 py-3 text-center">Sinhala</th>
                <th className="px-3 py-3 text-center">English</th>
                <th className="px-3 py-3 text-center">Maths</th>
                <th className="px-3 py-3 text-center">Science</th>
                <th className="px-3 py-3 text-center">Tamil</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    Loading O/L requirements...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No O/L requirements found.
                  </td>
                </tr>
              ) : (
                filtered.map((r, index) => (
                  <tr
                    key={r.id}
                    className={index % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-slate-50 dark:bg-zinc-950'}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {r.uniCodes || '—'}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-zinc-100">
                      {r.courseOfStudy || '—'}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-gray-700 dark:text-zinc-300">
                      {r.sinhalaLanguage || '—'}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-gray-700 dark:text-zinc-300">
                      {r.english || '—'}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-gray-700 dark:text-zinc-300">
                      {r.mathematics || '—'}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-gray-700 dark:text-zinc-300">
                      {r.science || '—'}
                    </td>
                    <td className="px-3 py-3 text-center font-medium text-gray-700 dark:text-zinc-300">
                      {r.tamilLanguage || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 max-w-xs truncate">
                      {r.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="px-2 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded"
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

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit O/L Requirement' : 'Add O/L Requirement'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Course of Study *
            </label>
            <input
              type="text"
              required
              value={formData.courseOfStudy || ''}
              onChange={(e) => setFormData({ ...formData, courseOfStudy: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              placeholder="e.g. ARTS (SP) - MASS MEDIA"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Uni-Codes *
            </label>
            <input
              type="text"
              required
              value={formData.uniCodes || ''}
              onChange={(e) => setFormData({ ...formData, uniCodes: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg font-mono"
              placeholder="e.g. 020S"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Sinhala Language
              </label>
              <input
                type="text"
                value={formData.sinhalaLanguage || ''}
                onChange={(e) => setFormData({ ...formData, sinhalaLanguage: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
                placeholder="e.g. C or -"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                English
              </label>
              <input
                type="text"
                value={formData.english || ''}
                onChange={(e) => setFormData({ ...formData, english: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
                placeholder="e.g. S or C"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Mathematics
              </label>
              <input
                type="text"
                value={formData.mathematics || ''}
                onChange={(e) => setFormData({ ...formData, mathematics: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
                placeholder="e.g. C"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Science
              </label>
              <input
                type="text"
                value={formData.science || ''}
                onChange={(e) => setFormData({ ...formData, science: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
                placeholder="e.g. S"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Tamil Language
              </label>
              <input
                type="text"
                value={formData.tamilLanguage || ''}
                onChange={(e) => setFormData({ ...formData, tamilLanguage: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
                placeholder="e.g. C or -"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Special Notes / Requirements
            </label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              placeholder="e.g. Certified copy of certificate must be submitted"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
            >
              {editingId ? 'Update Requirement' : 'Create Requirement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
