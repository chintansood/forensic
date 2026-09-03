import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import documentRoutes from './routes/documents';
import policyRoutes from './routes/policy';
import vendorRoutes from './routes/vendors';
import auditRoutes from './routes/audit';
import investigationRoutes from './routes/investigations';
import { prisma } from './db/prisma';
import { getMongoDb } from './db/mongo';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Static file serving for local uploads
const publicUploads = path.resolve(__dirname, '../public/uploads');
app.use('/uploads', express.static(publicUploads));

// Health check endpoints
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Primary Spec API Routes (/api/...)
app.use('/api/documents', documentRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/audit-log', auditRoutes);
app.use('/api/investigations', investigationRoutes);
app.use('/api/analysis', investigationRoutes);

// Compatibility aliases for frontend services without /api prefix
app.use('/documents', documentRoutes);
app.use('/investigations', investigationRoutes);
app.use('/analysis', investigationRoutes);
app.use('/audit', auditRoutes);
app.use('/audit-log', auditRoutes);
app.use('/vendors', vendorRoutes);
app.use('/policies', policyRoutes);

// Direct report alias routes for frontend /reports/:documentId
app.get(['/reports/:documentId', '/api/reports/:documentId'], async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      extractedData: true,
      verdict: true,
      forensics: true,
      policyCheck: true,
      vendorHistory: true,
      ringMatches: true,
    },
  });

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const flaggedRegions: string[] = [];
  if (doc.forensics?.severity === 'HIGH') {
    flaggedRegions.push('post-issuance compression anomaly');
    flaggedRegions.push('font stroke edge inconsistency');
  }
  if (doc.ringMatches && doc.ringMatches.length > 0) {
    flaggedRegions.push('duplicate template fingerprint');
  }
  if (doc.policyCheck && !doc.policyCheck.compliant) {
    flaggedRegions.push('spend policy exception');
  }

  const risk = doc.verdict?.riskScore || 20;
  const verdict = risk >= 70 ? 'HIGH RISK' : risk >= 40 ? 'MEDIUM RISK' : 'CLEARED';

  return res.json({
    documentId: doc.id,
    flaggedRegions: flaggedRegions.length > 0 ? flaggedRegions : ['No manipulation detected'],
    verdict,
    recommendation: doc.verdict?.decision === 'APPROVE' ? 'APPROVED' : doc.verdict?.decision === 'REJECT' ? 'REJECTED' : '',
  });
});

app.post(['/reports/:documentId/review', '/api/reports/:documentId/review'], async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const { decision, note } = req.body;

  const action = decision === 'APPROVED' ? 'APPROVE' : decision === 'REJECTED' ? 'REJECT' : 'REVIEW';
  await prisma.auditLog.create({
    data: {
      documentId,
      actorId: 'reviewer_alex',
      action: `${action}${note ? `: ${note}` : ''}`,
    },
  });

  return res.json({ documentId, decision, note, recorded: true });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[App Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

async function startServer() {
  try {
    // Check MongoDB
    await getMongoDb();

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 DocForensic AI Backend Orchestrator running on port ${PORT}`);
      console.log(`📡 Endpoints: http://localhost:${PORT}/api/documents/upload`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Fatal server startup error:', error);
    process.exit(1);
  }
}

startServer();
