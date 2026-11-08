'use client';

import React, { useEffect, useState } from 'react';
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
  const [categoryFilter, setCategoryFilter] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SpecialProvision>>({
    category: 'DIFFERENTLY_ABLED',
    title: '',
    description: '',
    quotaPercentage: 3.0,
    conditions: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await getSpecialProvisions(categoryFilter || undefined);
      setProvisions(data);
    } catch (err: any) {
      alert('Failed to load special provisions: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      category: 'DIFFERENTLY_ABLED',
      title: '',
      description: '',
      quotaPercentage: 3.0,
      conditions: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sp: SpecialProvision) => {
    setEditingId(sp.id);
    setFormData({ ...sp });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this special provision?')) return;
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
      if (editingId) {
        await updateSpecialProvision(editingId, formData);
      } else {
        await createSpecialProvision(formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Special Provisions Management"
        description="UGC admission quotas and policies for differently abled candidates, blind/braille students, and exceptional admissions."
      />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {['', 'DIFFERENTLY_ABLED', 'BLIND_BRAILLE', 'SPORTS', 'EXCEPTIONAL'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                categoryFilter === cat
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-800'
              }`}
            >
              {cat === '' ? 'ALL' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <span>+ Add Provision</span>
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Title</th>
                <th className="px-4 py-3.5">Description</th>
                <th className="px-4 py-3.5">Quota %</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Loading provisions...
                  </td>
                </tr>
              ) : provisions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No special provisions configured.
                  </td>
                </tr>
              ) : (
                provisions.map((sp) => (
                  <tr key={sp.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                    <td className="px-4 py-3.5 font-bold font-mono text-xs uppercase text-indigo-700 dark:text-indigo-400">
                      {sp.category}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-zinc-100">
                      {sp.title}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 max-w-md truncate">
                      {sp.description}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-gray-700 dark:text-zinc-300">
                      {sp.quotaPercentage ? `${sp.quotaPercentage}%` : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(sp)}
                          className="px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(sp.id)}
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
        title={editingId ? 'Edit Provision' : 'Create Special Provision'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Category *
              </label>
              <select
                value={formData.category || 'DIFFERENTLY_ABLED'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
              >
                <option value="DIFFERENTLY_ABLED">Differently Abled Candidates</option>
                <option value="BLIND_BRAILLE">Blind / Braille Provisions</option>
                <option value="SPORTS">Sports Achievements</option>
                <option value="EXCEPTIONAL">Exceptional Admissions</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Quota Percentage (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.quotaPercentage || ''}
                onChange={(e) => setFormData({ ...formData, quotaPercentage: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="e.g. 3.0"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Admission of Blind Candidates"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Description *
            </label>
            <textarea
              required
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2.5 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Conditions & Eligibility Rules
            </label>
            <textarea
              rows={2}
              value={formData.conditions || ''}
              onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
              className="w-full p-2.5 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
            />
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
              Save Provision
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
