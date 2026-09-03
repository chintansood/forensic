import { createWorker } from 'tesseract.js';
import fs from 'fs';
import pdf from 'pdf-parse';
import { prisma } from '../../db/prisma';
import { saveRawUpload } from '../../db/mongo';
import { parseInvoiceWithClaude, ExtractedFields } from '../../services/ai';

export interface ExtractionResult {
  extractedDataId: string;
  vendorName: string;
  invoiceNumber: string | null;
  amount: number;
  date: Date;
  lineItems: Array<{ description: string; amount: number }>;
  subtotal: number;
  tax: number;
  total: number;
  ocrConfidence: number;
  rawText: string;
}

export async function runExtractionAgent(
  documentId: string,
  localFilePath: string
): Promise<ExtractionResult> {
  let rawText = '';
  let ocrConfidence = 0.95;

  const isPdf = localFilePath.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    try {
      const dataBuffer = fs.readFileSync(localFilePath);
      const parsed = await pdf(dataBuffer);
      rawText = parsed.text || '';
    } catch (e) {
      console.warn('[ExtractionAgent] pdf-parse failed, falling back to tesseract OCR:', e);
    }
  }

  if (!rawText || rawText.trim().length < 20) {
    // Run Tesseract.js OCR
    const worker = await createWorker('eng');
    const ret = await worker.recognize(localFilePath);
    rawText = ret.data.text;
    ocrConfidence = (ret.data.confidence || 90) / 100.0;
    await worker.terminate();
  }

  // Save to MongoDB rawUploads
  await saveRawUpload({
    documentId,
    ocrRawText: rawText,
    uploadedAt: new Date(),
  });

  // Extract structured fields via Claude / fallback
  const parsedFields: ExtractedFields = await parseInvoiceWithClaude(rawText);

  // Store in PostgreSQL ExtractedData
  const parsedDate = new Date(parsedFields.date);
  const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  const record = await prisma.extractedData.upsert({
    where: { documentId },
    create: {
      documentId,
      vendorName: parsedFields.vendor,
      invoiceNumber: parsedFields.invoiceNumber,
      amount: parsedFields.total || parsedFields.subtotal || 0,
      date: validDate,
      lineItemsJson: parsedFields.lineItems,
      ocrConfidence: Math.min(1.0, Math.max(0.1, ocrConfidence)),
    },
    update: {
      vendorName: parsedFields.vendor,
      invoiceNumber: parsedFields.invoiceNumber,
      amount: parsedFields.total || parsedFields.subtotal || 0,
      date: validDate,
      lineItemsJson: parsedFields.lineItems,
      ocrConfidence: Math.min(1.0, Math.max(0.1, ocrConfidence)),
    },
  });

  return {
    extractedDataId: record.id,
    vendorName: parsedFields.vendor,
    invoiceNumber: parsedFields.invoiceNumber,
    amount: parsedFields.total || parsedFields.subtotal || 0,
    date: validDate,
    lineItems: parsedFields.lineItems,
    subtotal: parsedFields.subtotal,
    tax: parsedFields.tax,
    total: parsedFields.total,
    ocrConfidence: record.ocrConfidence,
    rawText,
  };
}
