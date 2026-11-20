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

  // Live status for direct inline cell saving: [uniCodeId-field]: 'saving' | 'saved' | 'error'
  const [cellStatus, setCellStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

  // Modal (for creating new UniCode)
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this University Course (Uni-Code)? Connected cutoffs may be affected.')) return;
    try {
      await deleteUniCode(id);
      setUniCodes((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Direct edit: on input change in table
  const handleCellChange = (uniCodeId: string, field: keyof UniCode, value: any) => {
    setUniCodes((prev) =>
      prev.map((u) => (u.id === uniCodeId ? { ...u, [field]: value } : u))
    );
  };

  // Direct edit: on blur or Enter save to backend
  const handleCellBlur = async (u: UniCode, field: keyof UniCode, value: any) => {
    let processedVal = value;
    if (typeof value === 'string') {
      processedVal = field === 'code' ? value.trim().toUpperCase() : value.trim();
    } else if (field === 'intake') {
      processedVal = value === '' || value === null || isNaN(Number(value)) ? null : Number(value);
    }

    const cellKey = `${u.id}-${String(field)}`;
    setCellStatus((prev) => ({ ...prev, [cellKey]: 'saving' }));

    try {
      const payload: Partial<UniCode> = {
        ...u,
        [field]: processedVal,
      };
      const saved = await updateUniCode(u.id, payload);
      setUniCodes((prev) => prev.map((item) => (item.id === u.id ? { ...item, ...saved } : item)));
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
      console.error('Failed to update UniCode:', err);
    }
  };

  // Direct edit: toggle Aptitude Test directly in cell
  const handleToggleAptitude = async (u: UniCode) => {
    const nextVal = !u.aptitudeTest;
    const cellKey = `${u.id}-aptitudeTest`;
    setCellStatus((prev) => ({ ...prev, [cellKey]: 'saving' }));

    try {
      const payload: Partial<UniCode> = {
        ...u,
        aptitudeTest: nextVal,
      };
      const saved = await updateUniCode(u.id, payload);
      setUniCodes((prev) => prev.map((item) => (item.id === u.id ? { ...item, ...saved } : item)));
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
      console.error('Failed to toggle aptitude test:', err);
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
        intake: formData.intake != null && !isNaN(Number(formData.intake)) ? Number(formData.intake) : undefined,
        degreeProgram: formData.degreeProgram?.trim() || '',
        duration: formData.duration?.trim() || '',
        aptitudeTest: Boolean(formData.aptitudeTest),
      };

      await createUniCode(payload);
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
      (u.code || '').toLowerCase().includes(q) ||
      (u.courseName || '').toLowerCase().includes(q) ||
      (u.universityName || '').toLowerCase().includes(q) ||
      (u.degreeProgram || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <AdminHeader
        title="University Courses & Uni-Codes"
        description="Directly edit Uni-Codes, courses, universities, intake, degree programs, and aptitude test flags inline. Changes save automatically."
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
            type="button"
            onClick={() => setAptitudeOnlyFilter(!aptitudeOnlyFilter)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition ${
              aptitudeOnlyFilter
                ? 'bg-amber-500 text-white border-amber-600'
                : 'bg-white dark:bg-zinc-950 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-800 hover:bg-gray-50'
            }`}
          >
            <span>Aptitude Test Only</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            ⚡ Direct Edit Enabled
          </span>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <span>+ Add University Course (Uni-Code)</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5 w-28">Uni-Code</th>
                <th className="px-4 py-3.5">Course Name</th>
                <th className="px-4 py-3.5">University Name</th>
                <th className="px-4 py-3.5 w-20 text-center">Intake</th>
                <th className="px-4 py-3.5">Degree Program</th>
                <th className="px-4 py-3.5 w-28">Duration</th>
                <th className="px-4 py-3.5 w-28 text-center">Aptitude Test</th>
                <th className="px-4 py-3.5 text-right w-20">Actions</th>
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
                filtered.map((u) => {
                  const codeKey = `${u.id}-code`;
                  const courseKey = `${u.id}-courseName`;
                  const uniKey = `${u.id}-universityName`;
                  const intakeKey = `${u.id}-intake`;
                  const degKey = `${u.id}-degreeProgram`;
                  const durKey = `${u.id}-duration`;
                  const aptKey = `${u.id}-aptitudeTest`;

                  return (
                    <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60 transition-colors">
                      {/* Uni-Code */}
                      <td className="px-2.5 py-2">
                        <input
                          type="text"
                          value={u.code || ''}
                          onChange={(e) => handleCellChange(u.id, 'code', e.target.value)}
                          onBlur={(e) => handleCellBlur(u, 'code', e.target.value)}
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
                          title="Click to edit Uni-Code directly"
                        />
                      </td>

                      {/* Course Name */}
                      <td className="px-2.5 py-2">
                        <input
                          type="text"
                          value={u.courseName || ''}
                          onChange={(e) => handleCellChange(u.id, 'courseName', e.target.value)}
                          onBlur={(e) => handleCellBlur(u, 'courseName', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="Course Name"
                          className={`w-full font-semibold text-gray-900 dark:text-zinc-100 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all ${
                            cellStatus[courseKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[courseKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[courseKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Course Name directly"
                        />
                      </td>

                      {/* University Name */}
                      <td className="px-2.5 py-2">
                        <input
                          type="text"
                          value={u.universityName || ''}
                          onChange={(e) => handleCellChange(u.id, 'universityName', e.target.value)}
                          onBlur={(e) => handleCellBlur(u, 'universityName', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="University Name"
                          className={`w-full text-xs text-gray-700 dark:text-zinc-300 font-medium bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all ${
                            cellStatus[uniKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[uniKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[uniKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit University Name directly"
                        />
                      </td>

                      {/* Intake */}
                      <td className="px-2.5 py-2 text-center">
                        <input
                          type="number"
                          value={u.intake ?? ''}
                          onChange={(e) => handleCellChange(u.id, 'intake', e.target.value === '' ? null : Number(e.target.value))}
                          onBlur={(e) => handleCellBlur(u, 'intake', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="—"
                          className={`w-16 text-center font-mono font-bold text-xs bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 text-emerald-700 dark:text-emerald-400 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-1.5 py-1 outline-none transition-all ${
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

                      {/* Degree Program */}
                      <td className="px-2.5 py-2">
                        <input
                          type="text"
                          value={u.degreeProgram || ''}
                          onChange={(e) => handleCellChange(u.id, 'degreeProgram', e.target.value)}
                          onBlur={(e) => handleCellBlur(u, 'degreeProgram', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="Degree Program Title"
                          className={`w-full text-xs text-gray-600 dark:text-zinc-400 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all ${
                            cellStatus[degKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[degKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[degKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Degree Program directly"
                        />
                      </td>

                      {/* Duration */}
                      <td className="px-2.5 py-2">
                        <input
                          type="text"
                          value={u.duration || ''}
                          onChange={(e) => handleCellChange(u.id, 'duration', e.target.value)}
                          onBlur={(e) => handleCellBlur(u, 'duration', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="04 years"
                          className={`w-full text-xs text-gray-600 dark:text-zinc-400 bg-transparent hover:bg-white dark:hover:bg-zinc-900 focus:bg-white dark:focus:bg-zinc-900 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 focus:border-indigo-500 rounded px-2 py-1 outline-none transition-all ${
                            cellStatus[durKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[durKey] === 'saved'
                              ? 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : cellStatus[durKey] === 'error'
                              ? 'ring-2 ring-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                              : ''
                          }`}
                          title="Click to edit Duration directly"
                        />
                      </td>

                      {/* Aptitude Test Toggle */}
                      <td className="px-2.5 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAptitude(u)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                            u.aptitudeTest
                              ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 hover:bg-gray-200'
                          } ${
                            cellStatus[aptKey] === 'saving'
                              ? 'ring-2 ring-indigo-400 animate-pulse'
                              : cellStatus[aptKey] === 'saved'
                              ? 'ring-2 ring-emerald-500'
                              : cellStatus[aptKey] === 'error'
                              ? 'ring-2 ring-rose-500'
                              : ''
                          }`}
                          title="Click to toggle Aptitude Test requirement directly"
                        >
                          {u.aptitudeTest ? 'Yes' : 'No'}
                        </button>
                      </td>

                      {/* Actions: Delete only */}
                      <td className="px-2.5 py-2 text-right">
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                          title="Delete university course"
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
        title="Add University Course (Uni-Code)"
        maxWidth="lg"
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
                placeholder="e.g. 001A"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100 font-mono"
              />
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
                    intake: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="e.g. 250"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Course *
              </label>
              <select
                required
                value={formData.courseId || ''}
                onChange={(e) => {
                  const cId = e.target.value;
                  const found = courses.find((c) => c.id === cId);
                  setFormData({
                    ...formData,
                    courseId: cId,
                    courseName: found ? found.name : '',
                  });
                }}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
              >
                <option value="">Select Course...</option>
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
                required
                value={formData.universityId || ''}
                onChange={(e) => {
                  const uId = e.target.value;
                  const found = universities.find((u) => u.id === uId);
                  setFormData({
                    ...formData,
                    universityId: uId,
                    universityName: found ? found.name : '',
                  });
                }}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
              >
                <option value="">Select University...</option>
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
              Degree Program Title
            </label>
            <input
              type="text"
              value={formData.degreeProgram || ''}
              onChange={(e) => setFormData({ ...formData, degreeProgram: e.target.value })}
              placeholder="e.g. Bachelor of Science Honours in Computer Science"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Duration
              </label>
              <input
                type="text"
                value={formData.duration || ''}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g. 04 years / 03 years"
                className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-900 dark:text-zinc-100"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.aptitudeTest)}
                  onChange={(e) => setFormData({ ...formData, aptitudeTest: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                  Requires Aptitude Test
                </span>
              </label>
            </div>
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
              Save University Course
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
