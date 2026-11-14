'use client';

import React, { useEffect, useState } from 'react';
import { getDistricts, createDistrict, updateDistrict, deleteDistrict } from '@/services/adminApi';
import { District } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function DistrictsPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<District>>({
    code: '',
    name: '',
    province: 'Western',
    hasDisadvantage: false,
  });

  const loadDistricts = async () => {
    try {
      setIsLoading(true);
      const data = await getDistricts();
      setDistricts(data);
    } catch (err: any) {
      alert('Failed to load districts: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDistricts();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      code: '',
      name: '',
      province: 'Western',
      hasDisadvantage: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: District) => {
    setEditingId(d.id);
    setFormData({ ...d });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this district?')) return;
    try {
      await deleteDistrict(id);
      loadDistricts();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        code: formData.code || formData.name?.toUpperCase().replace(/[^A-Z0-9]/g, '_') || 'DISTRICT',
      };
      if (editingId) {
        await updateDistrict(editingId, payload);
      } else {
        await createDistrict(payload);
      }
      setIsModalOpen(false);
      loadDistricts();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const filtered = districts.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.province.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Districts Management"
        description="25 Sri Lankan administrative districts with educationally disadvantaged quota classification."
      />

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by district name or province..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-80 text-gray-900 dark:text-zinc-100 shadow-xs"
        />

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <span>+ Add District</span>
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5">District Name</th>
                <th className="px-4 py-3.5">Province</th>
                <th className="px-4 py-3.5">Disadvantaged Quota Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Loading districts...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No districts found.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                    <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-zinc-100">
                      {d.name}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-zinc-300">
                      {d.province}
                    </td>
                    <td className="px-4 py-3.5">
                      {d.hasDisadvantage ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(d)}
                          className="px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded"
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

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit District' : 'Create District'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              District Code *
            </label>
            <input
              type="text"
              required
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="Enter District Code"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              District Name *
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter District Name"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Province *
            </label>
            <select
              value={formData.province || ''}
              onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            >
              <option value="Western">Western</option>
              <option value="Central">Central</option>
              <option value="Southern">Southern</option>
              <option value="Northern">Northern</option>
              <option value="Eastern">Eastern</option>
              <option value="North Western">North Western</option>
              <option value="North Central">North Central</option>
              <option value="Uva">Uva</option>
              <option value="Sabaragamuwa">Sabaragamuwa</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="hasDisadvantage"
              checked={formData.hasDisadvantage || false}
              onChange={(e) => setFormData({ ...formData, hasDisadvantage: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
            />
            <label htmlFor="hasDisadvantage" className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
              Educationally Disadvantaged District (Quota eligible)
            </label>
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
              Save District
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

