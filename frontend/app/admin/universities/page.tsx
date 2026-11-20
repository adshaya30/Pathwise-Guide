'use client';

import React, { useEffect, useState } from 'react';
import {
  getUniversities,
  createUniversity,
  updateUniversity,
  deleteUniversity,
} from '@/services/adminApi';
import { University } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function UniversitiesPage() {
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Live status for direct inline cell saving: [uniId-field]: 'saving' | 'saved' | 'error'
  const [cellStatus, setCellStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

  // Modal states (for creating new university)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<University>>({
    code: '',
    name: '',
    location: '',
  });

  const loadUniversities = async () => {
    try {
      setIsLoading(true);
      const data = await getUniversities();
      setUniversities(data);
    } catch (err: any) {
      alert('Failed to load universities: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUniversities();
  }, []);

  const handleOpenCreate = () => {
    setFormData({
      code: '',
      name: '',
      location: '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this university? Warning: Connected Uni-Codes will be impacted.')) return;
    try {
      await deleteUniversity(id);
      setUniversities((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Direct edit: on input change in table
  const handleCellChange = (uniId: string, field: 'code' | 'name' | 'location', value: string) => {
    setUniversities((prev) =>
      prev.map((u) => (u.id === uniId ? { ...u, [field]: value } : u))
    );
  };

  // Direct edit: on blur or Enter save to backend
  const handleCellBlur = async (uni: University, field: 'code' | 'name' | 'location', value: string) => {
    const trimmed = field === 'code' ? value.trim().toUpperCase() : value.trim();
    const cellKey = `${uni.id}-${field}`;
    setCellStatus((prev) => ({ ...prev, [cellKey]: 'saving' }));

    try {
      const payload: Partial<University> = {
        ...uni,
        [field]: trimmed,
      };
      const saved = await updateUniversity(uni.id, payload);
      setUniversities((prev) => prev.map((item) => (item.id === uni.id ? { ...item, ...saved } : item)));
      setCellStatus((prev) => ({ ...prev, [cellKey]: 'saved' }));
      setTimeout(() => {
        setCellStatus((prev) => {
          const next = { ...prev };
          delete next[cellKey];
          return next;
        });
      }, 1500);
    } catch (err: any) {
      setCellStatus((prev) => ({ ...prev, [cellKey]: 'error' }));
      console.error('Failed to update university:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code?.trim() || !formData.name?.trim()) {
      alert('University Code and University Name are required.');
      return;
    }

    try {
      const payload: Partial<University> = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        location: formData.location?.trim() || '',
      };

      await createUniversity(payload);
      setIsModalOpen(false);
      loadUniversities();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const filtered = universities.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.code.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      (u.location || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Universities & Higher Educational Institutes"
        description="Directly edit university code, official name, and campus location inline. Changes save automatically."
      />

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by university code, name, location..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-80 text-gray-900 dark:text-zinc-100 shadow-xs"
        />

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            ⚡ Direct Edit Enabled
          </span>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <span>+ Add University</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5 w-40">University Code</th>
                <th className="px-4 py-3.5">University Name</th>
                <th className="px-4 py-3.5 w-60">Location</th>
                <th className="px-4 py-3.5 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Loading universities...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No universities found. Click <strong>+ Add University</strong> to create one.
                  </td>
                </tr>
              ) : (
                filtered.map((uni) => {
                  const codeKey = `${uni.id}-code`;
                  const nameKey = `${uni.id}-name`;
                  const locKey = `${uni.id}-location`;

                  return (
                    <tr key={uni.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={uni.code || ''}
                          onChange={(e) => handleCellChange(uni.id, 'code', e.target.value)}
                          onBlur={(e) => handleCellBlur(uni, 'code', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="CODE"
                          className={`w-full font-bold font-mono text-indigo-700 dark:text-indigo-400 uppercase bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2.5 py-1.5 outline-none transition-all ${
                            cellStatus[codeKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[codeKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[codeKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit University Code directly"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={uni.name || ''}
                          onChange={(e) => handleCellChange(uni.id, 'name', e.target.value)}
                          onBlur={(e) => handleCellBlur(uni, 'name', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="University Name"
                          className={`w-full font-semibold text-gray-900 dark:text-zinc-100 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2.5 py-1.5 outline-none transition-all ${
                            cellStatus[nameKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[nameKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[nameKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit University Name directly"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={uni.location || ''}
                          onChange={(e) => handleCellChange(uni.id, 'location', e.target.value)}
                          onBlur={(e) => handleCellBlur(uni, 'location', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="Location / Campus"
                          className={`w-full text-xs text-gray-600 dark:text-zinc-300 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2.5 py-1.5 outline-none transition-all ${
                            cellStatus[locKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[locKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[locKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Location directly"
                        />
                      </td>

                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleDelete(uni.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                          title="Delete university"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add University"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              University Code *
            </label>
            <input
              type="text"
              required
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. UOC, UOP, UOM"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100 font-mono"
            />
            <p className="text-[11px] text-gray-400 mt-0.5">Short abbreviation code for the university.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              University Name *
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. University of Colombo"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Location / City
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Colombo 03, Western Province"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
            >
              Save University
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
