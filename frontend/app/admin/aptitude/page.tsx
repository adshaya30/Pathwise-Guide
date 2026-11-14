'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  getAptitudes,
  createAptitude,
  updateAptitude,
  deleteAptitude,
} from '@/services/adminApi';
import { AptitudeRequirement } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function AptitudeRequirementsPage() {
  const [aptitudes, setAptitudes] = useState<AptitudeRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<AptitudeRequirement>>({
    courseOfStudy: '',
    universityName: '',
    uniCode: '',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await getAptitudes();
      setAptitudes(data);
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
      courseOfStudy: '',
      universityName: '',
      uniCode: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (a: AptitudeRequirement) => {
    setEditingId(a.id);
    setFormData({
      courseOfStudy: a.courseOfStudy || a.courseName || '',
      universityName: a.universityName || '',
      uniCode: a.uniCode || '',
    });
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
      const course = formData.courseOfStudy?.trim().toUpperCase() || '';
      const uni = formData.universityName?.trim().toUpperCase() || '';
      const code = formData.uniCode?.trim().toUpperCase() || '';

      const payload: Partial<AptitudeRequirement> = {
        courseOfStudy: course,
        courseName: course,
        universityName: uni,
        uniCode: code,
        conductedBy: uni,
      };

      if (editingId) {
        await updateAptitude(editingId, payload);
      } else {
        await createAptitude(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return aptitudes;
    const q = searchQuery.toLowerCase();
    return aptitudes.filter((a) => {
      const course = (a.courseOfStudy || a.courseName || '').toLowerCase();
      const uni = (a.universityName || '').toLowerCase();
      const code = (a.uniCode || '').toLowerCase();
      return course.includes(q) || uni.includes(q) || code.includes(q);
    });
  }, [aptitudes, searchQuery]);

  const stats = useMemo(() => {
    const totalRecords = aptitudes.length;
    const uniqueCourses = new Set(
      aptitudes.map((a) => a.courseOfStudy || a.courseName).filter(Boolean)
    ).size;
    const uniqueInstitutes = new Set(
      aptitudes.map((a) => a.universityName).filter(Boolean)
    ).size;
    return { totalRecords, uniqueCourses, uniqueInstitutes };
  }, [aptitudes]);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Aptitude Requirements Management"
        description="Courses requiring university-conducted practical or aptitude tests prior to admission."
      />

      {/* UGC Handbook Official Instruction Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-900/50">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-600 text-white">
            UGC Handbook Requirement
          </span>
          <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100 uppercase tracking-wide">
            Requirement to Pass the Practical / Aptitude Test
          </h3>
        </div>
        <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
          Every candidate who has listed undermentioned courses of study among his/her preferences should pass the practical/aptitude test which will be conducted by the respective universities. The university concerned will publish a press notice calling for applications. In order to consider for the course of study, it is compulsory to fulfill the cut-off mark of the relevant course of study in addition to passing the practical/aptitude test.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Total Aptitude Offerings</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mt-1">{stats.totalRecords}</div>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Distinct Courses of Study</div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{stats.uniqueCourses}</div>
        </div>
        <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400">Universities / Campuses / Institutes</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.uniqueInstitutes}</div>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by course of study, university/institute or uni-code..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-96 text-gray-900 dark:text-zinc-100 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <span>+ Add Aptitude Test Course</span>
        </button>
      </div>

      {/* UGC Handbook Screenshot 5 Exact Table Layout */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100/90 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800 text-xs font-bold text-gray-700 dark:text-zinc-300">
                <th className="px-5 py-3.5 border-r border-gray-200 dark:border-zinc-800">
                  Course of Study
                </th>
                <th className="px-5 py-3.5 border-r border-gray-200 dark:border-zinc-800">
                  University / Campus / Institute
                </th>
                <th className="px-4 py-3.5 text-center border-r border-gray-200 dark:border-zinc-800">
                  Uni-Code
                </th>
                <th className="px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Loading aptitude requirements...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No aptitude requirements found.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const courseTitle = a.courseOfStudy || a.courseName;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
                      <td className="px-5 py-3.5 font-bold uppercase text-xs tracking-wide text-gray-900 dark:text-zinc-100 border-r border-gray-100 dark:border-zinc-900">
                        {courseTitle}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-xs uppercase tracking-wide text-gray-700 dark:text-zinc-300 border-r border-gray-100 dark:border-zinc-900">
                        {a.universityName || 'Respective University'}
                      </td>
                      <td className="px-4 py-3.5 text-center border-r border-gray-100 dark:border-zinc-900">
                        <span className="inline-block px-2.5 py-1 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-md">
                          {a.uniCode || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(a)}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Aptitude Test Course' : 'Add Aptitude Test Course'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Course of Study *
            </label>
            <input
              type="text"
              required
              value={formData.courseOfStudy || ''}
              onChange={(e) => setFormData({ ...formData, courseOfStudy: e.target.value })}
              placeholder="Enter Course of Study"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              University / Campus / Institute *
            </label>
            <input
              type="text"
              required
              value={formData.universityName || ''}
              onChange={(e) => setFormData({ ...formData, universityName: e.target.value })}
              placeholder="Enter University / Campus / Institute"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Uni-Code *
            </label>
            <input
              type="text"
              required
              value={formData.uniCode || ''}
              onChange={(e) => setFormData({ ...formData, uniCode: e.target.value.toUpperCase() })}
              placeholder="Enter Uni-Code"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 font-mono uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs"
            >
              {editingId ? 'Update Course' : 'Create Course'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
