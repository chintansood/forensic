import { prisma } from '../../db/prisma';
import { searchPolicyClauses } from '../../db/pgvector';
import { getEmbedding, evaluatePolicyComplianceWithClaude } from '../../services/ai';
import { ExtractionResult } from './extractionAgent';

export interface PolicyAgentOutput {
  compliant: boolean;
  citedClauseId: string | null;
  citedClauseText?: string;
  explanation: string;
  severity: 'HIGH' | 'REVIEW' | 'CLEAR';
}

export async function runPolicyAgent(
  documentId: string,
  extracted: ExtractionResult
): Promise<PolicyAgentOutput> {
  // 1. Embed query from extracted fields
  const queryText = `Vendor: ${extracted.vendorName}. Amount: $${extracted.amount}. Items: ${extracted.lineItems
    .map((i) => i.description)
    .join(', ')}`;
  const queryEmbedding = await getEmbedding(queryText);

  // 2. Vector search pgvector PolicyClause table
  const retrievedClauses = await searchPolicyClauses(queryEmbedding, 3);

  // 3. Evaluate with Claude (anti-hallucination enforced)
  const evalResult = await evaluatePolicyComplianceWithClaude(extracted, retrievedClauses);

  let citedClauseText: string | undefined = undefined;
  if (evalResult.citedClauseId) {
    const clause = retrievedClauses.find((c) => c.id === evalResult.citedClauseId);
    if (clause) citedClauseText = clause.text;
  }

  // 4. Save to PostgreSQL PolicyCheck
  await prisma.policyCheck.upsert({
    where: { documentId },
    create: {
      documentId,
      compliant: evalResult.compliant,
      citedClauseId: evalResult.citedClauseId,
      explanation: evalResult.explanation,
      severity: evalResult.severity,
    },
    update: {
      compliant: evalResult.compliant,
      citedClauseId: evalResult.citedClauseId,
      explanation: evalResult.explanation,
      severity: evalResult.severity,
    },
  });

  return {
    compliant: evalResult.compliant,
    citedClauseId: evalResult.citedClauseId,
    citedClauseText,
    explanation: evalResult.explanation,
    severity: evalResult.severity,
  };
}
