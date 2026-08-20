import type { AuditEvent, DocumentRecord, Investigation, ReportEvidence, RingEntity } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== 'false'

const documents: DocumentRecord[] = [
  { id: 'DOC-2048', name: 'invoice_acme_0428.pdf', vendor: 'Acme Industrial Supply', amount: '$18,420.00', uploaded: '2 min ago', status: 'Analyzed', risk: 86, type: 'PDF' },
  { id: 'DOC-2047', name: 'receipt_harbor_may.jpg', vendor: 'Harbor & Co.', amount: '$842.90', uploaded: '18 min ago', status: 'Analyzed', risk: 18, type: 'JPG' },
  { id: 'DOC-2046', name: 'invoice_northstar_119.pdf', vendor: 'Northstar Logistics', amount: '$6,200.00', uploaded: '1 hr ago', status: 'Review', risk: 64, type: 'PDF' },
]
const investigations: Investigation[] = [
  { id: 'INV-0084', title: 'Acme Industrial Supply', vendor: 'Acme Industrial Supply', amount: '$18,420.00', risk: 86, status: 'Needs review', date: 'Today, 09:42', flag: 'Duplicate invoice fingerprint' },
  { id: 'INV-0083', title: 'Northstar Logistics', vendor: 'Northstar Logistics', amount: '$6,200.00', risk: 64, status: 'In progress', date: 'Today, 08:15', flag: 'Policy exception' },
  { id: 'INV-0082', title: 'Harbor & Co.', vendor: 'Harbor & Co.', amount: '$842.90', risk: 18, status: 'Cleared', date: 'Yesterday', flag: 'No significant signals' },
]
const auditEvents: AuditEvent[] = [
  { title: 'Investigation created', detail: 'INV-0084 · invoice_acme_0428.pdf', time: '2 min ago', kind: 'analysis' },
  { title: 'Ring detection match found', detail: 'Shared fingerprint across 3 documents', time: '5 min ago', kind: 'alert' },
  { title: 'Policy exception detected', detail: 'Northstar Logistics · INV-0083', time: '1 hr ago', kind: 'policy' },
]

export async function listDocuments(): Promise<DocumentRecord[]> { if (USE_MOCK_DATA || !API_URL) return documents; const response = await fetch(`${API_URL}/documents`); if (!response.ok) throw new Error('Unable to load documents'); return response.json() }
export async function startAnalysis(file: File) { if (USE_MOCK_DATA || !API_URL) return { id: `DOC-${Date.now()}`, name: file.name, status: 'processing' }; const body = new FormData(); body.append('file', file); const response = await fetch(`${API_URL}/analysis`, { method: 'POST', body }); if (!response.ok) throw new Error('Unable to start analysis'); return response.json() }
export async function listInvestigations(): Promise<Investigation[]> { if (USE_MOCK_DATA || !API_URL) return investigations; const response = await fetch(`${API_URL}/investigations`); if (!response.ok) throw new Error('Unable to load investigations'); return response.json() }
export async function getReport(documentId: string): Promise<ReportEvidence> { if (USE_MOCK_DATA || !API_URL) return { documentId, flaggedRegions: ['duplicate line-item fingerprint', 'shared payment pattern'], verdict: 'HIGH RISK', recommendation: '' }; const response = await fetch(`${API_URL}/reports/${documentId}`); if (!response.ok) throw new Error('Unable to load report'); return response.json() }
export async function listAuditEvents(): Promise<AuditEvent[]> { if (USE_MOCK_DATA || !API_URL) return auditEvents; const response = await fetch(`${API_URL}/audit`); if (!response.ok) throw new Error('Unable to load audit events'); return response.json() }
export async function recordReview(documentId: string, decision: Exclude<ReportEvidence['recommendation'], ''>, note: string) { if (USE_MOCK_DATA || !API_URL) return { documentId, decision, note, recorded: true }; const response = await fetch(`${API_URL}/reports/${documentId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note }) }); if (!response.ok) throw new Error('Unable to record review'); return response.json() }
export const ringEntities: RingEntity[] = [
  { id: 'acme', name: 'ACME INDUSTRIAL', type: 'vendor', risk: 86 }, { id: 'northstar', name: 'NORTHSTAR LOGISTICS', type: 'vendor', risk: 64 }, { id: 'meridian', name: 'MERIDIAN OFFICE', type: 'vendor', risk: 64 }, { id: 'harbor', name: 'HARBOR & CO.', type: 'vendor', risk: 18 }, { id: 'account', name: 'COMMON ACCOUNT', type: 'account', risk: 54 },
]
