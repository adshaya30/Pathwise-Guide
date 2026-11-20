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

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    setEditingId(null);
    setFormData({
      code: '',
      name: '',
      location: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (uni: University) => {
    setEditingId(uni.id);
    setFormData({ ...uni });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this university? Warning: Connected Uni-Codes will be impacted.')) return;
    try {
      await deleteUniversity(id);
      loadUniversities();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
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

      if (editingId) {
        await updateUniversity(editingId, payload);
      } else {
        await createUniversity(payload);
      }
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
        description="State Universities, campuses, and institutes established under the Universities Act No. 16 of 1978."
      />

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by university code, name, location..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-80 text-gray-900 dark:text-zinc-100 shadow-xs"
        />

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <span>+ Add University</span>
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5">University Code</th>
                <th className="px-4 py-3.5">University Name</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
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
                filtered.map((uni) => (
                  <tr key={uni.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
                    <td className="px-4 py-3.5 font-bold font-mono text-indigo-700 dark:text-indigo-400">
                      {uni.code}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-zinc-100">
                      {uni.name}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-zinc-300">
                      {uni.location || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(uni)}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded border border-indigo-200 dark:border-indigo-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(uni.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded border border-rose-200"
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
        title={editingId ? 'Edit University' : 'Add University'}
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
              Location
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. College House, 94 Cumaratunga Munidasa Mawatha, Colombo 03"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              {editingId ? 'Save Changes' : 'Create University'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
