'use client';

import React, { useEffect, useState } from 'react';
import {
  getArtsBaskets,
  createArtsBasket,
  updateArtsBasket,
  deleteArtsBasket,
} from '@/services/adminApi';
import { ArtsBasket } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function ArtsBasketsPage() {
  const [baskets, setBaskets] = useState<ArtsBasket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Live status for direct inline cell saving: [basketId-field]: 'saving' | 'saved' | 'error'
  const [cellStatus, setCellStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

  // Basket Modal (for creating new basket)
  const [isBasketModalOpen, setIsBasketModalOpen] = useState(false);
  const [basketFormData, setBasketFormData] = useState<Partial<ArtsBasket>>({
    basketName: '',
    availableSubjects: '',
    rulesDescription: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const bList = await getArtsBaskets();
      setBaskets(bList);
    } catch (err: any) {
      alert('Failed to load arts baskets: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateBasket = () => {
    setBasketFormData({
      basketName: '',
      availableSubjects: '',
      rulesDescription: 'Candidates must choose subjects adhering to UGC Arts criteria.',
    });
    setIsBasketModalOpen(true);
  };

  const handleDeleteBasket = async (id: string) => {
    if (!confirm('Are you sure you want to delete this arts basket?')) return;
    try {
      await deleteArtsBasket(id);
      setBaskets((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Direct edit: on input change in table
  const handleCellChange = (
    basketId: string,
    field: 'basketName' | 'availableSubjects' | 'rulesDescription',
    value: string
  ) => {
    setBaskets((prev) =>
      prev.map((b) => (b.id === basketId ? { ...b, [field]: value } : b))
    );
  };

  // Direct edit: on blur or Enter save to backend
  const handleCellBlur = async (
    basket: ArtsBasket,
    field: 'basketName' | 'availableSubjects' | 'rulesDescription',
    value: string
  ) => {
    const trimmed = value.trim();
    const cellKey = `${basket.id}-${field}`;
    setCellStatus((prev) => ({ ...prev, [cellKey]: 'saving' }));

    try {
      const payload: Partial<ArtsBasket> = {
        ...basket,
        [field]: trimmed,
      };
      const saved = await updateArtsBasket(basket.id, payload);
      setBaskets((prev) => prev.map((item) => (item.id === basket.id ? { ...item, ...saved } : item)));
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
      console.error('Failed to update arts basket:', err);
    }
  };

  const handleSaveBasket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!basketFormData.basketName?.trim()) {
      alert('Basket Name is required.');
      return;
    }

    try {
      const payload: Partial<ArtsBasket> = {
        basketName: basketFormData.basketName.trim(),
        availableSubjects: basketFormData.availableSubjects?.trim() || '',
        rulesDescription: basketFormData.rulesDescription?.trim() || '',
        basketNumber: (baskets.length || 0) + 1,
        minSubjectsRequired: 1,
        maxSubjectsAllowed: 3,
      };
      await createArtsBasket(payload);
      setIsBasketModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const filtered = baskets.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (b.basketName || '').toLowerCase().includes(q) ||
      (b.availableSubjects || '').toLowerCase().includes(q) ||
      (b.rulesDescription || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Arts Stream Subject Baskets"
        description="Section 2.2.1: Arts Stream subject baskets, selection rules, and available subjects. Directly edit basket names, available subjects, and guidance inline."
      />

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by basket name or available subjects..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-80 text-gray-900 dark:text-zinc-100 shadow-xs"
        />

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            ⚡ Direct Edit Enabled
          </span>

          <button
            onClick={handleOpenCreateBasket}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            <span>+ Add Arts Basket</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5 w-1/4">Basket Name</th>
                <th className="px-4 py-3.5 w-1/2">Available Subjects</th>
                <th className="px-4 py-3.5 w-1/4">Rules & Guidance Description</th>
                <th className="px-4 py-3.5 text-right w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Loading arts baskets...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No arts baskets found. Click <strong>+ Add Arts Basket</strong> to create one.
                  </td>
                </tr>
              ) : (
                filtered.map((basket) => {
                  const nameKey = `${basket.id}-basketName`;
                  const subjKey = `${basket.id}-availableSubjects`;
                  const descKey = `${basket.id}-rulesDescription`;

                  return (
                    <tr key={basket.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
                      {/* Basket Name */}
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={basket.basketName || ''}
                          onChange={(e) => handleCellChange(basket.id, 'basketName', e.target.value)}
                          onBlur={(e) => handleCellBlur(basket, 'basketName', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="Basket Name"
                          className={`w-full font-semibold text-gray-900 dark:text-zinc-100 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2.5 py-1.5 outline-none transition-all ${
                            cellStatus[nameKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[nameKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[nameKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Basket Name directly"
                        />
                      </td>

                      {/* Available Subjects */}
                      <td className="px-3 py-2 align-top">
                        <textarea
                          rows={2}
                          value={basket.availableSubjects || ''}
                          onChange={(e) => handleCellChange(basket.id, 'availableSubjects', e.target.value)}
                          onBlur={(e) => handleCellBlur(basket, 'availableSubjects', e.target.value)}
                          placeholder="Available Subjects (e.g. Anthropology, Economics, Geography, History, Political Science, Psychology, Sociology...)"
                          className={`w-full text-xs text-gray-600 dark:text-zinc-300 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2.5 py-1.5 outline-none transition-all resize-y ${
                            cellStatus[subjKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[subjKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[subjKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Available Subjects directly"
                        />
                      </td>

                      {/* Rules & Guidance Description */}
                      <td className="px-3 py-2 align-top">
                        <textarea
                          rows={2}
                          value={basket.rulesDescription || ''}
                          onChange={(e) => handleCellChange(basket.id, 'rulesDescription', e.target.value)}
                          onBlur={(e) => handleCellBlur(basket, 'rulesDescription', e.target.value)}
                          placeholder="Rules & guidance description..."
                          className={`w-full text-xs text-gray-500 dark:text-zinc-400 italic bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2.5 py-1.5 outline-none transition-all resize-y ${
                            cellStatus[descKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[descKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[descKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Guidance Notes directly"
                        />
                      </td>

                      {/* Actions: Delete only */}
                      <td className="px-3 py-2 align-top text-right">
                        <button
                          onClick={() => handleDeleteBasket(basket.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                          title="Delete arts basket"
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

      {/* Add Arts Basket Modal */}
      <Modal
        isOpen={isBasketModalOpen}
        onClose={() => setIsBasketModalOpen(false)}
        title="Add Arts Basket"
        maxWidth="md"
      >
        <form onSubmit={handleSaveBasket} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Basket Name *
            </label>
            <input
              type="text"
              required
              value={basketFormData.basketName || ''}
              onChange={(e) => setBasketFormData({ ...basketFormData, basketName: e.target.value })}
              placeholder="e.g. Social Sciences, Humanities, Aesthetic Studies"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Available Subjects *
            </label>
            <textarea
              rows={4}
              required
              value={basketFormData.availableSubjects || ''}
              onChange={(e) => setBasketFormData({ ...basketFormData, availableSubjects: e.target.value })}
              placeholder="e.g. Anthropology, Economics, Geography, History, Political Science, Psychology, Sociology"
              className="w-full p-2.5 text-xs bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            />
            <p className="text-[11px] text-gray-400 mt-1">List of recognized subjects available under this basket.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Rules & Guidance Description
            </label>
            <textarea
              rows={3}
              value={basketFormData.rulesDescription || ''}
              onChange={(e) => setBasketFormData({ ...basketFormData, rulesDescription: e.target.value })}
              placeholder="e.g. Candidates must select at least one subject from this basket..."
              className="w-full p-2.5 text-xs bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsBasketModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              Create Basket
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
