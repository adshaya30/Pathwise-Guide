'use client';

import React, { useEffect, useState } from 'react';
import {
  getExtractedRecords,
  approveRecord,
  rejectRecord,
  updateExtractedRecord,
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

  // Selected record for modal review
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
    } catch (err: any) {
      alert('Failed to load extracted records: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [statusFilter, moduleFilter]);

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
        description="Review AI-extracted candidate records, edit payloads, and publish atomically to student-facing tables."
      />

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-950 p-4 border border-gray-200 dark:border-zinc-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-gray-500">Status:</label>
          <div className="flex gap-1">
            {['PENDING', 'APPROVED', 'REJECTED', ''].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                  statusFilter === st
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
            <option value="ARTS_BASKET">Arts Basket</option>
            <option value="DISTRICT">Districts</option>
            <option value="SPECIAL_PROVISION">Special Provisions</option>
            <option value="APTITUDE">Aptitude Requirements</option>
            <option value="STREAM_SUBJECT">Streams & Subjects</option>
          </select>
        </div>

        <button
          onClick={fetchRecords}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Staged Records Table */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
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
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading staged extractions...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No records found for current filter.
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
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
                      <button
                        onClick={() => handleOpenReview(rec)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs transition-colors"
                      >
                        {rec.status === 'PENDING' ? 'Review & Publish' : 'Inspect Details'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & Publish Modal */}
      <Modal
        isOpen={activeRecord !== null}
        onClose={() => setActiveRecord(null)}
        title={`Review Staged Extraction: ${activeRecord?.moduleType}`}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold border ${
                feedback.type === 'success'
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
              disabled={activeRecord?.status === 'APPROVED'}
              rows={12}
              className="w-full p-3 font-mono text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              spellCheck={false}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Reviewer Identity
              </label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
                Validation Notes (Optional)
              </label>
              <input
                type="text"
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                placeholder="e.g. Corrected course code from page table"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              />
            </div>
          </div>

          {activeRecord?.status !== 'APPROVED' && (
            <div>
              <label className="block text-xs font-semibold text-rose-600 mb-1">
                Rejection Reason (Required only if rejecting)
              </label>
              <input
                type="text"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Incomplete row / non-academic page"
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg"
              />
            </div>
          )}

          <div className="pt-4 flex items-center justify-between border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveRecord(null)}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Close
            </button>

            {activeRecord?.status !== 'APPROVED' ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                >
                  Reject Record
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <span>✓ Approve & Publish to Academic Table</span>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-xs text-emerald-600 font-semibold">
                ✓ Record already published to live tables (Published ID: {activeRecord.publishedRecordId})
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

