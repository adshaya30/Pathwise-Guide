import {
  DashboardStats,
  DocumentRecord,
  DocumentPage,
  ExtractionJob,
  ExtractionProgress,
  ExtractedRecord,
  Course,
  UniCode,
  Cutoff,
  District,
  ArtsBasket,
  ArtsBasketSubject,
  SpecialProvision,
  AptitudeRequirement,
  Stream,
  Subject,
  University,
} from '@/types/admin';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `API error: ${res.status} ${res.statusText}`);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

// Dashboard
export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchJson<DashboardStats>('/admin/dashboard');
}

// Documents
export async function getDocuments(): Promise<DocumentRecord[]> {
  return fetchJson<DocumentRecord[]>('/admin/documents');
}

export async function uploadDocument(file: File, title: string, academicYear: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  formData.append('academicYear', academicYear);

  const res = await fetch(`${API_BASE}/admin/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Upload failed');
  }

  return res.json();
}

export async function getDocument(id: string): Promise<DocumentRecord> {
  return fetchJson<DocumentRecord>(`/admin/documents/${id}`);
}

export async function getDocumentPages(id: string): Promise<DocumentPage[]> {
  return fetchJson<DocumentPage[]>(`/admin/documents/${id}/pages`);
}

export async function getDocumentJobs(id: string): Promise<ExtractionJob[]> {
  return fetchJson<ExtractionJob[]>(`/admin/documents/${id}/jobs`);
}

export async function getJobProgress(jobId: string): Promise<ExtractionJob> {
  return fetchJson<ExtractionJob>(`/admin/documents/jobs/${jobId}/progress`);
}

export async function cancelJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/admin/documents/jobs/${jobId}/cancel`, { method: 'POST' });
}

export async function reprocessDocument(id: string): Promise<ExtractionJob> {
  return fetchJson<ExtractionJob>(`/admin/documents/${id}/reprocess`, { method: 'POST' });
}

export async function deleteDocument(id: string): Promise<void> {
  await fetch(`${API_BASE}/admin/documents/${id}`, { method: 'DELETE' });
}

// Page Verification
export async function getPage(id: string): Promise<DocumentPage> {
  return fetchJson<DocumentPage>(`/admin/pages/${id}`);
}

export async function updatePage(id: string, page: Partial<DocumentPage>): Promise<DocumentPage> {
  return fetchJson<DocumentPage>(`/admin/pages/${id}`, {
    method: 'PUT',
    body: JSON.stringify(page),
  });
}

// Extracted Records (Staging & Review)
export async function getExtractedRecords(status?: string, moduleType?: string): Promise<ExtractedRecord[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (moduleType) params.append('moduleType', moduleType);
  const q = params.toString() ? `?${params.toString()}` : '';
  return fetchJson<ExtractedRecord[]>(`/admin/extracted-records${q}`);
}

export async function getExtractedRecord(id: string): Promise<ExtractedRecord> {
  return fetchJson<ExtractedRecord>(`/admin/extracted-records/${id}`);
}

export async function updateExtractedRecord(id: string, rawPayload: string, validationNotes?: string): Promise<ExtractedRecord> {
  return fetchJson<ExtractedRecord>(`/admin/extracted-records/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ rawPayload, validationNotes }),
  });
}

export async function approveRecord(id: string, reviewedBy = 'Admin', rawPayload?: string): Promise<ExtractedRecord> {
  return fetchJson<ExtractedRecord>(`/admin/extracted-records/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reviewedBy, rawPayload }),
  });
}

export async function rejectRecord(id: string, rejectionReason: string, reviewedBy = 'Admin'): Promise<ExtractedRecord> {
  return fetchJson<ExtractedRecord>(`/admin/extracted-records/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason, reviewedBy }),
  });
}

// Courses
export async function getCourses(): Promise<Course[]> {
  return fetchJson<Course[]>('/admin/courses');
}

export async function createCourse(course: Partial<Course>): Promise<Course> {
  return fetchJson<Course>('/admin/courses', {
    method: 'POST',
    body: JSON.stringify(course),
  });
}

export async function updateCourse(id: string, course: Partial<Course>): Promise<Course> {
  return fetchJson<Course>(`/admin/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(course),
  });
}

