import { prisma } from '../../db/prisma';
import { findRingMatches } from '../../db/pgvector';

export interface RingDetectionAgentOutput {
  severity: 'HIGH' | 'REVIEW' | 'CLEAR';
  description: string;
  matchedDocumentIds: string[];
  matches: Array<{ documentId: string; similarityScore: number }>;
}

export async function runRingDetectionAgent(
  documentId: string,
  threshold: number = 0.82
): Promise<RingDetectionAgentOutput> {
  // Query pgvector for matching document fingerprints
  const matches = await findRingMatches(documentId, threshold, 5);

  // Clear any existing ring matches for this document
  await prisma.ringMatch.deleteMany({
    where: { documentId },
  });

  // Store new matches in PostgreSQL RingMatch
  if (matches.length > 0) {
    for (const m of matches) {
      await prisma.ringMatch.create({
        data: {
          documentId,
          matchedDocumentId: m.documentId,
          similarityScore: m.similarityScore,
        },
      });
    }
  }

  const matchedDocumentIds = matches.map((m) => m.documentId);
  let severity: 'HIGH' | 'REVIEW' | 'CLEAR' = 'CLEAR';
  let description = 'Cross-document fingerprint scan complete. No template or entity reuse clusters detected.';

  if (matches.length > 0) {
    severity = 'HIGH';
    description = `Forensic fingerprint matches ${matches.length} prior document${
      matches.length > 1 ? 's' : ''
    } submitted across workspace entities (similarity: ${(matches[0].similarityScore * 100).toFixed(1)}%).`;
  }

  return {
    severity,
    description,
    matchedDocumentIds,
    matches,
  };
}
