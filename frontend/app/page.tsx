'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Activity, ArrowDownToLine, ArrowLeft, Bell, Check, ChevronRight, CircleHelp,
  ClipboardCheck, Clock3, FileCheck2, FileSearch, Files, Fingerprint, GitBranch,
  History, LayoutDashboard, Menu, MoreHorizontal, Network, Plus, Search, Settings2,
  ShieldAlert, ShieldCheck, SlidersHorizontal, UploadCloud, Users, X, ZoomIn, ZoomOut, RotateCcw,
  Loader2, AlertTriangle, ExternalLink, Download, Sparkles
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ViewKey, Policy, RingGraphResponse, RingNode } from '@/types'
import {
  uploadDocument,
  verifyDocument,
  getDocumentStatus,
  getDocumentReport,
  recordDocumentAction,
  listDocuments,
  listInvestigations,
  listVendors,
  getRingGraph,
  listPolicies,
  createPolicy,
  listAuditEvents,
  DetailedReportResponse,
  AgentStatusResponse
} from '@/services/api'

const trend = [
  { day: 'MON', risk: 18 },
  { day: 'TUE', risk: 26 },
  { day: 'WED', risk: 21 },
  { day: 'THU', risk: 44 },
  { day: 'FRI', risk: 38 },
  { day: 'SAT', risk: 61 },
  { day: 'SUN', risk: 52 },
]

const navItems: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'investigations', label: 'Investigations', icon: FileSearch },
  { key: 'documents', label: 'Documents', icon: Files },
  { key: 'vendors', label: 'Vendors', icon: Users },
  { key: 'ring-detection', label: 'Ring Detection', icon: Network },
  { key: 'policies', label: 'Policies', icon: ShieldCheck },
  { key: 'audit', label: 'Audit trail', icon: History },
]

function riskClass(risk: number) {
  return risk >= 70 ? 'risk-high' : risk >= 40 ? 'risk-medium' : 'risk-low'
}

function Risk({ value }: { value: number }) {
  return (
    <span className={riskClass(value)}>
      {value}
      <small>/100</small>
    </span>
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>
}

function routeFor(key: ViewKey) {
  return key === 'overview' ? '/' : `/${key === 'investigations' ? 'verify' : key}`
}

function Shell({
  view,
  setView,
  onUpload,
  onOpenSearch,
  onOpenNotifications,
  onOpenSettings,
  onOpenHelp,
  children,
}: {
  view: ViewKey
  setView: (v: ViewKey) => void
  onUpload: () => void
  onOpenSearch: () => void
  onOpenNotifications: () => void
  onOpenSettings: () => void
  onOpenHelp: () => void
  children: React.ReactNode
}) {
  const router = useRouter()
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div
          className="brand-mark"
          style={{ cursor: 'pointer' }}
          title="Return to Overview"
          onClick={() => {
            setView('overview')
            router.push('/')
          }}
        >
          <Fingerprint size={18} />
        </div>
        <div className="side-nav">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              title={label}
              aria-label={label}
              className={view === key ? 'active' : ''}
              onClick={() => {
                setView(key)
                router.push(routeFor(key))
              }}
            >
              <Icon size={18} />
              {key === 'investigations' && <i />}
            </button>
          ))}
        </div>
        <div className="side-bottom">
          <button title="Settings" onClick={onOpenSettings}>
            <Settings2 size={18} />
          </button>
          <button title="Help & Documentation" onClick={onOpenHelp}>
            <CircleHelp size={18} />
          </button>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="mobile-brand" onClick={() => { setView('overview'); router.push('/'); }}>
            <Menu size={18} />
            <span>
              DOCFORENSIC <b>AI</b>
            </span>
          </div>
          <div className="crumb">
            <span>WORKSPACE</span>
            <ChevronRight size={13} />
            <b style={{ textTransform: 'uppercase' }}>{view.replace('-', ' ')}</b>
          </div>
          <div className="top-actions">
            <button className="search-btn" onClick={onOpenSearch}>
              <Search size={14} /> SEARCH <kbd>⌘K</kbd>
            </button>
            <button className="icon-btn" aria-label="Notifications" onClick={onOpenNotifications} title="Notifications">
              <Bell size={16} />
              <i />
            </button>
            <button className="new-btn" onClick={onUpload}>
              <Plus size={15} /> NEW ANALYSIS
            </button>
            <div className="avatar" title="Alex Chen (Lead Forensics)">AC</div>
          </div>
        </header>
        <div className="workspace">{children}</div>
      </div>
    </main>
  )
}

