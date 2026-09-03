import { prisma } from '../db/prisma';
import { saveAgentTrace } from '../db/mongo';
import { sseManager } from '../services/sse';
import { runExtractionAgent, ExtractionResult } from './agents/extractionAgent';
import { runForensicsAgent, ForensicsAgentOutput } from './agents/forensicsAgent';
import { runPolicyAgent, PolicyAgentOutput } from './agents/policyAgent';
import { runVendorHistoryAgent, VendorHistoryAgentOutput } from './agents/vendorHistoryAgent';
import { runRingDetectionAgent, RingDetectionAgentOutput } from './agents/ringDetectionAgent';
import { runVerdictAgent, VerdictAgentOutput } from './agents/verdictAgent';

export type AgentName =
  | 'Extraction'
  | 'Forensics'
  | 'Policy Compliance'
  | 'Vendor History'
  | 'Ring-Detection'
  | 'Verdict';

export type AgentStatusValue = 'QUEUED' | 'RUNNING' | 'CLEAR' | 'FLAGGED' | 'REVIEW';
export type PipelineStatusValue = 'RUNNING' | 'COMPLETE' | 'FAILED';

export interface AgentStatusItem {
  name: AgentName;
  status: AgentStatusValue;
  detail: string | null;
}

export interface PipelineState {
  documentId: string;
  pipelineStatus: PipelineStatusValue;
  agents: AgentStatusItem[];
  updatedAt: Date;
}

// In-memory status store for rapid polling & SSE broadcasting
const pipelineStates: Map<string, PipelineState> = new Map();

export function getInitialPipelineState(documentId: string): PipelineState {
  return {
    documentId,
    pipelineStatus: 'RUNNING',
    agents: [
      { name: 'Extraction', status: 'QUEUED', detail: null },
      { name: 'Forensics', status: 'QUEUED', detail: null },
      { name: 'Policy Compliance', status: 'QUEUED', detail: null },
      { name: 'Vendor History', status: 'QUEUED', detail: null },
      { name: 'Ring-Detection', status: 'QUEUED', detail: null },
      { name: 'Verdict', status: 'QUEUED', detail: null },
    ],
    updatedAt: new Date(),
  };
}

export function getPipelineState(documentId: string): PipelineState {
  let state = pipelineStates.get(documentId);
  if (!state) {
    state = getInitialPipelineState(documentId);
    pipelineStates.set(documentId, state);
  }
  return state;
}

export function updateAgentStatus(
  documentId: string,
  agentName: AgentName,
  status: AgentStatusValue,
  detail: string | null = null
) {
  const state = getPipelineState(documentId);
  const agent = state.agents.find((a) => a.name === agentName);
  if (agent) {
    agent.status = status;
    agent.detail = detail;
  }
  state.updatedAt = new Date();
  sseManager.broadcast(documentId, state);
}

export function setPipelineStatus(documentId: string, status: PipelineStatusValue) {
  const state = getPipelineState(documentId);
  state.pipelineStatus = status;
  state.updatedAt = new Date();
  sseManager.broadcast(documentId, state);
}

/**
 * Timeout wrapper utility (15s timeout per agent)
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 15000, name: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent [${name}] timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Runs the 6-agent forensic pipeline asynchronously
 */
