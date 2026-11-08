'use client';

import React, { useEffect, useState } from 'react';
import {
  getUniCodes,
  createUniCode,
  updateUniCode,
  deleteUniCode,
  getCourses,
  getUniversities,
} from '@/services/adminApi';
import { UniCode, Course, University } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function UniCodesPage() {
  const [uniCodes, setUniCodes] = useState<UniCode[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<UniCode>>({
    code: '',
    courseId: '',
    courseName: '',
    universityId: '',
    universityName: '',
    description: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [uList, cList, unList] = await Promise.all([
        getUniCodes(),
        getCourses(),
        getUniversities(),
      ]);
      setUniCodes(uList);
      setCourses(cList);
      setUniversities(unList);
    } catch (err: any) {
      alert('Failed to load Uni-Codes: ' + err.message);
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
      code: '',
      courseId: courses[0]?.id || '',
      courseName: courses[0]?.name || '',
      universityId: universities[0]?.id || '',
      universityName: universities[0]?.name || '',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: UniCode) => {
    setEditingId(u.id);
    setFormData({ ...u });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Uni-Code?')) return;
    try {
      await deleteUniCode(id);
      loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateUniCode(editingId, formData);
      } else {
        await createUniCode(formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const filtered = uniCodes.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.code.toLowerCase().includes(q) ||
      u.courseName.toLowerCase().includes(q) ||
      u.universityName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Uni-Code Management"
        description="Official UGC university course codes (e.g. 001A Colombo Medicine, 024C Moratuwa Computer Science & Engineering)."
      />

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Uni-Code, course, or university..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-80 text-gray-900 dark:text-zinc-100 shadow-xs"
        />

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <span>+ Add Uni-Code</span>
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5">Uni-Code</th>
                <th className="px-4 py-3.5">Course Name</th>
                <th className="px-4 py-3.5">University</th>
                <th className="px-4 py-3.5">Description</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Loading Uni-Codes...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No Uni-Codes found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                    <td className="px-4 py-3.5 font-bold font-mono text-indigo-700 dark:text-indigo-400">
                      {u.code}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-zinc-100">
                      {u.courseName}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-zinc-300">
                      {u.universityName}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 max-w-xs truncate">
                      {u.description || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
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
        title={editingId ? 'Edit Uni-Code' : 'Create Uni-Code'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Uni-Code * (e.g. 001A)
            </label>
            <input
              type="text"
              required
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="001A"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Course *
            </label>
            <select
              value={formData.courseId || ''}
              onChange={(e) => {
                const c = courses.find((x) => x.id === e.target.value);
                setFormData({
                  ...formData,
                  courseId: e.target.value,
                  courseName: c ? c.name : formData.courseName,
                });
              }}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              University *
            </label>
            <select
              value={formData.universityId || ''}
              onChange={(e) => {
                const u = universities.find((x) => x.id === e.target.value);
                setFormData({
                  ...formData,
                  universityId: e.target.value,
                  universityName: u ? u.name : formData.universityName,
                });
              }}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            >
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.code} - {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
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
              Save Uni-Code
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
