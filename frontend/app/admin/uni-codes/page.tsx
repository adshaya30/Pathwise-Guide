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
  const [aptitudeOnlyFilter, setAptitudeOnlyFilter] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<UniCode>>({
    code: '',
    courseId: '',
    courseName: '',
    universityId: '',
    universityName: '',
    intake: undefined,
    degreeProgram: '',
    duration: '',
    aptitudeTest: false,
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
      alert('Failed to load University Courses (Uni-Codes): ' + err.message);
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
      intake: undefined,
      degreeProgram: '',
      duration: '04 years',
      aptitudeTest: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: UniCode) => {
    setEditingId(u.id);
    setFormData({
      ...u,
      aptitudeTest: Boolean(u.aptitudeTest),
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this University Course (Uni-Code)? Connected cutoffs may be affected.')) return;
    try {
      await deleteUniCode(id);
      loadData();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code?.trim()) {
      alert('Uni-Code is required.');
      return;
    }
    if (!formData.courseId || !formData.universityId) {
      alert('Please select both a Course and a University.');
      return;
    }

    try {
      const selectedCourse = courses.find((c) => c.id === formData.courseId);
      const selectedUni = universities.find((u) => u.id === formData.universityId);

      const payload: Partial<UniCode> = {
        code: formData.code.trim().toUpperCase(),
        courseId: formData.courseId,
        courseName: selectedCourse ? selectedCourse.name : formData.courseName || '',
        universityId: formData.universityId,
        universityName: selectedUni ? selectedUni.name : formData.universityName || '',
        intake: formData.intake != null ? Number(formData.intake) : undefined,
        degreeProgram: formData.degreeProgram?.trim() || '',
        duration: formData.duration?.trim() || '',
        aptitudeTest: Boolean(formData.aptitudeTest),
      };

      if (editingId) {
        await updateUniCode(editingId, payload);
      } else {
        await createUniCode(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const filtered = uniCodes.filter((u) => {
    if (aptitudeOnlyFilter && !u.aptitudeTest) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.code.toLowerCase().includes(q) ||
      u.courseName.toLowerCase().includes(q) ||
      u.universityName.toLowerCase().includes(q) ||
      (u.degreeProgram || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="University Courses & Uni-Codes"
        description="Official UGC Uni-Codes assigned for each course of study per university, with degree titles, durations, intake quotas, and aptitude test requirements."
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Uni-Code, course, university, degree..."
            className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-80 text-gray-900 dark:text-zinc-100 shadow-xs"
          />

          <button
            onClick={() => setAptitudeOnlyFilter(!aptitudeOnlyFilter)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              aptitudeOnlyFilter
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-800 hover:bg-gray-50'
            }`}
          >
            Aptitude Required Only
          </button>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <span>+ Add University Course (Uni-Code)</span>
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5">Uni-Code</th>
                <th className="px-4 py-3.5">Course Name</th>
                <th className="px-4 py-3.5">University Name</th>
                <th className="px-4 py-3.5 text-center">Intake</th>
                <th className="px-4 py-3.5">Degree Program</th>
                <th className="px-4 py-3.5">Duration</th>
                <th className="px-4 py-3.5 text-center">Aptitude Test</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Loading university courses...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No university course records found. Click <strong>+ Add University Course</strong> to create one.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
                    <td className="px-4 py-3.5 font-bold font-mono text-indigo-700 dark:text-indigo-400">
                      {u.code}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-gray-900 dark:text-zinc-100">
                      {u.courseName}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-700 dark:text-zinc-300 font-medium">
                      {u.universityName}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {u.intake ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-zinc-400 max-w-xs truncate" title={u.degreeProgram || ''}>
                      {u.degreeProgram || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-zinc-400 whitespace-nowrap">
                      {u.duration || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {u.aptitudeTest ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-50 dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-800">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded border border-indigo-200 dark:border-indigo-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
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
        title={editingId ? 'Edit University Course (Uni-Code)' : 'Add University Course (Uni-Code)'}
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Uni-Code *
              </label>
              <input
                type="text"
                required
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. 001A, 016C"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 font-mono font-bold uppercase"
              />
              <p className="text-[11px] text-gray-400 mt-0.5">UGC admission Uni-Code.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Intake Capacity
              </label>
              <input
                type="number"
                value={formData.intake ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    intake: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="e.g. 210"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Course of Study * (from Courses table)
              </label>
              <select
                required
                value={formData.courseId || ''}
                onChange={(e) => {
                  const c = courses.find((x) => x.id === e.target.value);
                  setFormData({
                    ...formData,
                    courseId: e.target.value,
                    courseName: c ? c.name : formData.courseName,
                  });
                }}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
              >
                <option value="">Select a course...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                University * (from Universities table)
              </label>
              <select
                required
                value={formData.universityId || ''}
                onChange={(e) => {
                  const u = universities.find((x) => x.id === e.target.value);
                  setFormData({
                    ...formData,
                    universityId: e.target.value,
                    universityName: u ? u.name : formData.universityName,
                  });
                }}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
              >
                <option value="">Select a university...</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} - {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Degree Programme Title
            </label>
            <input
              type="text"
              value={formData.degreeProgram || ''}
              onChange={(e) => setFormData({ ...formData, degreeProgram: e.target.value })}
              placeholder="e.g. Bachelor of Medicine and Bachelor of Surgery (MBBS)"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Duration
              </label>
              <input
                type="text"
                value={formData.duration || ''}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g. 05 years, 04 years, 03 years"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100"
              />
            </div>

            <div className="pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.aptitudeTest)}
                  onChange={(e) => setFormData({ ...formData, aptitudeTest: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">
                  Practical / Aptitude Test Required
                </span>
              </label>
              <p className="text-[11px] text-gray-400 mt-0.5 ml-6">
                Check if passing an aptitude test is required for admission.
              </p>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              {editingId ? 'Save Changes' : 'Create University Course'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
