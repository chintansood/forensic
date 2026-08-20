export type AgentStatus = 'complete' | 'running' | 'queued'
export type ViewKey = 'overview' | 'investigations' | 'documents' | 'vendors' | 'policies' | 'audit'

export interface DocumentRecord { id: string; name: string; vendor: string; amount: string; uploaded: string; status: string; risk: number; type: string }
export interface Agent { name: string; label: string; status: AgentStatus; detail: string; score?: string }
export interface Investigation { id: string; title: string; vendor: string; amount: string; risk: number; status: string; date: string; flag: string }
export interface Policy { name: string; description: string; coverage: string; updated: string; checks: number }
export interface AuditEvent { title: string; detail: string; time: string; kind: string }
