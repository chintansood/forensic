import { prisma } from '../../db/prisma';
import { synthesizeVerdictWithClaude, ExtractedFields } from '../../services/ai';
import { ForensicsAgentOutput } from './forensicsAgent';
import { PolicyAgentOutput } from './policyAgent';
import { VendorHistoryAgentOutput } from './vendorHistoryAgent';
import { RingDetectionAgentOutput } from './ringDetectionAgent';
import { ExtractionResult } from './extractionAgent';

export interface Finding {
  agent: string;
  severity: 'HIGH' | 'REVIEW' | 'CLEAR';
  title: string;
  description: string;
  flaggedRegion?: { x: number; y: number; width: number; height: number };
  citedClause?: string;
  matchedDocumentIds?: string[];
}

export interface VerdictAgentOutput {
  riskScore: number;
  decision: 'APPROVE' | 'REVIEW' | 'REJECT';
  explanation: string;
  findings: Finding[];
}

export async function runVerdictAgent(params: {
  documentId: string;
  extracted: ExtractionResult;
  forensics?: ForensicsAgentOutput | null;
  policy?: PolicyAgentOutput | null;
  vendorHistory?: VendorHistoryAgentOutput | null;
  ringDetection?: RingDetectionAgentOutput | null;
}): Promise<VerdictAgentOutput> {
  const { documentId, extracted, forensics, policy, vendorHistory, ringDetection } = params;

  // 1. Calculate weighted component scores (0 - 100 each)
  // Forensics: 35%
  let forensicsRisk = 0;
  if (!forensics) {
    forensicsRisk = 45; // incomplete penalty
  } else if (forensics.severity === 'HIGH') {
    forensicsRisk = 90;
  } else if (forensics.severity === 'REVIEW') {
    forensicsRisk = 50;
  } else {
    forensicsRisk = 10;
  }

  // Ring Detection: 30%
  let ringRisk = 0;
  if (!ringDetection) {
    ringRisk = 40;
  } else if (ringDetection.severity === 'HIGH') {
    ringRisk = 95;
  } else if (ringDetection.severity === 'REVIEW') {
    ringRisk = 60;
  } else {
    ringRisk = 5;
  }

  // Policy Compliance: 20%
  let policyRisk = 0;
  if (!policy) {
    policyRisk = 30;
  } else if (policy.severity === 'HIGH') {
    policyRisk = 85;
  } else if (policy.severity === 'REVIEW') {
    policyRisk = 55;
  } else {
    policyRisk = 5;
  }

  // Vendor History: 15%
  let vendorRisk = 0;
  if (!vendorHistory) {
    vendorRisk = 30;
  } else if (vendorHistory.severity === 'HIGH') {
    vendorRisk = 80;
  } else if (vendorHistory.severity === 'REVIEW') {
    vendorRisk = 50;
  } else {
    vendorRisk = 10;
  }

  // Composite Score
  const rawScore =
    forensicsRisk * 0.35 + ringRisk * 0.3 + policyRisk * 0.2 + vendorRisk * 0.15;
  let riskScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  // If Ring-Detection or Forensics detects high severity manipulation / cluster, ensure elevated risk
  if (ringDetection?.severity === 'HIGH' && forensics?.severity === 'HIGH') {
    riskScore = Math.max(riskScore, 92);
  } else if (ringDetection?.severity === 'HIGH') {
    riskScore = Math.max(riskScore, 85);
  } else if (forensics?.severity === 'HIGH') {
    riskScore = Math.max(riskScore, 82);
  }

  // Decision Thresholds
  let decision: 'APPROVE' | 'REVIEW' | 'REJECT' = 'APPROVE';
  if (riskScore >= 75) {
    decision = 'REJECT';
  } else if (riskScore >= 40) {
    decision = 'REVIEW';
  } else {
    decision = 'APPROVE';
  }

  // 2. Assemble structured findings
  const findings: Finding[] = [];

  // Forensics finding
  if (forensics) {
    const firstRegion = forensics.suspiciousRegions[0];
    findings.push({
      agent: 'Forensics',
      severity: forensics.severity,
      title: 'Forensics',
      description: forensics.description,
      ...(firstRegion ? { flaggedRegion: firstRegion } : {}),
    });
  } else {
    findings.push({
      agent: 'Forensics',
      severity: 'REVIEW',
      title: 'Forensics',
      description: 'Forensics integrity check incomplete — see audit log.',
    });
  }

  // Policy finding
  if (policy) {
    findings.push({
      agent: 'Policy Compliance',
      severity: policy.severity,
      title: 'Policy Compliance',
      description: policy.explanation,
      ...(policy.citedClauseText ? { citedClause: policy.citedClauseText } : {}),
    });
  } else {
    findings.push({
      agent: 'Policy Compliance',
      severity: 'REVIEW',
      title: 'Policy Compliance',
      description: 'Policy compliance check incomplete — see audit log.',
    });
  }

  // Vendor History finding
  if (vendorHistory) {
    findings.push({
      agent: 'Vendor History',
      severity: vendorHistory.severity,
      title: 'Vendor History',
      description: vendorHistory.explanation,
    });
  } else {
    findings.push({
      agent: 'Vendor History',
      severity: 'REVIEW',
      title: 'Vendor History',
      description: 'Vendor history check incomplete — see audit log.',
    });
  }

  // Ring Detection finding
  if (ringDetection) {
    findings.push({
      agent: 'Ring-Detection',
      severity: ringDetection.severity,
      title: 'Ring-Detection',
      description: ringDetection.description,
      ...(ringDetection.matchedDocumentIds.length > 0
        ? { matchedDocumentIds: ringDetection.matchedDocumentIds }
        : {}),
    });
  } else {
    findings.push({
      agent: 'Ring-Detection',
      severity: 'REVIEW',
      title: 'Ring-Detection',
      description: 'Ring-detection check incomplete — see audit log.',
    });
  }

  // 3. Synthesize explainable verdict with Claude
  const extractedSummary: ExtractedFields = {
    vendor: extracted.vendorName,
    invoiceNumber: extracted.invoiceNumber,
    date: extracted.date.toISOString().split('T')[0],
    lineItems: extracted.lineItems,
    subtotal: extracted.subtotal,
    tax: extracted.tax,
    total: extracted.total,
  };

  const explanation = await synthesizeVerdictWithClaude({
    riskScore,
    decision,
    extracted: extractedSummary,
    findings,
  });

  // 4. Save to PostgreSQL Verdict table
  await prisma.verdict.upsert({
    where: { documentId },
    create: {
      documentId,
      riskScore,
      decision,
      explanation,
    },
    update: {
      riskScore,
      decision,
      explanation,
    },
  });

  return {
    riskScore,
    decision,
    explanation,
    findings,
  };
}
