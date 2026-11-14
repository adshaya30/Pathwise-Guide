'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  getDocuments,
  uploadDocument,
  deleteDocument,
  reprocessDocument,
  cancelJob,
  getDocumentJobs,
} from '@/services/adminApi';
import { DocumentRecord, ExtractionJob } from '@/types/admin';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Modal } from '@/components/admin/Modal';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Active jobs map: documentId -> ExtractionJob
  const [activeJobs, setActiveJobs] = useState<Record<string, ExtractionJob>>({});

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);

      // Fetch latest jobs for all documents so progress and error details are visible
      for (const d of docs) {
        try {
          const jobs = await getDocumentJobs(d.id);
          if (jobs.length > 0) {
            setActiveJobs((prev) => ({ ...prev, [d.id]: jobs[0] }));
          }
        } catch (ignored) {}
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // Poll every 3 seconds for live extraction progress
    pollIntervalRef.current = setInterval(fetchDocuments, 3000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a PDF handbook file to upload.');
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);
      await uploadDocument(selectedFile, title || selectedFile.name, academicYear);
      setIsModalOpen(false);
      setSelectedFile(null);
      setTitle('');
      await fetchDocuments();
    } catch (err: any) {
      setErrorMessage(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document and all its extracted pages?')) return;
    try {
      await deleteDocument(id);
      await fetchDocuments();
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      setReprocessingId(id);
      setErrorMessage(null);
      await reprocessDocument(id);
      await fetchDocuments();
    } catch (err: any) {
      setErrorMessage('Reprocess failed: ' + err.message);
    } finally {
      setReprocessingId(null);
    }
  };

  const handleCancelJob = async (docId: string) => {
    const job = activeJobs[docId];
    if (job) {
      try {
        await cancelJob(job.id);
        await fetchDocuments();
      } catch (err: any) {
        alert('Cancel failed: ' + err.message);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="UGC Handbook Documents"
        description="Upload Sri Lankan UGC Admission Handbooks, monitor extraction, inspect pages & reprocess."
      />

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">Uploaded Handbooks</h3>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Total documents: {documents.length}</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Upload Handbook</span>
        </button>
      </div>

      {/* Documents Table */}
      <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase">
                <th className="px-4 py-3.5">Title & File</th>
                <th className="px-4 py-3.5">Academic Year</th>
                <th className="px-4 py-3.5">File Size</th>
                <th className="px-4 py-3.5">Extraction Progress</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading documents...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-zinc-400">
                    No documents uploaded yet. Click <strong>Upload Handbook</strong> above to begin.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const job = activeJobs[doc.id];
                  // Truly active only if the job is actively PROCESSING/QUEUED and hasn't failed/cancelled
                  const isJobActive = job?.status === 'PROCESSING' || job?.status === 'QUEUED';
                  const isDocActive = (doc.status === 'PROCESSING' || doc.status === 'UPLOADED') &&
                    job?.status !== 'CANCELLED' && job?.status !== 'FAILED';
                  const isProcessing = isJobActive || isDocActive;

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/60">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-gray-900 dark:text-zinc-100">{doc.title}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <span>{doc.fileName}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-gray-700 dark:text-zinc-300 font-medium">
                        {doc.academicYear}
                      </td>

                      <td className="px-4 py-3.5 text-gray-500 dark:text-zinc-400 text-xs">
                        {formatFileSize(doc.fileSize)}
                      </td>

                      <td className="px-4 py-3.5">
                        {isProcessing ? (
                          <div className="w-48 space-y-1">
                            <div className="flex justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                              <span>Extracting...</span>
                              <span>{job ? job.progressPercent : 0}%</span>
                            </div>
                            <div className="w-full bg-blue-100 dark:bg-blue-950/60 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${job ? job.progressPercent : 0}%` }}
                              />
                            </div>
                            {job?.currentStep && (
                              <p className="text-[11px] text-gray-400 truncate">{job.currentStep}</p>
                            )}
                          </div>
                        ) : doc.status === 'CANCELLED' || job?.status === 'CANCELLED' ? (
                          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                            Cancelled at {doc.processedPages} of {doc.totalPages} pages
                          </div>
                        ) : (
                          <div className="text-xs text-gray-600 dark:text-zinc-400">
                            {doc.processedPages} of {doc.totalPages} pages processed
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <StatusBadge status={job?.status === 'CANCELLED' && doc.status === 'PROCESSING' ? 'CANCELLED' : doc.status} size="sm" />
                          {(doc.status === 'FAILED' || job?.status === 'FAILED') && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium max-w-xs break-words">
                              {doc.errorMessage || job?.errorMessage || 'Extraction failed'}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/documents/${doc.id}/pages`}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded border border-indigo-200 dark:border-indigo-900"
                          >
                            Inspect Pages
                          </Link>

                          {isProcessing && (
                            <button
                              onClick={() => handleCancelJob(doc.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded border border-rose-200"
                              title="Cancel current extraction"
                            >
                              Cancel
                            </button>
                          )}

                          <button
                            onClick={() => handleReprocess(doc.id)}
                            disabled={reprocessingId === doc.id}
                            className="px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded border border-gray-200 dark:border-zinc-700 disabled:opacity-50 flex items-center gap-1"
                            title={isProcessing ? "Restart extraction from page 1" : "Reprocess handbook extraction"}
                          >
                            {reprocessingId === doc.id ? (
                              <>
                                <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                <span>Queuing...</span>
                              </>
                            ) : (
                              <span>Reprocess</span>
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                            title="Delete handbook"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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

      {/* Upload Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Upload UGC Admission Handbook"
        maxWidth="lg"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Handbook Document Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter Handbook Document Title"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Handbook Academic Year *
            </label>
            <input
              type="text"
              required
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="Academic Year (YYYY/YYYY)"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
              Note: When uploading a handbook for Academic Year YYYY/YYYY+1, published minimum Z-Score cutoffs will automatically be cataloged under the prior academic year (YYYY-1)/YYYY.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-1">
              Select PDF File *
            </label>
            <input
              type="file"
              required
              accept=".pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-zinc-100 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Supports official UGC admission handbook PDF documents up to 50MB.
            </p>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Uploading & Queuing...</span>
                </>
              ) : (
                <span>Upload & Begin Extraction</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

