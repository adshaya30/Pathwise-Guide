'use client';

import React, { useEffect, useState } from 'react';
import { getCourses, createCourse, updateCourse, deleteCourse } from '@/services/adminApi';
import { Course, CourseOffering } from '@/types/admin';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Course>>({
    code: '',
    name: '',
    streamName: 'Physical Science',
    durationYears: 4,
    degreeTitle: '',
    details: '[]',
    minimumRequirements: '{}',
    isActive: true,
  });

  const loadCourses = async () => {
    try {
      setIsLoading(true);
      const data = await getCourses();
      setCourses(data);
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
    setEditingId(null);
    setFormData({
      code: '',
      name: '',
      streamName: 'Physical Science',
      durationYears: 4,
      degreeTitle: '',
      details: '[]',
      minimumRequirements: '{"alStream":"Physical Science","aptitudeRequired":false}',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Course) => {
    setEditingId(c.id);
    setFormData({ ...c });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    try {
      await deleteCourse(id);
      loadCourses();
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateCourse(editingId, formData);
      } else {
        await createCourse(formData);
      }
      setIsModalOpen(false);
      loadCourses();
    } catch (err: any) {
      alert('Save failed: ' + err.message);
    }
  };

  const parseOfferings = (jsonStr: string): CourseOffering[] => {
    try {
      const arr = JSON.parse(jsonStr);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  const filtered = courses.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.degreeTitle || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Academic Courses Management"
        description="Undergraduate degree courses, duration, university intake capacities & minimum A/L requirements."
      />

      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by course code or name..."
          className="px-3.5 py-2 text-xs bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg w-72 text-gray-900 dark:text-zinc-100 shadow-xs"
        />

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
        >
          <span>+ Add Course</span>
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5">Code</th>
                <th className="px-4 py-3.5">Course Name & Degree Title</th>
                <th className="px-4 py-3.5">Stream</th>
                <th className="px-4 py-3.5">Duration</th>
                <th className="px-4 py-3.5">University Offerings</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
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
                    No courses found.
                  </td>
                </tr>
              ) : (
                filtered.map((course) => {
                  const offerings = parseOfferings(course.details);
                  const isExpanded = expandedCourseId === course.id;

                  return (
                    <React.Fragment key={course.id}>
                      <tr className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                        <td className="px-4 py-3.5 font-bold font-mono text-indigo-700 dark:text-indigo-400">
                          {course.code}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-gray-900 dark:text-zinc-100">{course.name}</div>
                          {course.degreeTitle && (
                            <div className="text-xs text-gray-500 dark:text-zinc-400">{course.degreeTitle}</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-zinc-300">
                          {course.streamName || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-zinc-300">
                          {course.durationYears} Years
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                          >
                            <span>{offerings.length} Universities</span>
                            <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(course)}
                              className="px-2.5 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(course.id)}
                              className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable JSONB Offerings Panel */}
                      {isExpanded && (
                        <tr className="bg-gray-50/50 dark:bg-zinc-900/40">
                          <td colSpan={6} className="px-6 py-4">
                            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                              University Offerings & Intake Capacities
                            </h5>
                            {offerings.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No specific university offerings listed yet.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {offerings.map((off, idx) => (
                                  <div
                                    key={idx}
                                    className="p-3 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg text-xs"
                                  >
                                    <p className="font-semibold text-gray-900 dark:text-zinc-100">
                                      {off.universityName} ({off.universityCode})
                                    </p>
                                    <div className="mt-1 space-y-0.5 text-gray-500 dark:text-zinc-400 text-[11px]">
                                      <p>Intake Capacity: <strong>{off.intakeCapacity ?? 'N/A'}</strong></p>
                                      {off.medium && <p>Medium: {off.medium}</p>}
                                      {off.faculty && <p>Faculty: {off.faculty}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
        title={editingId ? 'Edit Course' : 'Create New Course'}
        maxWidth="2xl"
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
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. 001"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Duration (Years) *
              </label>
              <input
                type="number"
                step="0.5"
                required
                value={formData.durationYears || 4}
                onChange={(e) => setFormData({ ...formData, durationYears: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
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
              placeholder="e.g. Medicine, Computer Science & Engineering"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Degree Title
            </label>
            <input
              type="text"
              value={formData.degreeTitle || ''}
              onChange={(e) => setFormData({ ...formData, degreeTitle: e.target.value })}
              placeholder="e.g. Bachelor of Medicine, Bachelor of Surgery (MBBS)"
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              University Offerings (JSONB Array)
            </label>
            <textarea
              rows={4}
              value={formData.details || '[]'}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              className="w-full p-2.5 font-mono text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
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
              Save Course
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

