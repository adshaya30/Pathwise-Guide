'use client';

import React, { useEffect, useState } from 'react';
import {
  getStreams,
  createStream,
  updateStream,
  deleteStream,
  getSubjects,
  createSubject,
} from '@/services/adminApi';
import { Stream, Subject } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function StreamsPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'STREAMS' | 'SUBJECTS'>('STREAMS');

  // Stream Modal
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [streamFormData, setStreamFormData] = useState<Partial<Stream>>({
    code: '',
    name: '',
    description: '',
  });

  // Subject Modal
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
    setEditingStreamId(null);
    setStreamFormData({ code: '', name: '', description: '' });
    setIsStreamModalOpen(true);
  };

  const handleOpenEditStream = (s: Stream) => {
    setEditingStreamId(s.id);
    setStreamFormData({ ...s });
    setIsStreamModalOpen(true);
  };

  const handleDeleteStream = async (id: string) => {
    if (!confirm('Are you sure you want to delete this stream?')) return;
    try {
      await deleteStream(id);
      loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSaveStream = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStreamId) {
        await updateStream(editingStreamId, streamFormData);
      } else {
        await createStream(streamFormData);
      }
      setIsStreamModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSubject(subjectFormData);
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
        description="G.C.E. Advanced Level streams and recognized academic subjects for university admissions."
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

      {activeTab === 'STREAMS' ? (
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                  <th className="px-4 py-3.5">Stream Code</th>
                  <th className="px-4 py-3.5">Stream Name</th>
                  <th className="px-4 py-3.5">Subject Descriptions</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Loading streams...
                    </td>
                  </tr>
                ) : streams.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      No streams found.
                    </td>
                  </tr>
                ) : (
                  streams.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                      <td className="px-4 py-3.5 font-bold font-mono text-indigo-700 dark:text-indigo-400">
                        {s.code}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-zinc-100">
                        {s.name}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 max-w-md truncate">
                        {s.description || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditStream(s)}
                            className="px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteStream(s.id)}
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
      ) : (
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                  <th className="px-4 py-3.5">Subject Code</th>
                  <th className="px-4 py-3.5">Subject Name</th>
                  <th className="px-4 py-3.5">Category</th>
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
                  subjects.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                      <td className="px-4 py-3.5 font-bold font-mono text-indigo-700 dark:text-indigo-400">
                        {sub.code}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-zinc-100">
                        {sub.name}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {sub.basketCategory || 'GENERAL'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stream Modal */}
      <Modal
        isOpen={isStreamModalOpen}
        onClose={() => setIsStreamModalOpen(false)}
        title={editingStreamId ? 'Edit A/L Stream' : 'Create A/L Stream'}
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
              Description / Subject Combinations
            </label>
            <textarea
              rows={3}
              value={streamFormData.description || ''}
              onChange={(e) => setStreamFormData({ ...streamFormData, description: e.target.value })}
              placeholder="e.g. Combined Mathematics, Physics, Chemistry..."
              className="w-full p-2.5 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsStreamModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 rounded-lg"
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

      {/* Subject Modal */}
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
              placeholder="e.g. 01, PHYS, CHEM"
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
              placeholder="e.g. Combined Mathematics"
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
              placeholder="e.g. PHYSICAL_SCIENCE, ARTS"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
            />
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
              Add Subject
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
