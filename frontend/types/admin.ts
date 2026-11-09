export interface DashboardStats {
  totalUploaded: number;
  completed: number;
  processing: number;
  failed: number;
  pendingVerification: number;
  approved: number;
  rejected: number;
  totalCourses: number;
  totalUniCodes: number;
  totalCutoffs: number;
  totalDistricts: number;
  recentDocuments: DocumentRecord[];
}

export interface DocumentRecord {
  id: string;
  title: string;
  academicYear: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  totalPages: number;
  processedPages: number;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionJob {
  id: string;
  documentId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progressPercent: number;
  currentStep?: string;
  totalItemsExtracted: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionProgress {
  jobId: string;
  documentId: string;
  status: string;
  progressPercent: number;
  currentStep?: string;
  totalItemsExtracted: number;
  errorMessage?: string;
}

export interface DocumentPage {
  id: string;
  documentId: string;
  pageNumber: number;
  rawText?: string;
  pageType: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'VERIFIED';
  extractedJson?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedRecord {
  id: string;
  documentId?: string;
  pageNumber?: number;
  moduleType: 'ARTS_BASKET' | 'UNI_CODE' | 'COURSE' | 'DISTRICT' | 'SPECIAL_PROVISION' | 'CUTOFF' | 'APTITUDE' | 'STREAM_SUBJECT' | string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rawPayload: string;
  validationNotes?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  publishedRecordId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface University {
  id: string;
  code: string;
  name: string;
  location?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Stream {
  id: string;
  code: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  basketCategory?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArtsBasket {
  id: string;
  basketNumber: number;
  basketName: string;
  minSubjectsRequired: number;
  maxSubjectsAllowed: number;
  rulesDescription?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArtsBasketSubject {
  id: string;
  basketId: string;
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  createdAt?: string;
}

export interface CourseOffering {
  universityCode: string;
  universityName: string;
  intakeCapacity?: number;
  duration?: string | number;
  medium?: string;
  specialization?: string;
  faculty?: string;
}

export interface CourseMinimumRequirements {
  alStream?: string;
  requiredSubjects?: string[];
  minGrades?: string;
  aptitudeRequired?: boolean;
  description?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  streamId?: string;
  streamName?: string;
  totalIntake?: number | null;
  minimumEligibility?: string;
  durationYears?: number;
  degreeTitle?: string;
  details: string; // JSONB array of CourseOffering
  minimumRequirements: string; // JSONB of CourseMinimumRequirements
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UniCode {
  id: string;
  code: string;
  courseId: string;
  courseName: string;
  universityId: string;
  universityName: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface District {
  id: string;
  code: string;
  name: string;
  province: string;
  hasDisadvantage: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SpecialProvision {
  id: string;
  universityName: string;
  courseOfStudy: string;
  uniCode: string;
  differentlyAbled?: number | null;
  blindBraille?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Cutoff {
  id: string;
  uniCodeId: string;
  uniCode: string;
  courseName: string;
  universityName: string;
  academicYear: string;
  colombo?: number | null;
  gampaha?: number | null;
  kalutara?: number | null;
  kandy?: number | null;
  matale?: number | null;
  nuwaraEliya?: number | null;
  galle?: number | null;
  matara?: number | null;
  hambantota?: number | null;
  jaffna?: number | null;
  kilinochchi?: number | null;
  mannar?: number | null;
  vavuniya?: number | null;
  mullaitivu?: number | null;
  batticaloa?: number | null;
  ampara?: number | null;
  trincomalee?: number | null;
  kurunegala?: number | null;
  puttalam?: number | null;
  anuradhapura?: number | null;
  polonnaruwa?: number | null;
  badulla?: number | null;
  monaragala?: number | null;
  ratnapura?: number | null;
  kegalle?: number | null;
  nvqDistricts?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AptitudeRequirement {
  id: string;
  courseOfStudy?: string;
  courseName: string;
  universityName: string;
  uniCode: string;
  courseId?: string;
  universityId?: string;
  conductedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OlRequirement {
  id: string;
  uniCodes: string;
  courseOfStudy: string;
  sinhalaLanguage?: string;
  english?: string;
  mathematics?: string;
  science?: string;
  tamilLanguage?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
