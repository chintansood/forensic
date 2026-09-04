export type AgentStatus = 'complete' | 'running' | 'queued';
export type ViewKey =
  | 'overview'
  | 'investigations'
  | 'documents'
  | 'vendors'
  | 'ring-detection'
  | 'policies'
  | 'audit';

export type ReviewDecision = 'APPROVED' | 'REJECTED' | 'ESCALATED' | '';

export interface DocumentRecord {
  id: string;
  name: string;
  vendor: string;
  amount: string;
  uploaded: string;
  status: string;
  risk: number;
  type: string;
  cloudinaryUrl?: string;
}

export interface Agent {
  name: string;
  label: string;
  status: AgentStatus;
  detail: string;
  score?: string;
}

export interface Investigation {
  id: string;
  document?: string;
  title?: string;
  vendor: string;
  amount: string;
  risk: number;
  status: string;
  date: string;
  flag: string;
}

export interface Policy {
  id?: string;
  name: string;
  description: string;
  coverage: string;
  updated: string;
  checks: number;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
  active?: boolean;
}

export interface AuditEvent {
  id?: string;
  title: string;
  detail: string;
  time: string;
  kind: string;
  actorId?: string;
}

export interface ReportEvidence {
  documentId: string;
  flaggedRegions: string[];
  verdict: string;
  recommendation: ReviewDecision;
}

export interface RingNode {
  id: string;
  name: string;
  x: number;
  y: number;
  type: 'node-main' | 'node-risk' | 'node-safe' | 'node-link';
  risk: number;
  documentId?: string;
  details?: {
    sharedAccount?: string;
    sharedAddress?: string;
    documentFingerprint?: string;
    documentCount?: number;
    similarityScore?: number;
  };
}

export interface RingLink {
  source: string;
  target: string;
  similarity: number;
  label: string;
}

export interface RingGraphResponse {
  totalDocuments: number;
  vendorEntities: number;
  sharedFingerprints: number;
  nodes: RingNode[];
  links: RingLink[];
}

export interface VendorRecord {
  name: string;
  risk: number;
  documents: string;
  amount: string;
}
