import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';

const router = Router();

/**
 * GET /api/audit
 */
router.get('/', async (_req: Request, res: Response) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 50,
    include: {
      document: {
        include: {
          extractedData: true,
          verdict: true,
        },
      },
    },
  });

  const formatted = logs.map((l) => {
    let kind = 'analysis';
    let title = 'Document analysis completed';
    if (l.action === 'APPROVE') {
      kind = 'approval';
      title = 'Investigation approved';
    } else if (l.action === 'REJECT') {
      kind = 'rejection';
      title = 'Investigation rejected';
    } else if (l.action === 'AGENT_ERROR') {
      kind = 'alert';
      title = 'Pipeline error recorded';
    } else if (l.action === 'ESCALATE') {
      kind = 'alert';
      title = 'Case escalated to senior reviewer';
    }

    const docName = l.document?.fileName || l.documentId;
    const vendor = l.document?.extractedData?.vendorName || '';

    return {
      title,
      detail: `${l.documentId} · ${docName} ${vendor ? `(${vendor})` : ''}`,
      time: formatRelative(l.timestamp),
      kind,
    };
  });

  // If no logs, provide starter activity
  if (formatted.length === 0) {
    return res.status(200).json([
      {
        title: 'System initialized',
        detail: 'DocForensic AI 6-agent engine online',
        time: 'Just now',
        kind: 'analysis',
      },
    ]);
  }

  return res.status(200).json(formatted);
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
