import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import { prisma } from '../../db/prisma';
import { updateForensicsFingerprint } from '../../db/pgvector';
import { ExtractionResult } from './extractionAgent';

export interface ForensicsAgentOutput {
  elaScore: number;
  metadataFlags: string[];
  fontConsistencyScore: number;
  suspiciousRegions: Array<{ x: number; y: number; width: number; height: number }>;
  severity: 'HIGH' | 'REVIEW' | 'CLEAR';
  description: string;
  fingerprintEmbedding: number[];
}

export async function runForensicsAgent(
  documentId: string,
  localFilePath: string,
  _extracted: ExtractionResult
): Promise<ForensicsAgentOutput> {
  const serviceUrl = process.env.FORENSICS_SERVICE_URL || 'http://localhost:8000';

  const formData = new FormData();
  formData.append('file', fs.createReadStream(localFilePath));

  const response = await axios.post(`${serviceUrl}/forensics/analyze`, formData, {
    headers: formData.getHeaders(),
    timeout: 14000,
  });

  const data = response.data;
  const severity: 'HIGH' | 'REVIEW' | 'CLEAR' = data.severity || 'CLEAR';

  // Save to PostgreSQL ForensicsResult
  await prisma.forensicsResult.upsert({
    where: { documentId },
    create: {
      documentId,
      elaScore: data.elaScore || 0,
      metadataFlags: data.metadataFlags || [],
      fontConsistencyScore: data.fontConsistencyScore || 1.0,
      suspiciousRegionsJson: data.suspiciousRegions || [],
      severity,
    },
    update: {
      elaScore: data.elaScore || 0,
      metadataFlags: data.metadataFlags || [],
      fontConsistencyScore: data.fontConsistencyScore || 1.0,
      suspiciousRegionsJson: data.suspiciousRegions || [],
      severity,
    },
  });

  // Save pgvector embedding
  if (data.fingerprintEmbedding && Array.isArray(data.fingerprintEmbedding)) {
    await updateForensicsFingerprint(documentId, data.fingerprintEmbedding);
  }

  let description = 'Document forensic integrity verified. No compression artifacts or manipulation detected.';
  if (severity === 'HIGH') {
    description =
      'Document shows evidence of post-issuance editing around key fields — compression mismatch and font inconsistency detected in the flagged region.';
  } else if (severity === 'REVIEW') {
    description =
      'Minor compression variance or metadata flags detected. Document integrity warrants secondary inspection.';
  }

  return {
    elaScore: data.elaScore || 0,
    metadataFlags: data.metadataFlags || [],
    fontConsistencyScore: data.fontConsistencyScore || 1.0,
    suspiciousRegions: data.suspiciousRegions || [],
    severity,
    description,
    fingerprintEmbedding: data.fingerprintEmbedding || [],
  };
}
