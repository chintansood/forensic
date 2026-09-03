import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { uploadFile } from '../services/storage';
import { runPipeline } from '../pipeline/orchestrator';
import { documentFilePaths } from './documents';

const router = Router();
const upload = multer({ dest: 'temp_uploads/' });

/**
 * GET /api/investigations
 */
router.get('/', async (_req: Request, res: Response) => {
  const docs = await prisma.document.findMany({
    orderBy: { uploadedAt: 'desc' },
    include: {
      extractedData: true,
      verdict: true,
      forensics: true,
      ringMatches: true,
    },
  });

  const investigations = docs.map((d) => {
    let flag = 'No significant signals';
    if (d.ringMatches && d.ringMatches.length > 0) {
      flag = 'Duplicate invoice template fingerprint';
    } else if (d.forensics && d.forensics.severity === 'HIGH') {
      flag = 'Post-issuance pixel manipulation';
    } else if (d.verdict?.riskScore && d.verdict.riskScore >= 70) {
      flag = 'High composite risk score';
    } else if (d.verdict?.riskScore && d.verdict.riskScore >= 40) {
      flag = 'Policy threshold exception';
    }

    const risk = d.verdict?.riskScore || (d.status === 'COMPLETE' ? 20 : 50);
    const status =
      d.status === 'RUNNING'
        ? 'IN PROGRESS'
        : risk >= 70
        ? 'NEEDS REVIEW'
        : risk >= 40
        ? 'MONITOR'
        : 'CLEARED';

    return {
      id: d.id,
      document: d.fileName,
      vendor: d.extractedData?.vendorName || 'Unknown Vendor',
      amount: `$${(d.extractedData?.amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
      })}`,
      risk,
      flag,
      status,
      date: formatRelative(d.uploadedAt),
    };
  });

  return res.status(200).json(investigations);
});

/**
 * POST /api/analysis
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const file = req.file;
    const sizeMB = parseFloat((file.size / (1024 * 1024)).toFixed(2));
    const shortId = `doc_${crypto.randomBytes(4).toString('hex')}`;

    const uploadRes = await uploadFile(file.path, `${shortId}_${file.originalname}`);

    const doc = await prisma.document.create({
      data: {
        id: shortId,
        fileName: file.originalname,
        fileSizeMB: sizeMB,
        cloudinaryUrl: uploadRes.url,
        status: 'RUNNING',
      },
    });

    documentFilePaths.set(shortId, file.path);

    setImmediate(() => {
      runPipeline(shortId, file.path).catch((err) => {
        console.error(`[Analysis] Pipeline error for ${shortId}:`, err);
      });
    });

    return res.status(201).json({
      id: doc.id,
      name: doc.fileName,
      status: 'processing',
      documentId: doc.id,
      cloudinaryUrl: doc.cloudinaryUrl,
    });
  } catch (error: any) {
    console.error('[Analysis] Error starting analysis:', error);
    return res.status(500).json({ error: 'Failed to start analysis' });
  }
});

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export default router;
