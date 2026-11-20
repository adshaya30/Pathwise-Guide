'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getCourses, createCourse, updateCourse, deleteCourse } from '@/services/adminApi';
import { Course, CourseOffering } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

const compareCourseCodes = (a?: string, b?: string) => {
  const codeA = (a || '').trim();
  const codeB = (b || '').trim();

  const isStdA = /^\d{3}[A-Za-z]?$/.test(codeA);
  const isStdB = /^\d{3}[A-Za-z]?$/.test(codeB);

  if (isStdA && !isStdB) return -1;
  if (!isStdA && isStdB) return 1;

  if (isStdA && isStdB) {
    const numA = parseInt(codeA.substring(0, 3), 10);
    const numB = parseInt(codeB.substring(0, 3), 10);
    if (numA !== numB) return numA - numB;
    return codeA.localeCompare(codeB);
  }

  return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Live status for direct inline cell saving: [courseId-field]: 'saving' | 'saved' | 'error'
  const [cellStatus, setCellStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

  // Modal State (for creating new course)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Course>>({
    code: '',
    name: '',
    streamName: '',
    totalIntake: undefined,
    minimumEligibility: '',
    degreeTitle: '',
    details: '[]',
    minimumRequirements: '',
    isActive: true,
  });

  const loadCourses = async () => {
    try {
      setIsLoading(true);
      const data = await getCourses();
      const sorted = [...data].sort((a, b) => {
        const comp = compareCourseCodes(a.code, b.code);
        if (comp !== 0) return comp;
        return (a.name || '').localeCompare(b.name || '');
      });
      setCourses(sorted);
    } catch (err: any) {
      alert('Failed to load courses: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleOpenCreate = () => {
    setFormData({
      code: '',
      name: '',
      streamName: '',
      totalIntake: undefined,
      minimumEligibility: '',
      degreeTitle: '',
      details: '[]',
      minimumRequirements: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    try {
      await deleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Direct edit: on input change in table
  const handleCellChange = (courseId: string, field: keyof Course, value: any) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, [field]: value } : c))
    );
  };

  // Direct edit: on blur or Enter save to backend
  const handleCellBlur = async (course: Course, field: keyof Course, value: any) => {
    let processedVal = value;
    if (typeof value === 'string') {
      processedVal = field === 'code' ? value.trim().toUpperCase() : value.trim();
    } else if (field === 'totalIntake') {
      processedVal = value === '' || value === null || isNaN(Number(value)) ? null : Number(value);
    }

    const cellKey = `${course.id}-${String(field)}`;
    setCellStatus((prev) => ({ ...prev, [cellKey]: 'saving' }));

    try {
      const payload: Partial<Course> = {
        ...course,
        [field]: processedVal,
      };
      const saved = await updateCourse(course.id, payload);
      setCourses((prev) => prev.map((item) => (item.id === course.id ? { ...item, ...saved } : item)));
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
      console.error('Failed to update course:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let cleanDetails = formData.details || '[]';
      try {
        cleanDetails = JSON.stringify(JSON.parse(cleanDetails));
      } catch {}

      const payload: Partial<Course> = {
        ...formData,
        code: formData.code?.trim().toUpperCase(),
        name: formData.name?.trim(),
        streamName: formData.streamName?.trim(),
        totalIntake: formData.totalIntake ? Number(formData.totalIntake) : undefined,
        details: cleanDetails,
      };

      await createCourse(payload);
      setIsModalOpen(false);
      loadCourses();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const filtered = useMemo(() => {
    return courses
      .filter((c) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.code || '').toLowerCase().includes(q) ||
          (c.streamName || '').toLowerCase().includes(q) ||
          (c.degreeTitle || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const comp = compareCourseCodes(a.code, b.code);
        const direction = sortAsc ? 1 : -1;
        if (comp !== 0) return comp * direction;
        return (a.name || '').localeCompare(b.name || '') * direction;
      });
  }, [courses, searchQuery, sortAsc]);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Academic Courses Management"
        description="Directly edit course codes, names, streams, intakes, and minimum requirements inline. Changes save automatically."
      />

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by course code, name, or stream..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-80 text-gray-900 dark:text-zinc-100 shadow-xs"
        />

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            ✓ Ordered by Course Code
          </span>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            ⚡ Direct Edit Enabled
          </span>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <span>+ Add Course</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th
                  onClick={() => setSortAsc(!sortAsc)}
                  className="px-4 py-3.5 w-36 cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title="Click to toggle Course Code sort order"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Course Code</span>
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {sortAsc ? '▲ ASC' : '▼ DESC'}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3.5">Course Name</th>
                <th className="px-4 py-3.5 w-48">Stream</th>
                <th className="px-4 py-3.5 w-24 text-center">Intake</th>
                <th className="px-4 py-3.5">Minimum Requirement</th>
                <th className="px-4 py-3.5 text-right w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading courses...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No courses found. Click <strong>+ Add Course</strong> to create one.
                  </td>
                </tr>
              ) : (
                filtered.map((course) => {
                  const codeKey = `${course.id}-code`;
                  const nameKey = `${course.id}-name`;
                  const streamKey = `${course.id}-streamName`;
                  const intakeKey = `${course.id}-totalIntake`;
                  const reqKey = `${course.id}-minimumEligibility`;

                  return (
                    <tr key={course.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
                      {/* Course Code */}
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={course.code || ''}
                          onChange={(e) => handleCellChange(course.id, 'code', e.target.value)}
                          onBlur={(e) => handleCellBlur(course, 'code', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="CODE"
                          className={`w-full font-bold font-mono text-indigo-700 dark:text-indigo-400 uppercase bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all ${
                            cellStatus[codeKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[codeKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[codeKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Course Code directly"
                        />
                      </td>

                      {/* Course Name */}
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={course.name || ''}
                          onChange={(e) => handleCellChange(course.id, 'name', e.target.value)}
                          onBlur={(e) => handleCellBlur(course, 'name', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="Course of Study Name"
                          className={`w-full font-semibold text-gray-900 dark:text-zinc-100 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all ${
                            cellStatus[nameKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[nameKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[nameKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Course Name directly"
                        />
                      </td>

                      {/* Stream */}
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={course.streamName || ''}
                          onChange={(e) => handleCellChange(course.id, 'streamName', e.target.value)}
                          onBlur={(e) => handleCellBlur(course, 'streamName', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="Stream Name"
                          className={`w-full text-xs text-gray-700 dark:text-zinc-300 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all ${
                            cellStatus[streamKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[streamKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[streamKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Stream Name directly"
                        />
                      </td>

                      {/* Intake */}
                      <td className="px-3 py-2 align-top text-center">
                        <input
                          type="number"
                          value={course.totalIntake ?? ''}
                          onChange={(e) => handleCellChange(course.id, 'totalIntake', e.target.value === '' ? null : Number(e.target.value))}
                          onBlur={(e) => handleCellBlur(course, 'totalIntake', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="—"
                          className={`w-20 text-center font-mono font-bold text-xs bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 text-emerald-700 dark:text-emerald-400 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all ${
                            cellStatus[intakeKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[intakeKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[intakeKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Intake directly"
                        />
                      </td>

                      {/* Minimum Requirement */}
                      <td className="px-3 py-2 align-top">
                        <textarea
                          rows={2}
                          value={course.minimumEligibility || ''}
                          onChange={(e) => handleCellChange(course.id, 'minimumEligibility', e.target.value)}
                          onBlur={(e) => handleCellBlur(course, 'minimumEligibility', e.target.value)}
                          placeholder="Minimum eligibility requirements..."
                          className={`w-full text-xs text-gray-700 dark:text-zinc-300 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all resize-y ${
                            cellStatus[reqKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[reqKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[reqKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Minimum Requirement directly"
                        />
                      </td>

                      {/* Actions: Delete only */}
                      <td className="px-3 py-2 align-top text-right">
                        <button
                          onClick={() => handleDelete(course.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                          title="Delete course"
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

      {/* Create Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Academic Course"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Course Code *
              </label>
              <input
                type="text"
                required
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. 001A"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Stream Name
              </label>
              <input
                type="text"
                value={formData.streamName || ''}
                onChange={(e) => setFormData({ ...formData, streamName: e.target.value })}
                placeholder="e.g. Physical Science, Arts"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Course Name *
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. MEDICINE, COMPUTER SCIENCE"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Total Intake
            </label>
            <input
              type="number"
              value={formData.totalIntake ?? ''}
              onChange={(e) => setFormData({ ...formData, totalIntake: e.target.value === '' ? undefined : Number(e.target.value) })}
              placeholder="e.g. 500"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Minimum Eligibility Requirements
            </label>
            <textarea
              rows={3}
              value={formData.minimumEligibility || ''}
              onChange={(e) => setFormData({ ...formData, minimumEligibility: e.target.value })}
              placeholder="e.g. At least three 'S' grades in Chemistry, Biology and Physics or Agricultural Science..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
            >
              Save Course
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