export async function runPipeline(documentId: string, localFilePath: string): Promise<void> {
  console.log(`[Orchestrator] Starting 6-agent pipeline for document: ${documentId}`);
  const state = getInitialPipelineState(documentId);
  pipelineStates.set(documentId, state);

  // Update DB status
  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'RUNNING' },
  });

  let extractedResult: ExtractionResult | null = null;
  let forensicsResult: ForensicsAgentOutput | null = null;
  let policyResult: PolicyAgentOutput | null = null;
  let vendorResult: VendorHistoryAgentOutput | null = null;
  let ringResult: RingDetectionAgentOutput | null = null;
  let verdictResult: VerdictAgentOutput | null = null;

  try {
    // ----------------------------------------------------
    // 1. Extraction Agent (BLOCKING)
    // ----------------------------------------------------
    updateAgentStatus(documentId, 'Extraction', 'RUNNING');
    const extractStart = new Date();
    try {
      extractedResult = await withTimeout(
        runExtractionAgent(documentId, localFilePath),
        15000,
        'Extraction'
      );
      const extStatus: AgentStatusValue =
        extractedResult.ocrConfidence >= 0.7 ? 'CLEAR' : 'REVIEW';
      const detail = `${(extractedResult.ocrConfidence * 100).toFixed(1)}% OCR confidence · ${
        extractedResult.lineItems.length
      } line items`;
      updateAgentStatus(documentId, 'Extraction', extStatus, detail);

      await saveAgentTrace({
        documentId,
        agentName: 'Extraction',
        startedAt: extractStart,
        completedAt: new Date(),
        rawOutput: extractedResult,
      });
    } catch (err: any) {
      console.error('[Orchestrator] Extraction Agent failed:', err);
      updateAgentStatus(documentId, 'Extraction', 'REVIEW', 'Check incomplete — see audit log');
      await prisma.auditLog.create({
        data: {
          documentId,
          actorId: 'system',
          action: 'AGENT_ERROR',
        },
      });
      // Minimal fallback extracted structure
      extractedResult = {
        extractedDataId: 'fallback',
        vendorName: 'Unknown Vendor',
        invoiceNumber: null,
        amount: 0,
        date: new Date(),
        lineItems: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        ocrConfidence: 0.3,
        rawText: '',
      };
    }

    // ----------------------------------------------------
    // 2, 3, 4. Forensics, Policy Compliance, Vendor History (PARALLEL)
    // ----------------------------------------------------
    updateAgentStatus(documentId, 'Forensics', 'RUNNING');
    updateAgentStatus(documentId, 'Policy Compliance', 'RUNNING');
    updateAgentStatus(documentId, 'Vendor History', 'RUNNING');

    // Run in parallel and update status independently as each resolves
    const forensicsPromise = (async () => {
      const start = new Date();
      try {
        forensicsResult = await withTimeout(
          runForensicsAgent(documentId, localFilePath, extractedResult!),
          15000,
          'Forensics'
        );
        const status: AgentStatusValue =
          forensicsResult.severity === 'HIGH'
            ? 'FLAGGED'
            : forensicsResult.severity === 'REVIEW'
            ? 'REVIEW'
            : 'CLEAR';
        const detail =
          forensicsResult.severity === 'HIGH'
            ? `${forensicsResult.suspiciousRegions.length} anomalies flagged in ELA`
            : forensicsResult.metadataFlags.length > 0
            ? 'Metadata editor flag detected'
            : 'Integrity verified (0 anomalies)';
        updateAgentStatus(documentId, 'Forensics', status, detail);

        await saveAgentTrace({
          documentId,
          agentName: 'Forensics',
          startedAt: start,
          completedAt: new Date(),
          rawOutput: forensicsResult,
        });
      } catch (err: any) {
        console.error('[Orchestrator] Forensics Agent failed:', err);
        updateAgentStatus(documentId, 'Forensics', 'REVIEW', 'Check incomplete — see audit log');
        await prisma.auditLog.create({
          data: { documentId, actorId: 'system', action: 'AGENT_ERROR' },
        });
      }
    })();

    const policyPromise = (async () => {
      const start = new Date();
      try {
        policyResult = await withTimeout(
          runPolicyAgent(documentId, extractedResult!),
          15000,
          'Policy Compliance'
        );
        const status: AgentStatusValue =
          policyResult.severity === 'HIGH'
            ? 'FLAGGED'
            : policyResult.severity === 'REVIEW'
            ? 'REVIEW'
            : 'CLEAR';
        const detail = policyResult.compliant
          ? 'Complies with all spend policies'
          : `Policy exception: ${policyResult.citedClauseText || 'Threshold exception'}`;
        updateAgentStatus(documentId, 'Policy Compliance', status, detail);

        await saveAgentTrace({
          documentId,
          agentName: 'Policy Compliance',
          startedAt: start,
          completedAt: new Date(),
          rawOutput: policyResult,
        });
      } catch (err: any) {
        console.error('[Orchestrator] Policy Compliance Agent failed:', err);
        updateAgentStatus(
          documentId,
          'Policy Compliance',
          'REVIEW',
          'Check incomplete — see audit log'
        );
        await prisma.auditLog.create({
          data: { documentId, actorId: 'system', action: 'AGENT_ERROR' },
        });
      }
    })();

    const vendorPromise = (async () => {
      const start = new Date();
      try {
        vendorResult = await withTimeout(
          runVendorHistoryAgent(documentId, extractedResult!),
          15000,
          'Vendor History'
        );
        const status: AgentStatusValue =
          vendorResult.severity === 'HIGH'
            ? 'FLAGGED'
            : vendorResult.severity === 'REVIEW'
            ? 'REVIEW'
            : 'CLEAR';
        const detail =
          vendorResult.priorCount > 0
            ? `${vendorResult.priorCount} prior invoices on record`
            : 'New vendor (no baseline)';
        updateAgentStatus(documentId, 'Vendor History', status, detail);

        await saveAgentTrace({
          documentId,
          agentName: 'Vendor History',
          startedAt: start,
          completedAt: new Date(),
          rawOutput: vendorResult,
        });
      } catch (err: any) {
        console.error('[Orchestrator] Vendor History Agent failed:', err);
        updateAgentStatus(
          documentId,
          'Vendor History',
          'REVIEW',
          'Check incomplete — see audit log'
        );
        await prisma.auditLog.create({
          data: { documentId, actorId: 'system', action: 'AGENT_ERROR' },
        });
      }
    })();

    await Promise.all([forensicsPromise, policyPromise, vendorPromise]);

    // ----------------------------------------------------
    // 5. Ring-Detection Agent (SEQUENTIAL AFTER PARALLEL BATCH)
    // ----------------------------------------------------
    updateAgentStatus(documentId, 'Ring-Detection', 'RUNNING');
    const ringStart = new Date();
    try {
      ringResult = await withTimeout(
        runRingDetectionAgent(documentId, 0.82),
        15000,
        'Ring-Detection'
      );
      const status: AgentStatusValue =
        ringResult.severity === 'HIGH'
          ? 'FLAGGED'
          : ringResult.severity === 'REVIEW'
          ? 'REVIEW'
          : 'CLEAR';
      const detail =
        ringResult.matchedDocumentIds.length > 0
          ? `Matched ${ringResult.matchedDocumentIds.length} cross-vendor documents`
          : 'No cross-document fingerprint matches';
      updateAgentStatus(documentId, 'Ring-Detection', status, detail);

      await saveAgentTrace({
        documentId,
        agentName: 'Ring-Detection',
        startedAt: ringStart,
        completedAt: new Date(),
        rawOutput: ringResult,
      });
    } catch (err: any) {
      console.error('[Orchestrator] Ring Detection Agent failed:', err);
      updateAgentStatus(
        documentId,
        'Ring-Detection',
        'REVIEW',
        'Check incomplete — see audit log'
      );
      await prisma.auditLog.create({
        data: { documentId, actorId: 'system', action: 'AGENT_ERROR' },
      });
    }

    // ----------------------------------------------------
    // 6. Verdict Agent (FINAL BLOCKING STAGE)
    // ----------------------------------------------------
    updateAgentStatus(documentId, 'Verdict', 'RUNNING');
    const verdictStart = new Date();
    try {
      verdictResult = await withTimeout(
        runVerdictAgent({
          documentId,
          extracted: extractedResult!,
          forensics: forensicsResult,
          policy: policyResult,
          vendorHistory: vendorResult,
          ringDetection: ringResult,
        }),
        15000,
        'Verdict'
      );

      const verdictStatus: AgentStatusValue =
        verdictResult.decision === 'REJECT'
          ? 'FLAGGED'
          : verdictResult.decision === 'REVIEW'
          ? 'REVIEW'
          : 'CLEAR';
      const detail = `Risk score: ${verdictResult.riskScore}/100 · ${verdictResult.decision}`;
      updateAgentStatus(documentId, 'Verdict', verdictStatus, detail);

      await saveAgentTrace({
        documentId,
        agentName: 'Verdict',
        startedAt: verdictStart,
        completedAt: new Date(),
        rawOutput: verdictResult,
      });
    } catch (err: any) {
      console.error('[Orchestrator] Verdict Agent failed:', err);
      updateAgentStatus(documentId, 'Verdict', 'REVIEW', 'Check incomplete — see audit log');
      await prisma.auditLog.create({
        data: { documentId, actorId: 'system', action: 'AGENT_ERROR' },
      });
    }

    // Mark document and pipeline as COMPLETE
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'COMPLETE' },
    });
    setPipelineStatus(documentId, 'COMPLETE');
    console.log(`[Orchestrator] Pipeline completed successfully for document: ${documentId}`);
  } catch (globalErr: any) {
    console.error(`[Orchestrator] Pipeline failed fatally for document ${documentId}:`, globalErr);
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED' },
    });
    setPipelineStatus(documentId, 'FAILED');
  }
}
