import type {
  AuditEvent,
  DocumentRecord,
  Investigation,
  Policy,
  ReportEvidence,
  RingGraphResponse,
  VendorRecord,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface AgentStatusResponse {
  documentId: string;
  pipelineStatus: 'RUNNING' | 'COMPLETE' | 'FAILED';
  agents: Array<{
    name: 'Extraction' | 'Forensics' | 'Policy Compliance' | 'Vendor History' | 'Ring-Detection' | 'Verdict';
    status: 'QUEUED' | 'RUNNING' | 'CLEAR' | 'FLAGGED' | 'REVIEW';
    detail: string | null;
  }>;
}

export interface DetailedReportResponse {
  documentId: string;
  fileName: string;
  cloudinaryUrl?: string;
  riskScore: number;
  decision: 'APPROVE' | 'REVIEW' | 'REJECT';
  explanation?: string;
  extractedFields: {
    vendor: string;
    invoiceNumber: string;
    date: string;
    lineItems: Array<{ description: string; amount: number }>;
    subtotal: number;
    tax: number;
    total: number;
  };
  findings: Array<{
    agent: string;
    severity: 'HIGH' | 'REVIEW' | 'CLEAR';
    title: string;
    description: string;
    flaggedRegion?: { x: number; y: number; width: number; height: number };
    citedClause?: string;
    matchedDocumentIds?: string[];
  }>;
  documentHash: string;
}

// 1. Upload Document
export async function uploadDocument(file: File): Promise<{
  documentId: string;
  fileName: string;
  fileSizeMB: number;
  cloudinaryUrl: string;
  status: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/api/documents/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

// 2. Start Verification Pipeline
export async function verifyDocument(documentId: string): Promise<{ documentId: string; status: string }> {
  const res = await fetch(`${API_URL}/api/documents/${documentId}/verify`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Failed to start verification pipeline');
  }
  return res.json();
}

// 3. Status Polling
export async function getDocumentStatus(documentId: string): Promise<AgentStatusResponse> {
  const res = await fetch(`${API_URL}/api/documents/${documentId}/status`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch pipeline status');
  }
  return res.json();
}

// 4. Report
export async function getDocumentReport(documentId: string): Promise<DetailedReportResponse> {
  const res = await fetch(`${API_URL}/api/documents/${documentId}/report`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch document report');
  }
  return res.json();
}

// 5. Reviewer Actions
export async function recordDocumentAction(
  documentId: string,
  action: 'APPROVE' | 'REJECT' | 'ESCALATE',
  actorId: string = 'reviewer_alex',
  note?: string
): Promise<{ documentId: string; action: string; loggedAt: string }> {
  const res = await fetch(`${API_URL}/api/documents/${documentId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, actorId, note }),
  });
  if (!res.ok) {
    throw new Error('Failed to record reviewer action');
  }
  return res.json();
}

// 6. Documents List
export async function listDocuments(): Promise<DocumentRecord[]> {
  try {
    const res = await fetch(`${API_URL}/api/documents`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load documents');
    return res.json();
  } catch (e) {
    return [
      { id: 'DOC-2048', name: 'invoice_acme_0428.pdf', vendor: 'Acme Industrial Supply', amount: '$18,420.00', uploaded: '2 min ago', status: 'Analyzed', risk: 86, type: 'PDF' },
      { id: 'DOC-2047', name: 'receipt_harbor_may.jpg', vendor: 'Harbor & Co.', amount: '$842.90', uploaded: '18 min ago', status: 'Analyzed', risk: 18, type: 'JPG' },
      { id: 'DOC-2046', name: 'billing_northstar_09.pdf', vendor: 'Northstar Logistics', amount: '$6,140.00', uploaded: '1 hr ago', status: 'Analyzed', risk: 64, type: 'PDF' },
    ];
  }
}

// 7. Investigations List
export async function listInvestigations(): Promise<Investigation[]> {
  try {
    const res = await fetch(`${API_URL}/api/investigations`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load investigations');
    return res.json();
  } catch (e) {
    return [
      { id: 'INV-0084', document: 'invoice_acme_0428.pdf', vendor: 'Acme Industrial Supply', amount: '$18,420.00', risk: 86, status: 'NEEDS REVIEW', date: '2 min ago', flag: 'Template fingerprint match' },
      { id: 'INV-0083', document: 'receipt_harbor_may.jpg', vendor: 'Harbor & Co.', amount: '$842.90', risk: 18, status: 'CLEARED', date: '18 min ago', flag: 'Clean integrity verify' },
      { id: 'INV-0082', document: 'billing_northstar_09.pdf', vendor: 'Northstar Logistics', amount: '$6,140.00', risk: 64, status: 'MONITOR', date: '1 hr ago', flag: 'Spend variance check' },
    ];
  }
}

// 8. Vendors List
export async function listVendors(): Promise<Array<[string, number, string, string]>> {
  try {
    const res = await fetch(`${API_URL}/api/vendors`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load vendors');
    return res.json();
  } catch (e) {
    return [
      ['Acme Industrial Supply', 86, '18 documents', '$48,220'],
      ['Northstar Logistics', 64, '42 documents', '$126,400'],
      ['Meridian Office Group', 42, '27 documents', '$84,900'],
      ['Harbor & Co.', 18, '9 documents', '$12,840'],
    ];
  }
}

// 9. Vendor Details & History
export async function getVendorDetails(vendorName: string) {
  try {
    const res = await fetch(`${API_URL}/api/vendors/${encodeURIComponent(vendorName)}/history`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load vendor history');
    return res.json();
  } catch (e) {
    return null;
  }
}

// 10. Ring Detection Graph
export async function getRingGraph(): Promise<RingGraphResponse> {
  try {
    const res = await fetch(`${API_URL}/api/vendors/rings`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load ring graph');
    return res.json();
  } catch (e) {
    return {
      totalDocuments: 1248,
      vendorEntities: 18,
      sharedFingerprints: 6,
      nodes: [
        { id: 'acme', name: 'ACME INDUSTRIAL', x: 350, y: 150, type: 'node-main', risk: 86, details: { sharedAccount: '•••• 4421 · 4 matches', sharedAddress: '83 Mercer Ave · 3 matches', documentFingerprint: 'INV-0428 · 3 matches', documentCount: 18 } },
        { id: 'northstar', name: 'NORTHSTAR LOGISTICS', x: 160, y: 80, type: 'node-risk', risk: 64, details: { sharedAccount: '•••• 4421 · 2 matches', sharedAddress: '83 Mercer Ave · 1 match', documentFingerprint: 'INV-110 · 2 matches', documentCount: 42 } },
        { id: 'meridian', name: 'MERIDIAN OFFICE', x: 560, y: 76, type: 'node-risk', risk: 64, details: { sharedAccount: '•••• 8831 · 1 match', sharedAddress: '14 Commerce Way · 1 match', documentFingerprint: 'INV-71 · 1 match', documentCount: 27 } },
        { id: 'harbor', name: 'HARBOR & CO.', x: 560, y: 250, type: 'node-safe', risk: 18, details: { sharedAccount: '•••• 1092 · Verified Direct', sharedAddress: '42 Harbor View Pier 9', documentFingerprint: 'REC-501 · Unique', documentCount: 9 } },
        { id: 'account', name: 'COMMON ACCOUNT', x: 350, y: 270, type: 'node-link', risk: 54, details: { sharedAccount: '•••• 4421 · 4 connected entities', sharedAddress: 'Multiple entity remittances', documentFingerprint: 'Template cluster #0421', documentCount: 8 } },
      ],
      links: [
        { source: 'acme', target: 'northstar', similarity: 0.88, label: '88% Template Match' },
        { source: 'acme', target: 'meridian', similarity: 0.84, label: '84% Structural Match' },
        { source: 'acme', target: 'harbor', similarity: 0.22, label: 'Low Correlation' },
        { source: 'acme', target: 'account', similarity: 0.96, label: 'Shared Remit Bank' },
        { source: 'northstar', target: 'account', similarity: 0.94, label: 'Shared Remit Bank' },
      ],
    };
  }
}

// 11. Policies List & Management
export async function listPolicies(): Promise<Policy[]> {
  try {
    const res = await fetch(`${API_URL}/api/policies`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load policies');
    return res.json();
  } catch (e) {
    return [
      { name: 'P-001', description: 'Duplicate invoice detection: Flags repeated invoice fingerprints across vendors.', coverage: 'INTEGRITY CHECK', updated: 'Active', checks: 240, severity: 'HIGH', active: true },
      { name: 'P-014', description: 'Approval threshold: Requires second approval for spend over $10,000.', coverage: 'APPROVAL THRESHOLD', updated: 'Active', checks: 184, severity: 'HIGH', active: true },
      { name: 'P-021', description: 'Weekend submission: Monitors documents submitted outside business hours.', coverage: 'SUBMISSION TIMING', updated: 'Paused', checks: 45, severity: 'LOW', active: false },
      { name: 'P-033', description: 'Vendor concentration: Alerts when spend concentration exceeds 35%.', coverage: 'VENDOR GOVERNANCE', updated: 'Active', checks: 89, severity: 'MEDIUM', active: true },
    ];
  }
}

export async function createPolicy(policy: { text: string; category?: string; code?: string }): Promise<Policy> {
  const res = await fetch(`${API_URL}/api/policies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(policy),
  });
  if (!res.ok) throw new Error('Failed to create policy');
  return res.json();
}

// 12. Audit Logs
export async function listAuditEvents(): Promise<AuditEvent[]> {
  try {
    const res = await fetch(`${API_URL}/api/audit`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load audit events');
    return res.json();
  } catch (e) {
    return [];
  }
}
