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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Course>>({
    code: '',
    name: '',
    streamName: 'Physical Science',
    totalIntake: undefined,
    minimumEligibility: '',
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
      totalIntake: undefined,
      minimumEligibility: '',
      degreeTitle: '',
      details: JSON.stringify(
        [
          {
            universityCode: 'UOC',
            universityName: 'University of Colombo',
            intakeCapacity: 100,
            duration: '4 Years',
            medium: 'English',
            specialization: '',
            faculty: '',
          },
        ],
        null,
        2
      ),
      minimumRequirements: '{"alStream":"Physical Science","aptitudeRequired":false}',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Course) => {
    setEditingId(c.id);
    let detailsFormatted = c.details || '[]';
    try {
      detailsFormatted = JSON.stringify(JSON.parse(c.details || '[]'), null, 2);
    } catch {}

    setFormData({
      ...c,
      details: detailsFormatted,
    });
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
      // Clean JSON details if valid
      let cleanDetails = formData.details || '[]';
      try {
        cleanDetails = JSON.stringify(JSON.parse(cleanDetails));
      } catch {}

      const payload: Partial<Course> = {
        ...formData,
        details: cleanDetails,
      };

      if (editingId) {
        await updateCourse(editingId, payload);
      } else {
        await createCourse(payload);
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

  const parseEligibility = (course: Course): string => {
    if (course.minimumEligibility && course.minimumEligibility.trim()) {
      return course.minimumEligibility;
    }
    try {
      const req = JSON.parse(course.minimumRequirements || '{}');
      if (req.minGrades) return req.minGrades;
      if (req.description) return req.description;
      if (Array.isArray(req.requiredSubjects) && req.requiredSubjects.length > 0) {
        return req.requiredSubjects.join(', ');
      }
    } catch {}
    return '—';
  };

  const getCourseIntake = (course: Course, offerings: CourseOffering[]): string | number => {
    if (course.totalIntake != null && course.totalIntake > 0) {
      return course.totalIntake;
    }
    const sum = offerings.reduce((acc, o) => acc + (Number(o.intakeCapacity) || 0), 0);
    return sum > 0 ? sum : '—';
  };

  const filtered = courses.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.degreeTitle || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Academic Courses Management"
        description="Undergraduate degree courses, university offerings, duration per offering, specialization, intake capacities & minimum eligibility."
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
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
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
                <th className="px-4 py-3.5 text-center">Intake</th>
                <th className="px-4 py-3.5">Minimum Eligibility</th>
                <th className="px-4 py-3.5">University Offerings</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Loading courses...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No courses found.
                  </td>
                </tr>
              ) : (
                filtered.map((course) => {
                  const offerings = parseOfferings(course.details);
                  const isExpanded = expandedCourseId === course.id;
                  const intakeVal = getCourseIntake(course, offerings);
                  const eligibilityVal = parseEligibility(course);

                  return (
                    <React.Fragment key={course.id}>
                      <tr className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
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
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
                            {intakeVal}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-700 dark:text-zinc-300 max-w-xs">
                          <span className="line-clamp-2" title={eligibilityVal}>
                            {eligibilityVal}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
                          >
                            <span>{offerings.length} Universities</span>
                            <span className="text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(course)}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(course.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable University Offerings Panel */}
                      {isExpanded && (
                        <tr className="bg-gray-50/50 dark:bg-zinc-900/40">
                          <td colSpan={7} className="px-6 py-4">
                            <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">
                              University Offerings, Durations & Intake Capacities
                            </h5>
                            {offerings.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No specific university offerings listed yet.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {offerings.map((off, idx) => {
                                  const durationStr = off.duration
                                    ? (typeof off.duration === 'number' ? `${off.duration} Years` : off.duration)
                                    : (course.durationYears ? `${course.durationYears} Years` : '—');

                                  return (
                                    <div
                                      key={idx}
                                      className="p-3.5 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg text-xs shadow-xs"
                                    >
                                      <p className="font-semibold text-gray-900 dark:text-zinc-100">
                                        {off.universityName} {off.universityCode ? `(${off.universityCode})` : ''}
                                      </p>
                                      <div className="mt-2 space-y-1 text-gray-600 dark:text-zinc-400 text-[11px]">
                                        <p>
                                          Intake Capacity:{' '}
                                          <strong className="text-gray-900 dark:text-zinc-100">
                                            {off.intakeCapacity ?? 'N/A'}
                                          </strong>
                                        </p>
                                        <p>
                                          Duration:{' '}
                                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                            {durationStr}
                                          </span>
                                        </p>
                                        {off.medium && (
                                          <p>
                                            Medium:{' '}
                                            <span className="text-gray-800 dark:text-zinc-200 font-medium">
                                              {off.medium}
                                            </span>
                                          </p>
                                        )}
                                        {off.specialization && (
                                          <p>
                                            Specialization:{' '}
                                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                                              {off.specialization}
                                            </span>
                                          </p>
                                        )}
                                        {off.faculty && <p>Faculty: {off.faculty}</p>}
                                      </div>
                                    </div>
                                  );
                                })}
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
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                placeholder="e.g. Biological Science, Physical Science"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Total Course Intake
              </label>
              <input
                type="number"
                value={formData.totalIntake ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    totalIntake: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="Leave blank to sum from offerings"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Minimum Eligibility
              </label>
              <input
                type="text"
                value={formData.minimumEligibility || ''}
                onChange={(e) => setFormData({ ...formData, minimumEligibility: e.target.value })}
                placeholder="e.g. 3 passes in Biology, Chemistry, Physics"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300">
                University Offerings (JSONB Array)
              </label>
              <span className="text-[11px] text-gray-500">
                Includes duration, medium, specialization, and intake per university
              </span>
            </div>
            <textarea
              rows={6}
              value={formData.details || '[]'}
              onChange={(e) => setFormData({ ...formData, details: e.target.value })}
              className="w-full p-2.5 font-mono text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg transition"
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