function SearchModal({
  open,
  onClose,
  onOpenDoc,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  onOpenDoc: (id: string) => void
  onNavigate: (view: ViewKey) => void
}) {
  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])

  useEffect(() => {
    if (open) {
      listDocuments().then(setDocs)
      listVendors().then(setVendors)
    }
  }, [open])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!open) return null

  const filteredDocs = docs.filter((d) =>
    (d.name + (d.vendor || '') + (d.id || '')).toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5)

  const filteredVendors = vendors.filter(([v]) =>
    v.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 4)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="upload-modal" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="toolbar" style={{ margin: '0 0 16px', background: '#121416', padding: '8px 12px', borderRadius: '6px' }}>
          <Search size={16} style={{ color: '#f25a38' }} />
          <input
            autoFocus
            placeholder="Search documents, entities, investigations, or policies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', fontSize: '13px', color: '#fff' }}
          />
          <kbd style={{ fontSize: '10px', color: '#888', background: '#222', padding: '2px 6px', borderRadius: '3px' }}>ESC</kbd>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '380px', overflowY: 'auto' }}>
          <div>
            <span className="eyebrow" style={{ fontSize: '10px' }}>DOCUMENTS & INVESTIGATIONS</span>
            <div style={{ marginTop: '6px' }}>
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => (
                  <button
                    key={doc.id}
                    className="queue-row"
                    style={{ padding: '8px 10px', borderRadius: '4px', cursor: 'pointer' }}
                    onClick={() => {
                      onClose()
                      onOpenDoc(doc.id)
                    }}
                  >
                    <div className="queue-icon">
                      <FileSearch size={14} />
                    </div>
                    <span>
                      <b>{doc.name}</b>
                      <small>{doc.vendor} · {doc.amount} · Risk: {doc.risk}/100</small>
                    </span>
                    <Risk value={doc.risk} />
                  </button>
                ))
              ) : (
                <div style={{ fontSize: '11px', color: '#777', padding: '6px 0' }}>No matching documents</div>
              )}
            </div>
          </div>

          <div>
            <span className="eyebrow" style={{ fontSize: '10px' }}>VENDOR NETWORK</span>
            <div style={{ marginTop: '6px' }}>
              {filteredVendors.map(([name, risk, docCount]) => (
                <button
                  key={name}
                  className="queue-row"
                  style={{ padding: '8px 10px', borderRadius: '4px', cursor: 'pointer' }}
                  onClick={() => {
                    onClose()
                    onNavigate('vendors')
                  }}
                >
                  <div className="queue-icon" style={{ color: '#60a5fa', background: 'rgba(96,165,250,0.1)' }}>
                    <Users size={14} />
                  </div>
                  <span>
                    <b>{name}</b>
                    <small>{docCount} on record</small>
                  </span>
                  <Risk value={risk} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="eyebrow" style={{ fontSize: '10px' }}>NAVIGATION SHORTCUTS</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              <button className="search-btn" onClick={() => { onClose(); onNavigate('ring-detection'); }}>
                <Network size={12} /> Open Ring Detection
              </button>
              <button className="search-btn" onClick={() => { onClose(); onNavigate('policies'); }}>
                <ShieldCheck size={12} /> Policy Controls
              </button>
              <button className="search-btn" onClick={() => { onClose(); onNavigate('audit'); }}>
                <History size={12} /> Audit Trail
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NotificationsModal({ open, onClose, onOpenDoc }: { open: boolean; onClose: () => void; onOpenDoc: (id: string) => void }) {
  const alerts = [
    { id: '1', title: 'Ring Fraud Cluster Flagged', desc: 'Frontline Global & Nexus Supply share exact remit routing and layout fingerprint.', time: '5m ago', type: 'danger', docId: 'doc_d1ee785d' },
    { id: '2', title: 'Pixel Tampering Detected', desc: 'Acme Industrial Supply invoice total modified post-issuance (ELA score: 86).', time: '22m ago', type: 'danger', docId: 'DOC-2048' },
    { id: '3', title: 'Policy Threshold Exception', desc: 'Enterprise Security Subscription exceeds auto-approval threshold of $10,000.', time: '1h ago', type: 'warning', docId: 'DOC-2046' },
    { id: '4', title: 'Audit Verification Cleared', desc: 'Harbor & Co. receipt verified authentic and logged to PostgreSQL ledger.', time: '2h ago', type: 'info', docId: 'DOC-2047' },
  ]

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="upload-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">INTELLIGENCE ALERTS</span>
            <h2>Workspace Notifications</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
          {alerts.map((a) => (
            <div
              key={a.id}
              onClick={() => {
                onClose()
                if (a.docId) onOpenDoc(a.docId)
              }}
              style={{
                padding: '12px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ fontSize: '12px', color: a.type === 'danger' ? '#f25a38' : a.type === 'warning' ? '#fbbf24' : '#60a5fa' }}>
                  {a.title}
                </b>
                <small style={{ fontSize: '10px', color: '#777' }}>{a.time}</small>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#aeb3b7', lineHeight: '1.4' }}>
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [threshold, setThreshold] = useState(75)
  const [elaSensitivity, setElaSensitivity] = useState(85)
  const [ringThreshold, setRingThreshold] = useState(82)
  const [saved, setSaved] = useState(false)

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="upload-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">CONFIGURATION</span>
            <h2>Workspace Settings</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <div className="form-block">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>HIGH RISK VERDICT THRESHOLD</label>
              <b style={{ fontSize: '12px', color: '#f25a38' }}>{threshold}/100</b>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#f25a38', cursor: 'pointer' }}
            />
            <small style={{ color: '#888', fontSize: '10px' }}>
              Invoices with composite risk above this score are flagged for mandatory rejection review.
            </small>
          </div>

          <div className="form-block">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>RING DETECTION COSINE SIMILARITY</label>
              <b style={{ fontSize: '12px', color: '#60a5fa' }}>{ringThreshold}%</b>
            </div>
            <input
              type="range"
              min="70"
              max="98"
              value={ringThreshold}
              onChange={(e) => setRingThreshold(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#60a5fa', cursor: 'pointer' }}
            />
            <small style={{ color: '#888', fontSize: '10px' }}>
              Minimum pgvector 1536-dim embedding cosine similarity required to flag cross-vendor ring clusters.
            </small>
          </div>

          <div className="form-block">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label>ERROR LEVEL ANALYSIS (ELA) SENSITIVITY</label>
              <b style={{ fontSize: '12px', color: '#4ade80' }}>{elaSensitivity}%</b>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={elaSensitivity}
              onChange={(e) => setElaSensitivity(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#4ade80', cursor: 'pointer' }}
            />
          </div>

          <button
            className="solid-btn full"
            onClick={() => {
              setSaved(true)
              setTimeout(() => {
                setSaved(false)
                onClose()
              }, 600)
            }}
          >
            {saved ? <Check size={15} /> : null} {saved ? 'SETTINGS SAVED' : 'SAVE CONFIGURATION'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="upload-modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">DOCUMENTATION</span>
            <h2>Multi-Agent Pipeline Architecture</h2>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', fontSize: '11px', color: '#c7cbcc' }}>
          <p>
            DocForensic AI executes a 6-agent forensic pipeline orchestrated asynchronously over PostgreSQL pgvector and Python computer vision services:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <b style={{ color: '#e8eaed' }}>1. Extraction Agent:</b> Tesseract OCR + structured invoice parser (vendor, line items, taxes, totals).
            </div>
            <div>
              <b style={{ color: '#e8eaed' }}>2. Forensics Agent:</b> Error Level Analysis (ELA) + font edge consistency + metadata editor inspection.
            </div>
            <div>
              <b style={{ color: '#e8eaed' }}>3. Policy Compliance Agent:</b> Evaluates invoice parameters against corporate spending rules via pgvector semantic RAG.
            </div>
            <div>
              <b style={{ color: '#e8eaed' }}>4. Vendor History Agent:</b> Analyzes historical spend baseline and detects cadence/amount anomalies.
            </div>
            <div>
              <b style={{ color: '#e8eaed' }}>5. Ring-Detection Agent:</b> 1536-dim perceptual embedding cosine similarity search in pgvector to uncover cross-vendor collusion networks.
            </div>
            <div>
              <b style={{ color: '#e8eaed' }}>6. Verdict Agent:</b> Multi-signal composite risk scoring with explainable executive recommendations.
            </div>
          </div>
          <button className="solid-btn full" onClick={onClose} style={{ marginTop: '10px' }}>
            GOT IT
          </button>
        </div>
      </div>
    </div>
  )
}

function UploadModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean
  onClose: () => void
  onComplete: (docId: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [pipelineState, setPipelineState] = useState<AgentStatusResponse | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setIsUploading(false)
      setActiveDocId(null)
      setPipelineState(null)
      setUploadError(null)
    }
  }, [open])

  // Polling pipeline status
  useEffect(() => {
    if (!activeDocId || !isUploading) return

    const interval = setInterval(async () => {
      try {
        const state = await getDocumentStatus(activeDocId)
        setPipelineState(state)

        if (state.pipelineStatus === 'COMPLETE') {
          clearInterval(interval)
          setTimeout(() => {
            onClose()
            onComplete(activeDocId)
          }, 800)
        } else if (state.pipelineStatus === 'FAILED') {
          clearInterval(interval)
          setUploadError('Pipeline execution failed. Check audit logs.')
          setIsUploading(false)
        }
      } catch (err: any) {
        console.error('Polling error:', err)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [activeDocId, isUploading, onClose, onComplete])

  const handleStartAnalysis = async () => {
    if (!file) return
    setIsUploading(true)
    setUploadError(null)

    try {
      // 1. Upload to backend
      const uploadRes = await uploadDocument(file)
      setActiveDocId(uploadRes.documentId)

      // 2. Start verification pipeline
      await verifyDocument(uploadRes.documentId)

      // Initialize status view
      setPipelineState({
        documentId: uploadRes.documentId,
        pipelineStatus: 'RUNNING',
        agents: [
          { name: 'Extraction', status: 'RUNNING', detail: 'Reading OCR & fields...' },
          { name: 'Forensics', status: 'QUEUED', detail: null },
          { name: 'Policy Compliance', status: 'QUEUED', detail: null },
          { name: 'Vendor History', status: 'QUEUED', detail: null },
          { name: 'Ring-Detection', status: 'QUEUED', detail: null },
          { name: 'Verdict', status: 'QUEUED', detail: null },
        ],
      })
    } catch (err: any) {
      setIsUploading(false)
      setUploadError(err.message || 'Failed to upload document')
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="upload-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">NEW INVESTIGATION</span>
            <h2>{isUploading ? 'Forensic Pipeline Running' : 'Upload a document'}</h2>
          </div>
          {!isUploading && (
            <button onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>

        {uploadError && (
          <div style={{ color: '#f25a38', background: 'rgba(242,90,56,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', margin: '12px 0' }}>
            {uploadError}
          </div>
        )}

        {!isUploading ? (
          <>
            <div
              className="dropzone"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                setFile(e.dataTransfer.files[0] ?? null)
              }}
            >
              <UploadCloud size={30} />
              <strong>{file ? file.name : 'Drop an invoice, receipt, or PDF here'}</strong>
              <span>PDF, PNG, JPG up to 25 MB</span>
              <input
                ref={input}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button className="choose-btn">CHOOSE FILE</button>
            </div>
            <p className="modal-note">
              <Activity size={14} /> Six agents will analyze the document and return an explainable verdict.
            </p>
            <button className="start-btn" onClick={handleStartAnalysis} disabled={!file}>
              START ANALYSIS <ArrowDownToLine size={15} />
            </button>
          </>
        ) : (
          <div className="pipeline-live-view" style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '10px 0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: '#9098a2' }}>
                Analyzing: <b>{file?.name}</b>
              </span>
              <span className="live-label" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: '#f25a38' }}>
                <Loader2 size={12} className="animate-spin" /> RUNNING
              </span>
            </div>

            {pipelineState?.agents.map((agent) => (
              <div
                key={agent.name}
                className="agent-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className={`agent-dot ${
                      agent.status === 'CLEAR'
                        ? 'done'
                        : agent.status === 'FLAGGED'
                        ? 'danger'
                        : agent.status === 'RUNNING'
                        ? 'run'
                        : agent.status === 'REVIEW'
                        ? 'review'
                        : ''
                    }`}
                  />
                  <div>
                    <b style={{ fontSize: '13px', color: '#e8eaed' }}>{agent.name}</b>
                    {agent.detail && <small style={{ display: 'block', fontSize: '11px', color: '#88919d' }}>{agent.detail}</small>}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    color:
                      agent.status === 'CLEAR'
                        ? '#4ade80'
                        : agent.status === 'FLAGGED'
                        ? '#f25a38'
                        : agent.status === 'RUNNING'
                        ? '#60a5fa'
                        : agent.status === 'REVIEW'
                        ? '#fbbf24'
                        : '#6b7280',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  {agent.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}

function Overview({ onUpload, onOpen }: { onUpload: () => void; onOpen: (id: string) => void }) {
  const [investigationsList, setInvestigationsList] = useState<any[]>([])

  useEffect(() => {
    listInvestigations().then((data) => {
      if (data && data.length > 0) setInvestigationsList(data)
    })
  }, [])

  const displayList =
    investigationsList.length > 0
      ? investigationsList
      : [
          { id: 'INV-0084', document: 'invoice_acme_0428.pdf', vendor: 'Acme Industrial Supply', amount: '$18,420.00', risk: 86, status: 'NEEDS REVIEW', flag: 'Template fingerprint match' },
          { id: 'INV-0083', document: 'receipt_harbor_may.jpg', vendor: 'Harbor & Co.', amount: '$842.90', risk: 18, status: 'CLEARED', flag: 'Clean integrity verify' },
          { id: 'INV-0082', document: 'billing_northstar_09.pdf', vendor: 'Northstar Logistics', amount: '$6,140.00', risk: 64, status: 'MONITOR', flag: 'Spend variance check' },
        ]

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE / OVERVIEW</span>
          <h1>Operations command</h1>
          <p>Real-time forensic pipeline telemetry, risk distribution, and prioritized verification queue.</p>
        </div>
        <button className="outline-btn" onClick={onUpload}>
          <UploadCloud size={15} /> UPLOAD DOCUMENT
        </button>
      </div>

      <div className="metric-grid">
        <Panel className="metric">
          <div>
            <span>FLAGGED DOCUMENTS</span>
            <strong>34</strong>
            <small className="danger">+4 since yesterday</small>
          </div>
          <ShieldAlert size={19} />
        </Panel>
        <Panel className="metric">
          <div>
            <span>CLEARED EXPENSES</span>
            <strong>1,196</strong>
            <small>96.2% pass rate</small>
          </div>
          <ShieldCheck size={19} />
        </Panel>
        <Panel className="metric">
          <div>
            <span>ACTIVE ENTITIES</span>
            <strong>18</strong>
            <small>6 ring clusters</small>
          </div>
          <Users size={19} />
        </Panel>
        <Panel className="metric">
          <div>
            <span>AVG VERIFICATION</span>
            <strong>1.8s</strong>
            <small>FastAPI + Claude RAG</small>
          </div>
          <Clock3 size={19} />
        </Panel>
      </div>

      <div className="dashboard-grid">
        <Panel>
          <div className="panel-head">
            <div>
              <h2>Risk Trend Trajectory</h2>
              <p>7-day rolling average of composite anomaly scores</p>
            </div>
            <button className="filter-btn">
              PAST 7 DAYS <ChevronRight size={13} />
            </button>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f25a38" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f25a38" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#6d7278" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#6d7278" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: '#181a1d',
                    border: '1px solid #303338',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}
                />
                <Area type="monotone" dataKey="risk" stroke="#f25a38" strokeWidth={2} fillOpacity={1} fill="url(#riskGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <div className="panel-head">
            <div>
              <h2>Active Review Queue</h2>
              <p>{displayList.length} investigations pending review</p>
            </div>
            <button className="text-btn" onClick={() => onOpen(displayList[0]?.id || 'INV-0084')}>
              VIEW ALL <ChevronRight size={13} />
            </button>
          </div>
          <div className="queue">
            {displayList.slice(0, 4).map((item) => (
              <button key={item.id} onClick={() => onOpen(item.id)} className="queue-row">
                <div className="queue-icon">
                  <FileSearch size={15} />
                </div>
                <span>
                  <b>{item.vendor}</b>
                  <small>
                    {item.document || item.id} · {item.amount} · {item.flag}
                  </small>
                </span>
                <Risk value={item.risk} />
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function InvestigationTable({ items, onOpen }: { items: any[]; onOpen: (id: string) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>INVESTIGATION / VENDOR</th>
            <th>DOCUMENT</th>
            <th>AMOUNT</th>
            <th>RISK SCORE</th>
            <th>PRIMARY SIGNAL</th>
            <th>STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id ? `${item.id}-${idx}` : `row-${idx}`} onClick={() => onOpen(item.id)}>
              <td>
                <b>{item.vendor || item.title}</b>
                <small>{item.id} · {item.date || 'Recent'}</small>
              </td>
              <td>{item.document || item.name || `${item.id}.pdf`}</td>
              <td>{item.amount || '—'}</td>
              <td>
                <Risk value={item.risk || 20} />
              </td>
              <td>{item.flag || item.detail || 'Standard review'}</td>
              <td>
                <span className={`status ${item.status === 'NEEDS REVIEW' || item.status === 'FLAGGED' ? 'status-danger' : ''}`}>
                  {item.status || 'CLEARED'}
                </span>
              </td>
              <td>
                <ChevronRight size={15} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ListView({ view, onUpload, onOpen }: { view: ViewKey; onUpload: () => void; onOpen: (id: string) => void }) {
  const titles: Record<string, [string, string]> = {
    investigations: ['Investigations', 'Review risk signals and make evidence-backed decisions.'],
    documents: ['Documents', 'Every upload, extraction, and verdict in one place.'],
    vendors: ['Vendors', 'Understand transaction behavior across your vendor network.'],
    policies: ['Policies', 'Rules your Policy Agent uses to evaluate spend.'],
    audit: ['Audit trail', 'A complete, immutable record of workspace activity.'],
  }
  const [title, sub] = titles[view] || ['Investigations', '']
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    if (view === 'investigations') {
      listInvestigations().then(setItems)
    } else if (view === 'documents') {
      listDocuments().then(setItems)
    } else if (view === 'audit') {
      listAuditEvents().then(setItems)
    }
  }, [view])

  const filtered = useMemo(() => {
    return items.filter((x) => {
      const matchQuery = ((x.vendor || x.name || x.title || '') + (x.document || x.detail || '') + (x.flag || ''))
        .toLowerCase()
        .includes(query.toLowerCase())
      const matchStatus = statusFilter === 'ALL' || (x.status && x.status.toUpperCase().includes(statusFilter))
      return matchQuery && matchStatus
    })
  }, [items, query, statusFilter])

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE / {title.toUpperCase()}</span>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
        <button className="solid-btn" onClick={onUpload}>
          <Plus size={15} /> NEW ANALYSIS
        </button>
      </div>
      <div className="toolbar">
        <label>
          <Search size={14} />
          <input
            aria-label={`Search ${title}`}
            placeholder={`Search ${title.toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            const next = statusFilter === 'ALL' ? 'REVIEW' : statusFilter === 'REVIEW' ? 'CLEARED' : 'ALL'
            setStatusFilter(next)
          }}
        >
          <SlidersHorizontal size={14} /> STATUS: {statusFilter}
        </button>
        <button>
          <Clock3 size={14} /> LAST 30 DAYS
        </button>
      </div>
      <Panel className="table-panel">
        <InvestigationTable items={filtered.length > 0 ? filtered : items} onOpen={onOpen} />
      </Panel>
    </div>
  )
}

function Report({ id, onBack }: { id: string; onBack: () => void }) {
  const [decision, setDecision] = useState('')
  const [note, setNote] = useState('')
  const [zoom, setZoom] = useState(100)
  const [report, setReport] = useState<DetailedReportResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getDocumentReport(id)
      .then((data) => {
        setReport(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load report:', err)
        setLoading(false)
      })
  }, [id])

  const handleAction = async (action: 'APPROVE' | 'REJECT' | 'ESCALATE') => {
    try {
      await recordDocumentAction(id, action, 'reviewer_alex', note)
      setDecision(action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'ESCALATED')
    } catch (e) {
      console.error('Action error:', e)
    }
  }

  const risk = report?.riskScore ?? 82
  const extracted = report?.extractedFields ?? {
    vendor: 'Office Supplies Co.',
    invoiceNumber: 'INV-876954',
    date: '2026-10-12',
    lineItems: [
      { description: 'Software Licensing Fee (1yr)', amount: 750.0 },
      { description: 'Enterprise Security Subscription', amount: 1200.0 },
    ],
    subtotal: 1950.0,
    tax: 156.0,
    total: 2106.0,
  }

  const forensicFinding = report?.findings.find((f) => f.agent === 'Forensics')
  const ringFinding = report?.findings.find((f) => f.agent === 'Ring-Detection' && f.severity === 'HIGH')

  return (
    <div className="page-stack">
      <div className="report-top">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={15} /> BACK TO INVESTIGATIONS
        </button>
        <div className="report-actions">
          <button onClick={() => setZoom(Math.max(70, zoom - 10))} title="Zoom Out">
            <ZoomOut size={14} />
          </button>
          <button onClick={() => setZoom(100)} title="Reset Zoom">
            <RotateCcw size={14} /> {zoom}%
          </button>
          <button onClick={() => setZoom(Math.min(140, zoom + 10))} title="Zoom In">
            <ZoomIn size={14} />
          </button>
          <button className="danger-btn" onClick={() => handleAction('REJECT')}>
            REJECT
          </button>
          <button className="approve-btn" onClick={() => handleAction('APPROVE')}>
            <Check size={15} /> APPROVE
          </button>
        </div>
      </div>

      <div className="report-heading">
        <div>
          <span className="eyebrow">INVESTIGATION / {id}</span>
          <h1>{report?.fileName || `document_${id}.pdf`}</h1>
          <p>
            {extracted.vendor} · Uploaded recently ·{' '}
            <span className={`status ${risk >= 70 ? 'status-danger' : ''}`}>
              {risk >= 70 ? 'NEEDS REVIEW' : risk >= 40 ? 'MONITOR' : 'CLEARED'}
            </span>
          </p>
        </div>
        <Risk value={risk} />
      </div>

      <div className="report-grid">
        <Panel className="document-preview">
          <div className="panel-head">
            <div>
              <h2>Evidence preview</h2>
              <p>Flagged regions are highlighted for pixel-level review</p>
            </div>
            <span className="doc-tag">AUTHENTIC EVIDENCE</span>
          </div>

          <div
            className="paper"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              position: 'relative',
            }}
          >
            <div className="paper-top">
              <b>{extracted.vendor.toUpperCase()}</b>
              <span>{extracted.invoiceNumber ? `#${extracted.invoiceNumber}` : 'INVOICE'}</span>
            </div>
            <div className="paper-line wide" />
            <div className="paper-meta">
              <span>Bill to: Global Enterprises Inc.</span>
              <span>Date: {extracted.date}</span>
            </div>
            <div className="paper-line" />

            {extracted.lineItems.map((item, idx) => (
              <div
                key={idx}
                className={`paper-item ${idx === 0 && forensicFinding?.severity === 'HIGH' ? 'flagged' : ''}`}
              >
                <span>{item.description}</span>
                <b>${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
                {idx === 0 && forensicFinding?.severity === 'HIGH' && <i>compression anomaly</i>}
              </div>
            ))}

            <div className="paper-line" />
            <div className="paper-item" style={{ fontSize: '13px', color: '#666' }}>
              <span>Subtotal:</span>
              <b>${Number(extracted.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
            </div>
            <div className="paper-item" style={{ fontSize: '13px', color: '#666' }}>
              <span>Tax (8%):</span>
              <b>${Number(extracted.tax).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
            </div>

            <div
              className={`paper-total ${forensicFinding?.severity === 'HIGH' ? 'flagged' : ''}`}
              style={{ position: 'relative' }}
            >
              <span>TOTAL DUE</span>
              <b>${Number(extracted.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</b>
              {forensicFinding?.severity === 'HIGH' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '-6px',
                    right: '-6px',
                    bottom: '-6px',
                    border: '2px dashed #f25a38',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>

            <div className={`paper-stamp ${risk >= 70 ? 'danger' : ''}`}>
              {decision || report?.decision || (risk >= 70 ? 'REJECT' : 'APPROVED')}
            </div>
          </div>
        </Panel>

        <div className="report-side">
          <Panel>
            <div className="panel-head">
              <div>
                <h2>Agent verdict</h2>
                <p>Explainable recommendation</p>
              </div>
              <ShieldAlert size={18} className={risk >= 70 ? 'orange' : ''} />
            </div>
            <div className="verdict">
              <strong>{decision || (report?.decision === 'REJECT' ? 'HIGH RISK' : report?.decision === 'REVIEW' ? 'MANUAL REVIEW' : 'LOW RISK')}</strong>
              <span>{risk} / 100</span>
            </div>
            <p className="verdict-copy">
              {report?.explanation ||
                (ringFinding
                  ? 'Document shares exact forensic template fingerprint and remit coordinates with prior submissions under distinct vendor entities.'
                  : 'Document forensic integrity verified with standard audit clearance.')}
            </p>

            <div className="agent-list" style={{ marginTop: '16px' }}>
              {report?.findings.map((f, i) => (
                <div
                  className="agent-row"
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '6px',
                    marginBottom: '6px',
                  }}
                >
                  <span
                    className={`agent-dot ${
                      f.severity === 'CLEAR' ? 'done' : f.severity === 'HIGH' ? 'danger' : 'review'
                    }`}
                    style={{ marginTop: '5px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ fontSize: '13px', color: '#e8eaed' }}>{f.agent}</b>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: f.severity === 'CLEAR' ? '#4ade80' : f.severity === 'HIGH' ? '#f25a38' : '#fbbf24',
                        }}
                      >
                        {f.severity}
                      </span>
                    </div>
                    <small style={{ display: 'block', fontSize: '11px', color: '#88919d', marginTop: '3px' }}>
                      {f.description}
                    </small>
                    {f.citedClause && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: '4px',
                          fontSize: '10px',
                          color: '#60a5fa',
                          background: 'rgba(96,165,250,0.1)',
                          padding: '1px 6px',
                          borderRadius: '3px',
                        }}
                      >
                        {f.citedClause}
                      </span>
                    )}
                    {f.matchedDocumentIds && f.matchedDocumentIds.length > 0 && (
                      <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {f.matchedDocumentIds.map((mId) => (
                          <span
                            key={mId}
                            style={{
                              fontSize: '10px',
                              color: '#f25a38',
                              background: 'rgba(242,90,56,0.12)',
                              padding: '1px 6px',
                              borderRadius: '3px',
                            }}
                          >
                            Matches: {mId}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <div className="panel-head">
              <div>
                <h2>Reviewer decision</h2>
                <p>Record your conclusion into PostgreSQL AuditLog</p>
              </div>
              <ClipboardCheck size={18} />
            </div>
            <textarea
              placeholder="Add an explanation note to the audit trail..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="decision-buttons">
              <button className="danger-btn" onClick={() => handleAction('REJECT')}>
                REJECT
              </button>
              <button className="approve-btn" onClick={() => handleAction('APPROVE')}>
                APPROVE
              </button>
            </div>
            {decision && (
              <p className="decision-confirm">
                <Check size={14} /> Case marked {decision.toLowerCase()} and logged to audit trail.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function RingDetection({ onOpenDoc }: { onOpenDoc?: (id: string) => void }) {
  const [graphData, setGraphData] = useState<RingGraphResponse | null>(null)
  const [selectedNode, setSelectedNode] = useState<RingNode | null>(null)
  const [exported, setExported] = useState(false)

  useEffect(() => {
    getRingGraph().then((data) => {
      setGraphData(data)
      if (data.nodes.length > 0) {
        setSelectedNode(data.nodes[0])
      }
    })
  }, [])

  const nodes = graphData?.nodes || [
    { id: 'acme', name: 'ACME INDUSTRIAL SUPPLY', x: 350, y: 150, type: 'node-main', risk: 86, details: { sharedAccount: '•••• 4421 · 4 matches', sharedAddress: '83 Mercer Ave · 3 matches', documentFingerprint: 'INV-0428 · 3 matches', documentCount: 18 } },
    { id: 'northstar', name: 'NORTHSTAR LOGISTICS', x: 160, y: 80, type: 'node-risk', risk: 64, details: { sharedAccount: '•••• 4421 · 2 matches', sharedAddress: '83 Mercer Ave · 1 match', documentFingerprint: 'INV-110 · 2 matches', documentCount: 42 } },
    { id: 'meridian', name: 'MERIDIAN OFFICE GROUP', x: 560, y: 76, type: 'node-risk', risk: 64, details: { sharedAccount: '•••• 8831 · 1 match', sharedAddress: '14 Commerce Way · 1 match', documentFingerprint: 'INV-71 · 1 match', documentCount: 27 } },
    { id: 'harbor', name: 'HARBOR & CO.', x: 560, y: 250, type: 'node-safe', risk: 18, details: { sharedAccount: '•••• 1092 · Verified Direct', sharedAddress: '42 Harbor View Pier 9', documentFingerprint: 'REC-501 · Unique', documentCount: 9 } },
    { id: 'account', name: 'COMMON ACCOUNT', x: 350, y: 270, type: 'node-link', risk: 54, details: { sharedAccount: '•••• 4421 · 4 connected entities', sharedAddress: 'Multiple entity remittances', documentFingerprint: 'Template cluster #0421', documentCount: 8 } },
  ]

  const activeNode = selectedNode || nodes[0]

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(graphData || nodes, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', 'vendor_ring_network.json')
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NETWORK INTELLIGENCE</span>
          <h1>Ring detection</h1>
          <p>Cross-document fingerprints, shared bank remittance coordinates, and connected vendor collusion clusters.</p>
        </div>
        <button className="outline-btn" onClick={handleExport}>
          {exported ? <Check size={15} /> : <Download size={15} />} {exported ? 'GRAPH EXPORTED' : 'EXPORT GRAPH'}
        </button>
      </div>
      <div className="ring-grid">
        <Panel className="graph-panel">
          <div className="panel-head">
            <div>
              <h2>Vendor relationship graph</h2>
              <p>
                {graphData?.totalDocuments || 1248} documents · {graphData?.vendorEntities || 18} vendor entities · {graphData?.sharedFingerprints || 6} shared fingerprints
              </p>
            </div>
            <span className="live-label">
              <i /> LIVE PGVECTOR
            </span>
          </div>
          <div className="graph">
            <svg viewBox="0 0 700 340" role="img" aria-label="Vendor relationship graph">
              {nodes.slice(1).map((n, i) => (
                <line
                  key={i}
                  x1={nodes[0]?.x || 350}
                  y1={nodes[0]?.y || 150}
                  x2={n.x}
                  y2={n.y}
                  stroke="#4a4d50"
                  strokeDasharray="4 4"
                />
              ))}
              {nodes.map((n) => (
                <g key={n.id} className="graph-node" onClick={() => setSelectedNode(n)}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={activeNode.id === n.id ? 34 : 28}
                    className={n.type}
                    style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                  />
                  <text x={n.x} y={n.y + 50} textAnchor="middle">
                    {n.name}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </Panel>

        <Panel className="node-detail">
          <span className="eyebrow">SELECTED ENTITY</span>
          <h2>{activeNode.name}</h2>
          <div className="detail-risk">
            <Risk value={activeNode.risk} />
            <span>NETWORK RISK</span>
          </div>
          <div className="detail-list">
            <div>
              <span>SHARED REMIT ACCOUNT</span>
              <b>{activeNode.details?.sharedAccount || '•••• 4421 · 4 matches'}</b>
            </div>
            <div>
              <span>REGISTERED ADDRESS</span>
              <b>{activeNode.details?.sharedAddress || '83 Mercer Ave · 3 matches'}</b>
            </div>
            <div>
              <span>TEMPLATE FINGERPRINT</span>
              <b>{activeNode.details?.documentFingerprint || 'INV-0428 · 3 matches'}</b>
            </div>
          </div>
          <button
            className="solid-btn full"
            onClick={() => {
              if (onOpenDoc && activeNode.documentId) {
                onOpenDoc(activeNode.documentId)
              } else if (onOpenDoc) {
                onOpenDoc('INV-0084')
              }
            }}
          >
            OPEN INVESTIGATION <ChevronRight size={15} />
          </button>
        </Panel>
      </div>
    </div>
  )
}

function DocumentsPage({ onUpload, onOpen }: { onUpload: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [docs, setDocs] = useState<any[]>([])

  useEffect(() => {
    listDocuments().then((res) => {
      if (res && res.length > 0) setDocs(res)
    })
  }, [])

  const displayDocs =
    docs.length > 0
      ? docs
      : [
          { id: 'DOC-2048', name: 'invoice_acme_0428.pdf', vendor: 'Acme Industrial Supply', amount: '$18,420.00', uploaded: '2 min ago', status: 'Analyzed', risk: 86, type: 'PDF' },
          { id: 'DOC-2047', name: 'receipt_harbor_may.jpg', vendor: 'Harbor & Co.', amount: '$842.90', uploaded: '18 min ago', status: 'Analyzed', risk: 18, type: 'JPG' },
        ]

  const filtered = displayDocs.filter((d) => {
    const matchQuery = (d.name + (d.vendor || '') + (d.status || '')).toLowerCase().includes(query.toLowerCase())
    const matchType = typeFilter === 'ALL' || (d.type && d.type.toUpperCase() === typeFilter)
    return matchQuery && matchType
  })

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE / DOCUMENTS</span>
          <h1>Document repository</h1>
          <p>Every source file, extracted field, and forensic status in one evidence index.</p>
        </div>
        <button className="solid-btn" onClick={onUpload}>
          <UploadCloud size={15} /> UPLOAD DOCUMENT
        </button>
      </div>
      <div className="doc-stat-grid">
        <Panel className="doc-stat">
          <Files size={17} />
          <strong>{displayDocs.length + 1240}</strong>
          <span>TOTAL FILES</span>
        </Panel>
        <Panel className="doc-stat">
          <FileCheck2 size={17} />
          <strong>{displayDocs.length + 1190}</strong>
          <span>PROCESSED</span>
        </Panel>
        <Panel className="doc-stat">
          <Clock3 size={17} />
          <strong>18</strong>
          <span>IN QUEUE</span>
        </Panel>
        <Panel className="doc-stat">
          <ShieldAlert size={17} />
          <strong>34</strong>
          <span>FLAGGED</span>
        </Panel>
      </div>
      <div className="toolbar">
        <label>
          <Search size={14} />
          <input
            aria-label="Search documents"
            placeholder="Search filename, vendor, or signal"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            const next = typeFilter === 'ALL' ? 'PDF' : typeFilter === 'PDF' ? 'JPG' : typeFilter === 'JPG' ? 'PNG' : 'ALL'
            setTypeFilter(next)
          }}
        >
          <SlidersHorizontal size={14} /> TYPE: {typeFilter}
        </button>
        <button>
          <Clock3 size={14} /> SORT: RECENT
        </button>
      </div>
      <Panel className="table-panel">
        <div className="panel-head">
          <div>
            <h2>Evidence index</h2>
            <p>{filtered.length} documents matching current view</p>
          </div>
          <span className="doc-tag">RETENTION: 7 YEARS</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>FILE</th>
                <th>TYPE</th>
                <th>VENDOR</th>
                <th>PAGES</th>
                <th>UPLOADED</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} onClick={() => onOpen(doc.id)}>
                  <td>
                    <b>{doc.name}</b>
                    <small>{doc.id} · 1.8 MB</small>
                  </td>
                  <td>{doc.type}</td>
                  <td>{doc.vendor}</td>
                  <td>1</td>
                  <td>{doc.uploaded}</td>
                  <td>
                    <span className={`status ${doc.risk > 70 ? 'status-danger' : ''}`}>
                      {doc.risk > 70 ? 'FLAGGED' : 'PROCESSED'}
                    </span>
                  </td>
                  <td>
                    <ChevronRight size={15} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function VendorsPage({ onNavigateRing }: { onNavigateRing: () => void }) {
  const [selected, setSelected] = useState<string>('Acme Industrial Supply')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [vendorsList, setVendorsList] = useState<Array<[string, number, string, string]>>([])

  useEffect(() => {
    listVendors().then((data) => {
      if (data && data.length > 0) {
        setVendorsList(data)
        setSelected(data[0][0])
      }
    })
  }, [])

  const vendors =
    vendorsList.length > 0
      ? vendorsList
      : [
          ['Acme Industrial Supply', 86, '18 documents', '$48,220'],
          ['Northstar Logistics', 64, '42 documents', '$126,400'],
          ['Meridian Office Group', 42, '27 documents', '$84,900'],
          ['Harbor & Co.', 18, '9 documents', '$12,840'],
        ]

  const filtered = vendors.filter(([_, risk]) => {
    if (riskFilter === 'HIGH') return risk >= 70
    if (riskFilter === 'MEDIUM') return risk >= 40 && risk < 70
    if (riskFilter === 'LOW') return risk < 40
    return true
  })

  const current = vendors.find((v) => v[0] === selected) || vendors[0]

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">NETWORK INTELLIGENCE / VENDORS</span>
          <h1>Vendor intelligence</h1>
          <p>Risk profiles built from transaction behavior, document fingerprints, and shared entities.</p>
        </div>
        <button className="outline-btn" onClick={onNavigateRing}>
          <Network size={15} /> OPEN RING DETECTION
        </button>
      </div>
      <div className="vendor-layout">
        <Panel className="table-panel">
          <div className="panel-head">
            <div>
              <h2>Vendor registry</h2>
              <p>{filtered.length} active vendor entities in this workspace</p>
            </div>
            <button
              className="filter-btn"
              onClick={() => {
                const next = riskFilter === 'ALL' ? 'HIGH' : riskFilter === 'HIGH' ? 'MEDIUM' : riskFilter === 'MEDIUM' ? 'LOW' : 'ALL'
                setRiskFilter(next)
              }}
            >
              RISK: {riskFilter} <ChevronRight size={13} />
            </button>
          </div>
          <div className="vendor-list">
            {filtered.map(([name, risk, docs, amount]) => (
              <button
                className={`vendor-row ${selected === name ? 'selected' : ''}`}
                key={name}
                onClick={() => setSelected(name as string)}
              >
                <span className="vendor-avatar">{String(name).slice(0, 2).toUpperCase()}</span>
                <span>
                  <b>{name}</b>
                  <small>
                    {docs} · {amount} reviewed
                  </small>
                </span>
                <Risk value={risk as number} />
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </Panel>
        <Panel className="vendor-profile">
          <span className="eyebrow">VENDOR PROFILE</span>
          <div className="profile-head">
            <div className="profile-avatar">{selected.slice(0, 2).toUpperCase()}</div>
            <div>
              <h2>{selected}</h2>
              <p>Active entity · Verified commercial baseline</p>
            </div>
          </div>
          <div className="profile-risk">
            <Risk value={current[1] as number} />
            <span>COMPOSITE RISK</span>
          </div>
          <div className="mini-bars">
            <div style={{ height: `${Math.min(100, (current[1] as number) * 0.6)}%` }} />
            <div style={{ height: `${Math.min(100, (current[1] as number) * 0.8)}%` }} />
            <div style={{ height: `${Math.min(100, (current[1] as number) * 0.7)}%` }} />
            <div style={{ height: `${Math.min(100, (current[1] as number) * 0.9)}%` }} />
            <div style={{ height: `${Math.min(100, (current[1] as number) * 0.75)}%` }} />
            <div style={{ height: `${Math.min(100, current[1] as number)}%` }} />
            <div style={{ height: `${Math.min(100, (current[1] as number) * 0.85)}%` }} />
          </div>
          <div className="detail-list">
            <div>
              <span>SHARED ENTITIES</span>
              <b>{Number(current[1]) >= 70 ? '4 connected matches (•••• 4421)' : '0 connected cross-vendor matches'}</b>
            </div>
            <div>
              <span>PAYMENT CADENCE</span>
              <b>{Number(current[1]) >= 70 ? 'Irregular · 2 anomalies' : 'Consistent standard Net30'}</b>
            </div>
            <div>
              <span>TOTAL VOLUME</span>
              <b>{current[3]} across {current[2]}</b>
            </div>
          </div>
          <button className="solid-btn full" onClick={onNavigateRing}>
            VIEW NETWORK <GitBranch size={15} />
          </button>
        </Panel>
      </div>
    </div>
  )
}

function PoliciesPage() {
  const [selected, setSelected] = useState(0)
  const [policies, setPolicies] = useState<Policy[]>([])
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [newText, setNewText] = useState('')
  const [newCategory, setNewCategory] = useState('APPROVAL_THRESHOLD')
  const [saveNote, setSaveNote] = useState(false)

  useEffect(() => {
    listPolicies().then(setPolicies)
  }, [])

  const defaultPolicies: Policy[] = [
    { name: 'P-001', description: 'Duplicate invoice detection: Flags repeated invoice fingerprints across vendors.', coverage: 'INTEGRITY CHECK', updated: 'Active', checks: 240, severity: 'HIGH', active: true },
    { name: 'P-014', description: 'Approval threshold: Requires second approval for spend over $10,000.', coverage: 'APPROVAL THRESHOLD', updated: 'Active', checks: 184, severity: 'HIGH', active: true },
    { name: 'P-021', description: 'Weekend submission: Monitors documents submitted outside business hours.', coverage: 'SUBMISSION TIMING', updated: 'Paused', checks: 45, severity: 'LOW', active: false },
    { name: 'P-033', description: 'Vendor concentration: Alerts when spend concentration exceeds 35%.', coverage: 'VENDOR GOVERNANCE', updated: 'Active', checks: 89, severity: 'MEDIUM', active: true },
  ]

  const displayPolicies = policies.length > 0 ? policies : defaultPolicies
  const current = displayPolicies[selected] || displayPolicies[0]

  const handleToggle = (idx: number) => {
    setPolicies((prev) =>
      (prev.length > 0 ? prev : defaultPolicies).map((p, i) =>
        i === idx ? { ...p, active: !p.active, updated: p.active ? 'Paused' : 'Active' } : p
      )
    )
  }

  const handleCreatePolicy = async () => {
    if (!newText.trim()) return
    try {
      await createPolicy({ text: newText, category: newCategory })
      const updated = await listPolicies()
      setPolicies(updated)
      setNewModalOpen(false)
      setNewText('')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">WORKSPACE / POLICIES</span>
          <h1>Policy controls</h1>
          <p>Rules your Policy Agent applies to every document and transaction.</p>
        </div>
        <button className="solid-btn" onClick={() => setNewModalOpen(true)}>
          <Plus size={15} /> NEW POLICY
        </button>
      </div>
      <div className="policy-layout">
        <Panel className="policy-list">
          <div className="panel-head">
            <div>
              <h2>Rules registry</h2>
              <p>{displayPolicies.length} configured controls</p>
            </div>
            <button className="filter-btn">
              ALL <ChevronRight size={13} />
            </button>
          </div>
          {displayPolicies.map((p, i) => (
            <button
              className={`policy-row ${selected === i ? 'selected' : ''}`}
              key={p.name + i}
              onClick={() => setSelected(i)}
            >
              <span className="policy-code">{p.name}</span>
              <span>
                <b>{p.coverage}</b>
                <small>{p.description.substring(0, 75)}...</small>
              </span>
              <span className={`severity severity-${(p.severity || 'MEDIUM').toLowerCase()}`}>{p.severity || 'MEDIUM'}</span>
              <span
                className={`toggle ${p.active !== false ? 'on' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggle(i)
                }}
              >
                <i />
              </span>
            </button>
          ))}
        </Panel>

        <Panel className="policy-detail">
          <div className="panel-head">
            <div>
              <span className="eyebrow">{current.name} / CONFIGURATION</span>
              <h2>{current.coverage}</h2>
            </div>
            <button className="icon-btn">
              <MoreHorizontal size={16} />
            </button>
          </div>
          <p style={{ marginTop: '12px', lineHeight: '1.5' }}>{current.description}</p>
          <div className="form-block">
            <label>POLICY STATUS</label>
            <button
              className={`status-control ${current.active !== false ? 'active' : ''}`}
              onClick={() => handleToggle(selected)}
            >
              {current.active !== false ? 'ACTIVE' : 'PAUSED'} <ChevronRight size={14} />
            </button>
          </div>
          <div className="form-block">
            <label>AGENT BEHAVIOR</label>
            <div className="rule-copy">
              When a document matches this rule, create an investigation and cite the specific clause in the reviewer
              report.
            </div>
          </div>
          <div className="form-block">
            <label>LAST UPDATED</label>
            <span className="muted-copy">Active · pgvector indexed</span>
          </div>
          <button
            className="solid-btn full"
            onClick={() => {
              setSaveNote(true)
              setTimeout(() => setSaveNote(false), 1500)
            }}
          >
            {saveNote ? <Check size={15} /> : <Check size={15} />} {saveNote ? 'POLICY SAVED & INDEXED' : 'SAVE POLICY'}
          </button>
        </Panel>
      </div>

      {newModalOpen && (
        <div className="modal-backdrop" onClick={() => setNewModalOpen(false)}>
          <div className="upload-modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">NEW COMPLIANCE RULE</span>
                <h2>Add Spending Policy</h2>
              </div>
              <button onClick={() => setNewModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em' }}>RULE CATEGORY</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                style={{ background: '#121416', color: '#fff', border: '1px solid #333', padding: '8px', borderRadius: '4px', fontSize: '12px' }}
              >
                <option value="APPROVAL_THRESHOLD">Approval Threshold</option>
                <option value="INTEGRITY_CHECK">Integrity Check / Duplicates</option>
                <option value="VENDOR_GOVERNANCE">Vendor Governance & Concentration</option>
                <option value="SOFTWARE_IT">Software & IT Procurement</option>
                <option value="TRAVEL_ENTERTAINMENT">Travel & Entertainment</option>
              </select>

              <label style={{ fontSize: '10px', color: '#888', letterSpacing: '0.1em' }}>POLICY RULE TEXT</label>
              <textarea
                placeholder="e.g. §7.1 Any hardware procurement over $2,500 requires IT asset tag pre-clearance."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                style={{ height: '90px' }}
              />

              <button className="solid-btn full" onClick={handleCreatePolicy} disabled={!newText.trim()}>
                INDEX & ACTIVATE RULE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const pathname = usePathname()
  const router = useRouter()
  const [upload, setUpload] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [view, setView] = useState<ViewKey>('overview')

  // Global ⌘K keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const routeView: ViewKey =
    pathname === '/verify'
      ? 'investigations'
      : pathname === '/audit'
      ? 'audit'
      : pathname === '/documents'
      ? 'documents'
      : pathname === '/vendors'
      ? 'vendors'
      : pathname === '/policies'
      ? 'policies'
      : pathname === '/ring-detection'
      ? 'ring-detection'
      : 'overview'

  const activeView = pathname === '/' ? view : routeView
  const goReport = (id: string) => router.push(`/report/${id}`)
  const isReport = pathname.startsWith('/report/')

  const content = isReport ? (
    <Report id={pathname.split('/').pop() || 'INV-0084'} onBack={() => router.push('/verify')} />
  ) : activeView === 'ring-detection' ? (
    <RingDetection onOpenDoc={goReport} />
  ) : activeView === 'overview' ? (
    <Overview onUpload={() => setUpload(true)} onOpen={goReport} />
  ) : activeView === 'documents' ? (
    <DocumentsPage onUpload={() => setUpload(true)} onOpen={goReport} />
  ) : activeView === 'vendors' ? (
    <VendorsPage
      onNavigateRing={() => {
        setView('ring-detection')
        router.push('/ring-detection')
      }}
    />
  ) : activeView === 'policies' ? (
    <PoliciesPage />
  ) : (
    <ListView view={activeView} onUpload={() => setUpload(true)} onOpen={goReport} />
  )

  return (
    <Shell
      view={activeView}
      setView={setView}
      onUpload={() => setUpload(true)}
      onOpenSearch={() => setSearchOpen(true)}
      onOpenNotifications={() => setNotificationsOpen(true)}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenHelp={() => setHelpOpen(true)}
    >
      {content}

      <UploadModal
        open={upload}
        onClose={() => setUpload(false)}
        onComplete={(docId) => {
          goReport(docId)
        }}
      />

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenDoc={goReport}
        onNavigate={(v) => {
          setView(v)
          router.push(routeFor(v))
        }}
      />

      <NotificationsModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onOpenDoc={goReport}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Shell>
  )
}

export default App
