const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';

export interface AdvisorChatRequest {
  question: string;
  district?: string;
  zScore?: number;
  stream?: string;
  academicYear?: string;
}

export interface AdvisorChatResponse {
  answer: string;
  citedPages: number[];
  citedSections: string[];
  structuredMatchesCount: number;
  ragChunksCount: number;
  structuredDataPreview?: Array<Record<string, any>>;
}

export interface RagStats {
  totalHandbookChunks: number;
  vectorEngine: string;
  embeddingModel: string;
  ragStatus: string;
}

export async function askAdvisor(req: AdvisorChatRequest): Promise<AdvisorChatResponse> {
  const res = await fetch(`${API_BASE}/advisor/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export async function getRagStats(): Promise<RagStats> {
  const res = await fetch(`${API_BASE}/advisor/stats`);
  if (!res.ok) {
    throw new Error('Failed to fetch RAG stats');
  }
  return res.json();
}

export async function indexDocumentForRag(documentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/advisor/index/${documentId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Failed to index document for RAG');
  }
  return res.json();
}
