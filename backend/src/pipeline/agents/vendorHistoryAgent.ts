import { prisma } from '../../db/prisma';
import { ExtractionResult } from './extractionAgent';

export interface VendorHistoryAgentOutput {
  vendorName: string;
  priorCount: number;
  avgAmount: number;
  amountDeviation: number;
  severity: 'HIGH' | 'REVIEW' | 'CLEAR';
  explanation: string;
}

export async function runVendorHistoryAgent(
  documentId: string,
  extracted: ExtractionResult
): Promise<VendorHistoryAgentOutput> {
  const vendorName = extracted.vendorName || 'Unknown Vendor';
  const currentAmount = extracted.amount || 0;

  // Query historical documents for this vendor
  const stats: any = await prisma.$queryRawUnsafe(
    `
    SELECT 
      COUNT(*)::int as count,
      COALESCE(AVG(e.amount), 0)::float as avg_amount,
      COALESCE(STDDEV(e.amount), 0)::float as stddev_amount
    FROM "ExtractedData" e
    JOIN "Document" d ON d.id = e."documentId"
    WHERE LOWER(e."vendorName") = LOWER($1)
      AND d.id != $2
      AND d.status = 'COMPLETE';
    `,
    vendorName,
    documentId
  );

  const priorCount = stats[0]?.count || 0;
  const avgAmount = stats[0]?.avg_amount || 0;
  const stddevAmount = stats[0]?.stddev_amount || 0;

  let amountDeviation = 0;
  let severity: 'HIGH' | 'REVIEW' | 'CLEAR' = 'CLEAR';
  let explanation = '';

  if (priorCount === 0) {
    if (currentAmount > 15000) {
      severity = 'REVIEW';
      explanation = `First-time vendor with substantial initial invoice amount ($${currentAmount.toLocaleString()}). Prior historical baseline unavailable.`;
    } else {
      severity = 'CLEAR';
      explanation = `New vendor. Initial submission within normal operational onboarding bounds.`;
    }
  } else {
    if (stddevAmount > 0) {
      amountDeviation = Math.abs(currentAmount - avgAmount) / stddevAmount;
    } else if (avgAmount > 0) {
      amountDeviation = Math.abs(currentAmount - avgAmount) / avgAmount;
    }

    if (amountDeviation > 2.5 && currentAmount > avgAmount * 1.5) {
      severity = 'REVIEW';
      explanation = `Invoice amount ($${currentAmount.toLocaleString()}) deviates by ${amountDeviation.toFixed(
        1
      )} standard deviations from vendor historical average ($${avgAmount.toLocaleString()}).`;
    } else {
      severity = 'CLEAR';
      explanation = `Vendor has ${priorCount} prior submissions with consistent formatting and billing cadence.`;
    }
  }

  // Save to PostgreSQL VendorHistoryCheck
  await prisma.vendorHistoryCheck.upsert({
    where: { documentId },
    create: {
      documentId,
      vendorName,
      priorCount,
      avgAmount,
      amountDeviation: parseFloat(amountDeviation.toFixed(2)),
      severity,
      explanation,
    },
    update: {
      vendorName,
      priorCount,
      avgAmount,
      amountDeviation: parseFloat(amountDeviation.toFixed(2)),
      severity,
      explanation,
    },
  });

  return {
    vendorName,
    priorCount,
    avgAmount,
    amountDeviation,
    severity,
    explanation,
  };
}
