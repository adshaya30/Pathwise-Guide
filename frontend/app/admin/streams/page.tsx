'use client';

import React, { useEffect, useState } from 'react';
import {
  getStreams,
  createStream,
  updateStream,
  deleteStream,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from '@/services/adminApi';
import { Stream, Subject } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function StreamsPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'STREAMS' | 'SUBJECTS'>('STREAMS');

  // Inline cell save indicator state: [key]: 'saving' | 'saved' | 'error'
  const [cellStatus, setCellStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

  // Stream Modal (for creating new streams)
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  const [streamFormData, setStreamFormData] = useState<Partial<Stream>>({
    code: '',
    name: '',
    description: '',
  });

  // Subject Modal (for creating new subjects)
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [subjectFormData, setSubjectFormData] = useState<Partial<Subject>>({
    code: '',
    name: '',
    basketCategory: 'GENERAL',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [strList, subList] = await Promise.all([getStreams(), getSubjects()]);
      setStreams(strList);
      setSubjects(subList);
    } catch (err: any) {
      alert('Failed to load streams/subjects: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateStream = () => {
    setStreamFormData({ code: '', name: '', description: '' });
    setIsStreamModalOpen(true);
  };

  const handleDeleteStream = async (id: string) => {
    if (!confirm('Are you sure you want to delete this stream?')) return;
    try {
      await deleteStream(id);
      setStreams((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    try {
      await deleteSubject(id);
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Direct edit: Stream cell change
  const handleStreamCellChange = (id: string, field: 'name' | 'description', val: string) => {
    setStreams((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  // Direct edit: Stream cell blur/enter save
  const handleStreamCellBlur = async (stream: Stream, field: 'name' | 'description', val: string) => {
    const trimmed = val.trim();
    const cellKey = `stream-${stream.id}-${field}`;
    setCellStatus((prev) => ({ ...prev, [cellKey]: 'saving' }));

    try {
      const payload: Partial<Stream> = {
        ...stream,
        [field]: trimmed,
      };
      if (field === 'name' && !payload.code) {
        payload.code = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      }
      const saved = await updateStream(stream.id, payload);
      setStreams((prev) => prev.map((s) => (s.id === stream.id ? { ...s, ...saved } : s)));
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
      console.error('Failed to update stream:', err);
    }
  };

  // Direct edit: Subject cell change
  const handleSubjectCellChange = (id: string, field: 'name' | 'basketCategory', val: string) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  // Direct edit: Subject cell blur/enter save
  const handleSubjectCellBlur = async (sub: Subject, field: 'name' | 'basketCategory', val: string) => {
    const trimmed = val.trim();
    const cellKey = `subject-${sub.id}-${field}`;
    setCellStatus((prev) => ({ ...prev, [cellKey]: 'saving' }));

    try {
      const payload: Partial<Subject> = {
        ...sub,
        [field]: trimmed,
      };
      const saved = await updateSubject(sub.id, payload);
      setSubjects((prev) => prev.map((s) => (s.id === sub.id ? { ...s, ...saved } : s)));
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
      console.error('Failed to update subject:', err);
    }
  };

  const handleSaveStream = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...streamFormData };
      if (!payload.code && payload.name) {
        payload.code = payload.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      }
      await createStream(payload);
      setIsStreamModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...subjectFormData };
      if (!payload.code && payload.name) {
        payload.code = payload.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      }
      await createSubject(payload);
      setIsSubjectModalOpen(false);
      setSubjectFormData({ code: '', name: '', basketCategory: 'GENERAL' });
      loadData();
    } catch (err: any) {
      alert('Save subject failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Streams & Recognized Subjects"
        description="Directly edit stream names, available subjects, and recognized academic subjects inline. Changes save automatically."
      />

      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('STREAMS')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              activeTab === 'STREAMS'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-800'
            }`}
          >
            A/L Streams ({streams.length})
          </button>
          <button
            onClick={() => setActiveTab('SUBJECTS')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              activeTab === 'SUBJECTS'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-800'
            }`}
          >
            Recognized Subjects ({subjects.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            ⚡ Direct Edit Enabled
          </span>

          {activeTab === 'STREAMS' ? (
            <button
              onClick={handleOpenCreateStream}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <span>+ Add Stream</span>
            </button>
          ) : (
            <button
              onClick={() => setIsSubjectModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <span>+ Add Subject</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'STREAMS' ? (
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                  <th className="px-4 py-3.5 w-1/3">Stream Name</th>
                  <th className="px-4 py-3.5 w-1/2">Available Subjects</th>
                  <th className="px-4 py-3.5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                      Loading streams...
                    </td>
                  </tr>
                ) : streams.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                      No streams found.
                    </td>
                  </tr>
                ) : (
                  streams.map((s) => {
                    const nameKey = `stream-${s.id}-name`;
                    const descKey = `stream-${s.id}-description`;

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={s.name || ''}
                            onChange={(e) => handleStreamCellChange(s.id, 'name', e.target.value)}
                            onBlur={(e) => handleStreamCellBlur(s, 'name', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            placeholder="Stream Name"
                            className={`w-full font-semibold text-gray-900 dark:text-zinc-100 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2.5 py-1.5 outline-none transition-all ${
                              cellStatus[nameKey] === 'saving'
                                ? 'ring-2 ring-indigo-400 animate-pulse'
                                : cellStatus[nameKey] === 'saved'
                                ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                                : cellStatus[nameKey] === 'error'
                                ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                                : ''
                            }`}
                            title="Click to edit Stream Name directly"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={s.description || ''}
                            onChange={(e) => handleStreamCellChange(s.id, 'description', e.target.value)}
                            onBlur={(e) => handleStreamCellBlur(s, 'description', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            placeholder="Available Subjects (e.g. Combined Mathematics, Physics, Chemistry...)"
                            className={`w-full text-xs text-gray-600 dark:text-zinc-300 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2.5 py-1.5 outline-none transition-all ${
                              cellStatus[descKey] === 'saving'
                                ? 'ring-2 ring-indigo-400 animate-pulse'
                                : cellStatus[descKey] === 'saved'
                                ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                                : cellStatus[descKey] === 'error'
                                ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                                : ''
                            }`}
                            title="Click to edit Available Subjects directly"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleDeleteStream(s.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                            title="Delete stream"
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
      ) : (
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                  <th className="px-4 py-3.5 w-1/2">Subject Name</th>
                  <th className="px-4 py-3.5 w-1/3">Category</th>
                  <th className="px-4 py-3.5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                      Loading subjects...
                    </td>
                  </tr>
                ) : subjects.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                      No subjects added yet.
                    </td>
                  </tr>
                ) : (
                  subjects.map((sub) => {
                    const nameKey = `subject-${sub.id}-name`;
                    const catKey = `subject-${sub.id}-basketCategory`;

                    return (
                      <tr key={sub.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={sub.name || ''}
                            onChange={(e) => handleSubjectCellChange(sub.id, 'name', e.target.value)}
                            onBlur={(e) => handleSubjectCellBlur(sub, 'name', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            placeholder="Subject Name"
                            className={`w-full font-semibold text-gray-900 dark:text-zinc-100 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2.5 py-1.5 outline-none transition-all ${
                              cellStatus[nameKey] === 'saving'
                                ? 'ring-2 ring-indigo-400 animate-pulse'
                                : cellStatus[nameKey] === 'saved'
                                ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                                : cellStatus[nameKey] === 'error'
                                ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                                : ''
                            }`}
                            title="Click to edit Subject Name directly"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={sub.basketCategory || ''}
                            onChange={(e) => handleSubjectCellChange(sub.id, 'basketCategory', e.target.value)}
                            onBlur={(e) => handleSubjectCellBlur(sub, 'basketCategory', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            }}
                            placeholder="GENERAL"
                            className={`w-full text-xs text-gray-600 dark:text-zinc-400 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2.5 py-1.5 outline-none transition-all ${
                              cellStatus[catKey] === 'saving'
                                ? 'ring-2 ring-indigo-400 animate-pulse'
                                : cellStatus[catKey] === 'saved'
                                ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                                : cellStatus[catKey] === 'error'
                                ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                                : ''
                            }`}
                            title="Click to edit Category directly"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleDeleteSubject(sub.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                            title="Delete subject"
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
      )}

      {/* Create Stream Modal */}
      <Modal
        isOpen={isStreamModalOpen}
        onClose={() => setIsStreamModalOpen(false)}
        title="Create A/L Stream"
        maxWidth="md"
      >
        <form onSubmit={handleSaveStream} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Stream Code *
            </label>
            <input
              type="text"
              required
              value={streamFormData.code || ''}
              onChange={(e) => setStreamFormData({ ...streamFormData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. PHYSICAL_SCIENCE"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Stream Name *
            </label>
            <input
              type="text"
              required
              value={streamFormData.name || ''}
              onChange={(e) => setStreamFormData({ ...streamFormData, name: e.target.value })}
              placeholder="e.g. Physical Science (Mathematics)"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Available Subjects
            </label>
            <textarea
              rows={3}
              value={streamFormData.description || ''}
              onChange={(e) => setStreamFormData({ ...streamFormData, description: e.target.value })}
              placeholder="e.g. Combined Mathematics, Physics, Chemistry / Information Technology"
              className="w-full p-2.5 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsStreamModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              Save Stream
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Subject Modal */}
      <Modal
        isOpen={isSubjectModalOpen}
        onClose={() => setIsSubjectModalOpen(false)}
        title="Add Recognized Subject"
        maxWidth="md"
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Subject Code *
            </label>
            <input
              type="text"
              required
              value={subjectFormData.code || ''}
              onChange={(e) => setSubjectFormData({ ...subjectFormData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. SUB01"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Subject Name *
            </label>
            <input
              type="text"
              required
              value={subjectFormData.name || ''}
              onChange={(e) => setSubjectFormData({ ...subjectFormData, name: e.target.value })}
              placeholder="e.g. Higher Mathematics"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Basket / Stream Category
            </label>
            <input
              type="text"
              value={subjectFormData.basketCategory || ''}
              onChange={(e) => setSubjectFormData({ ...subjectFormData, basketCategory: e.target.value })}
              placeholder="e.g. GENERAL"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsSubjectModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              Add Subject
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
