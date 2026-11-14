'use client';

import React, { useEffect, useState } from 'react';
import {
  getArtsBaskets,
  createArtsBasket,
  updateArtsBasket,
  deleteArtsBasket,
  getArtsBasketSubjects,
  addSubjectToBasket,
  removeSubjectFromBasket,
  getSubjects,
} from '@/services/adminApi';
import { ArtsBasket, ArtsBasketSubject, Subject } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function ArtsBasketsPage() {
  const [baskets, setBaskets] = useState<ArtsBasket[]>([]);
  const [basketSubjects, setBasketSubjects] = useState<Record<string, ArtsBasketSubject[]>>({});
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Basket Modal
  const [isBasketModalOpen, setIsBasketModalOpen] = useState(false);
  const [editingBasketId, setEditingBasketId] = useState<string | null>(null);
  const [basketFormData, setBasketFormData] = useState<Partial<ArtsBasket>>({
    basketNumber: 1,
    basketName: '',
    minSubjectsRequired: 1,
    maxSubjectsAllowed: 3,
    rulesDescription: '',
  });

  // Add Subject Modal
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [targetBasketId, setTargetBasketId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [bList, sList] = await Promise.all([getArtsBaskets(), getSubjects()]);
      setBaskets(bList);
      setAllSubjects(sList);

      const subMap: Record<string, ArtsBasketSubject[]> = {};
      for (const b of bList) {
        try {
          const subs = await getArtsBasketSubjects(b.id);
          subMap[b.id] = subs;
        } catch (ignored) {}
      }
      setBasketSubjects(subMap);
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
    setEditingBasketId(null);
    setBasketFormData({
      basketNumber: (baskets.length || 0) + 1,
      basketName: '',
      minSubjectsRequired: 1,
      maxSubjectsAllowed: 2,
      rulesDescription: 'Candidates must choose subjects adhering to UGC Arts criteria.',
    });
    setIsBasketModalOpen(true);
  };

  const handleOpenEditBasket = (b: ArtsBasket) => {
    setEditingBasketId(b.id);
    setBasketFormData({ ...b });
    setIsBasketModalOpen(true);
  };

  const handleDeleteBasket = async (id: string) => {
    if (!confirm('Are you sure you want to delete this arts basket?')) return;
    try {
      await deleteArtsBasket(id);
      loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSaveBasket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBasketId) {
        await updateArtsBasket(editingBasketId, basketFormData);
      } else {
        await createArtsBasket(basketFormData);
      }
      setIsBasketModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const handleOpenAddSubject = (basketId: string) => {
    setTargetBasketId(basketId);
    setSelectedSubjectId(allSubjects[0]?.id || '');
    setIsSubjectModalOpen(true);
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBasketId || !selectedSubjectId) return;

    const sub = allSubjects.find((s) => s.id === selectedSubjectId);
    if (!sub) return;

    try {
      await addSubjectToBasket(targetBasketId, {
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
      });
      setIsSubjectModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Add subject failed: ' + err.message);
    }
  };

  const handleRemoveSubject = async (subjectLinkId: string) => {
    if (!confirm('Remove subject from this basket?')) return;
    try {
      await removeSubjectFromBasket(subjectLinkId);
      loadData();
    } catch (err: any) {
      alert('Remove failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Arts Basket Subjects Management"
        description="Arts stream subject classification baskets (Social Sciences, Humanities, Aesthetics) and subject selection rules."
      />

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Configured Baskets</h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Total baskets: {baskets.length}</p>
        </div>
        <button
          onClick={handleOpenCreateBasket}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <span>+ Add Arts Basket</span>
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-zinc-950 p-12 text-center text-gray-500 rounded-xl border border-gray-200 dark:border-zinc-800">
          Loading baskets...
        </div>
      ) : baskets.length === 0 ? (
        <div className="bg-white dark:bg-zinc-950 p-12 text-center text-gray-500 rounded-xl border border-gray-200 dark:border-zinc-800">
          No arts baskets configured yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {baskets.map((basket) => {
            const subjects = basketSubjects[basket.id] || [];

            return (
              <div
                key={basket.id}
                className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      Basket {basket.basketNumber}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditBasket(basket)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBasket(basket.id)}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-gray-900 dark:text-zinc-100">
                    {basket.basketName}
                  </h4>

                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    Selection rules: Min {basket.minSubjectsRequired} / Max {basket.maxSubjectsAllowed} subjects
                  </p>

                  {basket.rulesDescription && (
                    <p className="text-[11px] text-gray-400 italic mt-2">
                      {basket.rulesDescription}
                    </p>
                  )}

                  {/* Subject List */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-bold text-gray-500 uppercase">
                        Subjects ({subjects.length})
                      </h5>
                      <button
                        onClick={() => handleOpenAddSubject(basket.id)}
                        className="text-xs text-indigo-600 font-semibold hover:underline"
                      >
                        + Add Subject
                      </button>
                    </div>

                    {subjects.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No subjects added to this basket yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {subjects.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-medium"
                          >
                            <span>{s.subjectName}</span>
                            <button
                              onClick={() => handleRemoveSubject(s.id)}
                              className="text-gray-400 hover:text-rose-600"
                              title="Remove subject"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Basket Modal */}
      <Modal
        isOpen={isBasketModalOpen}
        onClose={() => setIsBasketModalOpen(false)}
        title={editingBasketId ? 'Edit Arts Basket' : 'Create Arts Basket'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveBasket} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Basket Number *
              </label>
              <input
                type="number"
                required
                value={basketFormData.basketNumber || 1}
                onChange={(e) => setBasketFormData({ ...basketFormData, basketNumber: parseInt(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Max Allowed *
              </label>
              <input
                type="number"
                required
                value={basketFormData.maxSubjectsAllowed || 2}
                onChange={(e) => setBasketFormData({ ...basketFormData, maxSubjectsAllowed: parseInt(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Basket Name *
            </label>
            <input
              type="text"
              required
              value={basketFormData.basketName || ''}
              onChange={(e) => setBasketFormData({ ...basketFormData, basketName: e.target.value })}
              placeholder="Enter Basket Name"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Rules Description
            </label>
            <textarea
              rows={3}
              value={basketFormData.rulesDescription || ''}
              onChange={(e) => setBasketFormData({ ...basketFormData, rulesDescription: e.target.value })}
              className="w-full p-2.5 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsBasketModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              Save Basket
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Subject Modal */}
      <Modal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title="Add Subject to Arts Basket"
        maxWidth="md"
      >
        <form onSubmit={handleAddSubject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Select Subject *
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
            >
              {allSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsSubjectModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              Add to Basket
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