export async function deleteCourse(id: string): Promise<void> {
  await fetch(`${API_BASE}/admin/courses/${id}`, { method: 'DELETE' });
}

// Uni-Codes
export async function getUniCodes(): Promise<UniCode[]> {
  return fetchJson<UniCode[]>('/admin/uni-codes');
}

export async function createUniCode(uniCode: Partial<UniCode>): Promise<UniCode> {
  return fetchJson<UniCode>('/admin/uni-codes', {
    method: 'POST',
    body: JSON.stringify(uniCode),
  });
}

export async function updateUniCode(id: string, uniCode: Partial<UniCode>): Promise<UniCode> {
  return fetchJson<UniCode>(`/admin/uni-codes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(uniCode),
  });
}

export async function deleteUniCode(id: string): Promise<void> {
  await fetch(`${API_BASE}/admin/uni-codes/${id}`, { method: 'DELETE' });
}

// Cutoffs (Single table with 25 districts)
export async function getCutoffs(academicYear?: string): Promise<Cutoff[]> {
  const q = academicYear ? `?academicYear=${encodeURIComponent(academicYear)}` : '';
  return fetchJson<Cutoff[]>(`/admin/cutoffs${q}`);
}

export async function createCutoff(cutoff: Partial<Cutoff>): Promise<Cutoff> {
  return fetchJson<Cutoff>('/admin/cutoffs', {
    method: 'POST',
    body: JSON.stringify(cutoff),
  });
}

export async function updateCutoff(id: string, cutoff: Partial<Cutoff>): Promise<Cutoff> {
  return fetchJson<Cutoff>(`/admin/cutoffs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(cutoff),
  });
}

export async function deleteCutoff(id: string): Promise<void> {
  await fetch(`${API_BASE}/admin/cutoffs/${id}`, { method: 'DELETE' });
}

// Districts
export async function getDistricts(): Promise<District[]> {
  return fetchJson<District[]>('/admin/districts');
}

export async function createDistrict(district: Partial<District>): Promise<District> {
  return fetchJson<District>('/admin/districts', {
    method: 'POST',
    body: JSON.stringify(district),
  });
}

export async function updateDistrict(id: string, district: Partial<District>): Promise<District> {
  return fetchJson<District>(`/admin/districts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(district),
  });
}

export async function deleteDistrict(id: string): Promise<void> {
  await fetch(`${API_BASE}/admin/districts/${id}`, { method: 'DELETE' });
}

// Arts Baskets
export async function getArtsBaskets(): Promise<ArtsBasket[]> {
  return fetchJson<ArtsBasket[]>('/admin/arts-baskets');
}

export async function getArtsBasketSubjects(basketId: string): Promise<ArtsBasketSubject[]> {
  return fetchJson<ArtsBasketSubject[]>(`/admin/arts-baskets/${basketId}/subjects`);
}

export async function createArtsBasket(basket: Partial<ArtsBasket>): Promise<ArtsBasket> {
  return fetchJson<ArtsBasket>('/admin/arts-baskets', {
    method: 'POST',
    body: JSON.stringify(basket),
  });
}

export async function updateArtsBasket(id: string, basket: Partial<ArtsBasket>): Promise<ArtsBasket> {
  return fetchJson<ArtsBasket>(`/admin/arts-baskets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(basket),
  });
}

export async function deleteArtsBasket(id: string): Promise<void> {
  await fetch(`${API_BASE}/admin/arts-baskets/${id}`, { method: 'DELETE' });
}

export async function addSubjectToBasket(basketId: string, subject: Partial<ArtsBasketSubject>): Promise<ArtsBasketSubject> {
  return fetchJson<ArtsBasketSubject>(`/admin/arts-baskets/${basketId}/subjects`, {
    method: 'POST',
    body: JSON.stringify(subject),
  });
}

