'use client';

import React, { useEffect, useState } from 'react';
import {
  getAptitudes,
  createAptitude,
  updateAptitude,
  deleteAptitude,
  getCourses,
  getUniversities,
} from '@/services/adminApi';
import { AptitudeRequirement, Course, University } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function AptitudeRequirementsPage() {
  const [aptitudes, setAptitudes] = useState<AptitudeRequirement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AptitudeRequirement>>({
    courseId: '',
    courseName: '',
    universityId: '',
    universityName: '',
    testName: '',
    testDescription: '',
    passingCriteria: 'Minimum 50% in aptitude examination',
    applicationDeadline: '',
    conductedBy: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [aList, cList, uList] = await Promise.all([
        getAptitudes(),
        getCourses(),
        getUniversities(),
      ]);
      setAptitudes(aList);
      setCourses(cList);
      setUniversities(uList);
    } catch (err: any) {
      alert('Failed to load aptitude requirements: ' + err.message);
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
      courseId: courses[0]?.id || '',
      courseName: courses[0]?.name || '',
      universityId: universities[0]?.id || '',
      universityName: universities[0]?.name || '',
      testName: 'Aptitude & Practical Test',
      testDescription: '',
      passingCriteria: 'Minimum 50% marks',
      applicationDeadline: 'Within 2 weeks of UGC handbook publication',
      conductedBy: universities[0]?.name || '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (a: AptitudeRequirement) => {
    setEditingId(a.id);
    setFormData({ ...a });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this aptitude test requirement?')) return;
    try {
      await deleteAptitude(id);
      loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateAptitude(editingId, formData);
      } else {
        await createAptitude(formData);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const filtered = aptitudes.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.courseName.toLowerCase().includes(q) ||
      a.testName.toLowerCase().includes(q) ||
      (a.universityName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Aptitude Requirements Management"
        description="Courses requiring university-conducted aptitude or practical tests (e.g. Architecture, Design, IT & Management)."
      />

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by course, test or university..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-80 text-gray-900 dark:text-zinc-100 shadow-xs"
        />

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <span>+ Add Aptitude Test</span>
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5">Course Name</th>
                <th className="px-4 py-3.5">Test Name</th>
                <th className="px-4 py-3.5">Conducted By</th>
                <th className="px-4 py-3.5">Passing Criteria</th>
                <th className="px-4 py-3.5">Application Deadline</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading aptitude requirements...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No aptitude requirements configured.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                    <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-zinc-100">
                      {a.courseName}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-indigo-700 dark:text-indigo-400">
                      {a.testName}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-zinc-300">
                      {a.conductedBy || a.universityName || 'Respective University'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">
                      {a.passingCriteria || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">
                      {a.applicationDeadline || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(a)}
                          className="px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
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
        title={editingId ? 'Edit Aptitude Test' : 'Create Aptitude Test Requirement'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
              Test Name *
            </label>
            <input
              type="text"
              required
              value={formData.testName || ''}
              onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
              placeholder="e.g. Aptitude Test for Architecture"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Conducted By
              </label>
              <input
                type="text"
                value={formData.conductedBy || ''}
                onChange={(e) => setFormData({ ...formData, conductedBy: e.target.value })}
                placeholder="e.g. University of Moratuwa"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Passing Criteria
              </label>
              <input
                type="text"
                value={formData.passingCriteria || ''}
                onChange={(e) => setFormData({ ...formData, passingCriteria: e.target.value })}
                placeholder="e.g. Minimum 50% Marks"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Application Deadline / Instructions
            </label>
            <input
              type="text"
              value={formData.applicationDeadline || ''}
              onChange={(e) => setFormData({ ...formData, applicationDeadline: e.target.value })}
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
              Save Aptitude Test
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
