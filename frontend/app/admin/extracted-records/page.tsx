'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  getExtractedRecords,
  approveRecord,
  rejectRecord,
  updateExtractedRecord,
  bulkApproveRecords,
} from '@/services/adminApi';
import { ExtractedRecord } from '@/types/admin';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function ExtractedRecordsReviewPage() {
  const [records, setRecords] = useState<ExtractedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [moduleFilter, setModuleFilter] = useState<string>('');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [quickApprovingId, setQuickApprovingId] = useState<string | null>(null);

  // Selected record for single modal review
  const [activeRecord, setActiveRecord] = useState<ExtractedRecord | null>(null);
  const [editedPayload, setEditedPayload] = useState<string>('');
  const [validationNotes, setValidationNotes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [reviewerName, setReviewerName] = useState<string>('Chief Admissions Admin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const data = await getExtractedRecords(statusFilter || undefined, moduleFilter || undefined);
      setRecords(data);
      // Clean up selectedIds that are no longer in data
      setSelectedIds((prev) => {
        const validIds = new Set(data.map((r) => r.id));
        const updated = new Set<string>();
        prev.forEach((id) => {
          if (validIds.has(id)) updated.add(id);
        });
        return updated;
      });
    } catch (err: any) {
      alert('Failed to load extracted records: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [statusFilter, moduleFilter]);

  // Pending records in current view
  const pendingRecords = useMemo(
    () => records.filter((r) => r.status === 'PENDING'),
    [records]
  );

  const isAllPendingSelected = useMemo(
    () => pendingRecords.length > 0 && pendingRecords.every((r) => selectedIds.has(r.id)),
    [pendingRecords, selectedIds]
  );

  const toggleSelectAll = () => {
    if (isAllPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRecords.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ─── Bulk Approve Selected ────────────────────────────────────────────────
  const handleBulkApproveSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Are you sure you want to approve and publish ${count} selected records to live academic tables?`)) {
      return;
    }

    try {
      setIsBulkApproving(true);
      setBulkFeedback(null);
      const res = await bulkApproveRecords(Array.from(selectedIds), undefined, reviewerName);
      setSelectedIds(new Set());
      setBulkFeedback({
        type: 'success',
        message: `Successfully approved and published ${res.approvedCount} records to live tables!${res.failedCount > 0 ? ` (${res.failedCount} failed)` : ''
          }`,
      });
      fetchRecords();
    } catch (err: any) {
      setBulkFeedback({ type: 'error', message: 'Bulk approval failed: ' + err.message });
    } finally {
      setIsBulkApproving(false);
    }
  };

  // ─── Bulk Approve All Pending ─────────────────────────────────────────────
  const handleBulkApproveAllPending = async () => {
    const totalPending = pendingRecords.length;
    if (totalPending === 0) {
      alert('No pending records to approve.');
      return;
    }

    const scopeDesc = moduleFilter ? `all ${totalPending} pending records in [${moduleFilter}]` : `all ${totalPending} pending records`;
    if (!confirm(`Are you sure you want to approve and publish ${scopeDesc} directly into live tables?`)) {
      return;
    }

    try {
      setIsBulkApproving(true);
      setBulkFeedback(null);
      const res = await bulkApproveRecords(undefined, moduleFilter || undefined, reviewerName);
      setSelectedIds(new Set());
      setBulkFeedback({
        type: 'success',
        message: `Successfully approved and published ${res.approvedCount} records to live tables!${res.failedCount > 0 ? ` (${res.failedCount} failed)` : ''
          }`,
      });
      fetchRecords();
    } catch (err: any) {
      setBulkFeedback({ type: 'error', message: 'Bulk approval failed: ' + err.message });
    } finally {
      setIsBulkApproving(false);
    }
  };

  // ─── Single Review Modal & Quick Approve Handlers ─────────────────────────
  const handleQuickApprove = async (record: ExtractedRecord) => {
    try {
      setQuickApprovingId(record.id);
      await approveRecord(record.id, reviewerName);
      setBulkFeedback({
        type: 'success',
        message: `Record ${record.moduleType} (Page ${record.pageNumber || '—'}) approved and published successfully!`,
      });
      fetchRecords();
    } catch (err: any) {
      setBulkFeedback({
        type: 'error',
        message: `Failed to approve record: ${err.message}`,
      });
    } finally {
      setQuickApprovingId(null);
    }
  };

  const handleOpenReview = (record: ExtractedRecord) => {
    setActiveRecord(record);
    try {
      const parsed = JSON.parse(record.rawPayload);
      setEditedPayload(JSON.stringify(parsed, null, 2));
    } catch {
      setEditedPayload(record.rawPayload);
    }
    setValidationNotes(record.validationNotes || '');
    setRejectionReason(record.rejectionReason || '');
    setFeedback(null);
  };

  const handleApprove = async () => {
    if (!activeRecord) return;
    try {
      setIsSubmitting(true);
      await approveRecord(activeRecord.id, reviewerName, editedPayload);
      setFeedback({ type: 'success', message: 'Record approved and atomically published to live academic tables!' });
      setTimeout(() => {
        setActiveRecord(null);
        fetchRecords();
      }, 1500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Approval failed: ' + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!activeRecord) return;
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    try {
      setIsSubmitting(true);
      await rejectRecord(activeRecord.id, rejectionReason, reviewerName);
      setFeedback({ type: 'success', message: 'Record marked as rejected.' });
      setTimeout(() => {
        setActiveRecord(null);
        fetchRecords();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Rejection failed: ' + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePayloadOnly = async () => {
    if (!activeRecord) return;
    try {
      setIsSubmitting(true);
      await updateExtractedRecord(activeRecord.id, editedPayload, validationNotes);
      setFeedback({ type: 'success', message: 'Payload updated in staging successfully.' });
      fetchRecords();
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Update failed: ' + err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Extraction Staging & Verification Review"
        description="Review AI-extracted candidate records, approve individually or in bulk, and publish atomically to student-facing tables."
      />

      {/* Global Feedback Banner */}
      {bulkFeedback && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold border flex items-center justify-between shadow-xs ${bulkFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
        >
          <div className="flex items-center gap-2">
            <span>{bulkFeedback.type === 'success' ? '✓' : '⚠'}</span>
            <span>{bulkFeedback.message}</span>
          </div>
          <button
            onClick={() => setBulkFeedback(null)}
            className="text-xs opacity-75 hover:opacity-100 font-bold"
          >
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Filter & Actions Toolbar */}
      <div className="bg-white dark:bg-zinc-950 p-4 border border-gray-200 dark:border-zinc-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-gray-500">Status:</label>
          <div className="flex gap-1">
            {['PENDING', 'APPROVED', 'REJECTED', ''].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${statusFilter === st
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-800 hover:bg-gray-50'
                  }`}
              >
                {st === '' ? 'ALL' : st}
              </button>
            ))}
          </div>

          <label className="text-xs font-semibold text-gray-500 ml-2">Module:</label>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-md text-gray-800 dark:text-zinc-200"
          >
            <option value="">All Academic Modules</option>
            <option value="CUTOFF">Cutoff (Z-Score)</option>
            <option value="COURSE">Course Details</option>
            <option value="UNI_CODE">Uni-Code</option>
            <option value="OL_REQUIREMENT">O/L Requirements</option>
            <option value="ARTS_BASKET">Arts Basket</option>
            <option value="DISTRICT">Districts</option>
            <option value="SPECIAL_PROVISION">Special Provisions</option>
            <option value="APTITUDE">Aptitude Requirements</option>
            <option value="STREAM_SUBJECT">Streams & Subjects</option>
          </select>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkApproveSelected}
              disabled={isBulkApproving}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>Approve Selected ({selectedIds.size})</span>
            </button>
          )}

          {pendingRecords.length > 0 && (
            <button
              onClick={handleBulkApproveAllPending}
              disabled={isBulkApproving}
              className="px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-800 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Approve All Pending ({pendingRecords.length})</span>
            </button>
          )}

          <button
            onClick={fetchRecords}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-indigo-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Selection Summary Pill */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 px-4 py-2 rounded-lg flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
          <span className="font-semibold">
            {selectedIds.size} record{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Staged Records Table */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllPendingSelected}
                    onChange={toggleSelectAll}
                    disabled={pendingRecords.length === 0}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                    title="Select/Deselect All Pending"
                  />
                </th>
                <th className="px-4 py-3.5">Module Type</th>
                <th className="px-4 py-3.5">Page</th>
                <th className="px-4 py-3.5">Extracted Payload Preview</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Reviewed By</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Loading staged extractions...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No records found for current filter.
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const isSelected = selectedIds.has(rec.id);
                  const isPending = rec.status === 'PENDING';

                  return (
                    <tr
                      key={rec.id}
                      className={`transition-colors ${isSelected
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/20'
                          : 'hover:bg-gray-50/60 dark:hover:bg-zinc-900/60'
                        }`}
                    >
                      <td className="px-4 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(rec.id)}
                          disabled={!isPending}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                        />
                      </td>

                      <td className="px-4 py-3.5 font-bold text-xs uppercase text-indigo-700 dark:text-indigo-400">
                        {rec.moduleType}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-gray-500 font-mono">
                        {rec.pageNumber ? `p. ${rec.pageNumber}` : '—'}
                      </td>

                      <td className="px-4 py-3.5 text-xs font-mono text-gray-600 dark:text-zinc-300 max-w-md truncate">
                        {rec.rawPayload}
                      </td>

                      <td className="px-4 py-3.5">
                        <StatusBadge status={rec.status} size="sm" />
                      </td>

                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {rec.reviewedBy ? `${rec.reviewedBy}` : '—'}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              onClick={() => handleQuickApprove(rec)}
                              disabled={quickApprovingId === rec.id}
                              className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 rounded-md shadow-xs transition-colors flex items-center gap-1"
                              title="Approve and publish this record immediately"
                            >
                              {quickApprovingId === rec.id ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                  <span>Publishing...</span>
                                </>
                              ) : (
                                <>
                                  <span>✓</span>
                                  <span>Approve</span>
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenReview(rec)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs transition-colors"
                          >
                            {rec.status === 'PENDING' ? 'Review & Edit' : 'Inspect'}
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

      {/* Review & Publish Single Modal */}
      <Modal
        isOpen={activeRecord !== null}
        onClose={() => setActiveRecord(null)}
        title={`Review Staged Extraction: ${activeRecord?.moduleType}`}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold border ${feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
            >
              {feedback.message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-semibold text-gray-500">Target Module:</span>{' '}
              <span className="font-bold text-indigo-600">{activeRecord?.moduleType}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-500">Current Status:</span>{' '}
              <StatusBadge status={activeRecord?.status || 'PENDING'} size="sm" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                JSON Payload (Edit values before publishing):
              </label>
              <button
                type="button"
                onClick={handleSavePayloadOnly}
                disabled={isSubmitting || activeRecord?.status === 'APPROVED'}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Save JSON Changes
              </button>
            </div>
            <textarea
              value={editedPayload}
              onChange={(e) => setEditedPayload(e.target.value)}
              rows={12}
              className="w-full font-mono text-xs p-3 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Validation / Quality Notes:
            </label>
            <input
              type="text"
              value={validationNotes}
              onChange={(e) => setValidationNotes(e.target.value)}
              placeholder="e.g. Verified against physical page 149"
              className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Reviewer Name:
            </label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              className="w-full text-xs p-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {activeRecord?.status === 'PENDING' && (
            <div className="pt-2 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 mr-4">
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Rejection reason if rejecting..."
                  className="text-xs p-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg flex-1"
                />
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
                >
                  Reject Record
                </button>
              </div>

              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
              >
                {isSubmitting ? 'Publishing...' : 'Approve & Publish to Database'}
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