export async function removeSubjectFromBasket(subjectLinkId: string): Promise<void> {
  await fetch(`${API_BASE}/admin/arts-baskets/subjects/${subjectLinkId}`, { method: 'DELETE' });
}

// Special Provisions
export async function getSpecialProvisions(category?: string): Promise<SpecialProvision[]> {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  return fetchJson<SpecialProvision[]>(`/admin/special-provisions${q}`);
}

export async function createSpecialProvision(sp: Partial<SpecialProvision>): Promise<SpecialProvision> {
  return fetchJson<SpecialProvision>('/admin/special-provisions', {
    method: 'POST',
    body: JSON.stringify(sp),
  });
}

export async function batchCreateSpecialProvisions(list: Partial<SpecialProvision>[]): Promise<SpecialProvision[]> {
  return fetchJson<SpecialProvision[]>('/admin/special-provisions/batch', {
    method: 'POST',
    body: JSON.stringify(list),
  });
}

export async function getPublicSpecialProvisions(): Promise<SpecialProvision[]> {
  return fetchJson<SpecialProvision[]>('/academic/provisions');
}

export async function updateSpecialProvision(id: string, sp: Partial<SpecialProvision>): Promise<SpecialProvision> {
  return fetchJson<SpecialProvision>(`/admin/special-provisions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(sp),
  });
}

export async function deleteSpecialProvision(id: string): Promise<void> {
  await fetch(`${API_BASE}/admin/special-provisions/${id}`, { method: 'DELETE' });
}

// Aptitude Requirements
export async function getAptitudes(): Promise<AptitudeRequirement[]> {
  return fetchJson<AptitudeRequirement[]>('/admin/aptitude');
}

export async function createAptitude(req: Partial<AptitudeRequirement>): Promise<AptitudeRequirement> {
  return fetchJson<AptitudeRequirement>('/admin/aptitude', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function updateAptitude(id: string, req: Partial<AptitudeRequirement>): Promise<AptitudeRequirement> {
  return fetchJson<AptitudeRequirement>(`/admin/aptitude/${id}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  });
}

export async function deleteAptitude(id: string): Promise<void> {
  await fetch(`${API_BASE}/admin/aptitude/${id}`, { method: 'DELETE' });
}

// Streams & Subjects
export async function getStreams(): Promise<Stream[]> {
  return fetchJson<Stream[]>('/admin/streams');
}

export async function createStream(stream: Partial<Stream>): Promise<Stream> {
  return fetchJson<Stream>('/admin/streams', {
    method: 'POST',
    body: JSON.stringify(stream),
  });
}

export async function updateStream(id: string, stream: Partial<Stream>): Promise<Stream> {
  return fetchJson<Stream>(`/admin/streams/${id}`, {
    method: 'PUT',
    body: JSON.stringify(stream),
  });
}

export async function deleteStream(id: string): Promise<void> {
  await fetch(`${API_BASE}/admin/streams/${id}`, { method: 'DELETE' });
}

export async function getSubjects(): Promise<Subject[]> {
  return fetchJson<Subject[]>('/admin/streams/subjects');
}

export async function createSubject(subject: Partial<Subject>): Promise<Subject> {
  return fetchJson<Subject>('/admin/streams/subjects', {
    method: 'POST',
    body: JSON.stringify(subject),
  });
}

// Universities
export async function getUniversities(): Promise<University[]> {
  return fetchJson<University[]>('/admin/universities');
}

export async function createUniversity(uni: Partial<University>): Promise<University> {
  return fetchJson<University>('/admin/universities', {
    method: 'POST',
    body: JSON.stringify(uni),
  });
}

export async function updateUniversity(id: string, uni: Partial<University>): Promise<University> {
  return fetchJson<University>(`/admin/universities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(uni),
  });
}

export async function deleteUniversity(id: string): Promise<void> {
  await fetch(`${API_BASE}/admin/universities/${id}`, { method: 'DELETE' });
}

