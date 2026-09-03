import { prisma } from './prisma';
import { insertPolicyClause } from './pgvector';
import { getEmbedding } from '../services/ai';

const samplePolicies = [
  {
    id: 'clause_auto_approval',
    category: 'APPROVAL_THRESHOLD',
    text: '§4.2 Auto-approval threshold: Single invoice amounts exceeding $10,000.00 require secondary managerial authorization prior to disbursement.',
  },
  {
    id: 'clause_duplicate_prevention',
    category: 'INTEGRITY_CHECK',
    text: '§2.1 Duplicate Submission Control: Invoices bearing identical reference codes or line-item hashes to prior paid vouchers within 180 days are strictly prohibited.',
  },
  {
    id: 'clause_weekend_sub',
    category: 'SUBMISSION_TIMING',
    text: '§5.4 Submission Hours: Procurement filings submitted during non-operational weekend hours are subject to automated compliance hold.',
  },
  {
    id: 'clause_vendor_concentration',
    category: 'VENDOR_GOVERNANCE',
    text: '§8.1 Vendor Concentration Limit: Single vendor quarterly volume must not exceed 35% of departmental budget without procurement committee review.',
  },
  {
    id: 'clause_software_licensing',
    category: 'SOFTWARE_IT',
    text: '§6.3 IT & SaaS Procurements: Recurring software licensing subscriptions exceeding $5,000.00 annually require mandatory verification by Cybersecurity Architecture.',
  },
];

const sampleHistoricalVendors = [
  {
    vendorName: 'Acme Industrial Supply',
    count: 18,
    avgAmount: 14500.0,
    docs: [
      { num: 'INV-0410', amount: 14200.0, daysAgo: 60 },
      { num: 'INV-0415', amount: 15100.0, daysAgo: 45 },
      { num: 'INV-0420', amount: 13900.0, daysAgo: 30 },
      { num: 'INV-0425', amount: 14800.0, daysAgo: 15 },
    ],
  },
  {
    vendorName: 'Northstar Logistics',
    count: 42,
    avgAmount: 6100.0,
    docs: [
      { num: 'INV-110', amount: 6200.0, daysAgo: 40 },
      { num: 'INV-114', amount: 5900.0, daysAgo: 25 },
      { num: 'INV-118', amount: 6300.0, daysAgo: 10 },
    ],
  },
  {
    vendorName: 'Meridian Office Group',
    count: 27,
    avgAmount: 3100.0,
    docs: [
      { num: 'INV-71', amount: 2900.0, daysAgo: 50 },
      { num: 'INV-74', amount: 3200.0, daysAgo: 20 },
    ],
  },
  {
    vendorName: 'Harbor & Co.',
    count: 9,
    avgAmount: 850.0,
    docs: [
      { num: 'REC-501', amount: 820.0, daysAgo: 35 },
      { num: 'REC-508', amount: 860.0, daysAgo: 5 },
    ],
  },
];

async function seed() {
  console.log('[Seed] Starting database seed...');

  // 1. Seed Policies
  console.log('[Seed] Seeding Policy Clauses into pgvector...');
  for (const pol of samplePolicies) {
    const existing = await prisma.policyClause.findUnique({ where: { id: pol.id } });
    if (!existing) {
      const emb = await getEmbedding(pol.text);
      await insertPolicyClause(pol.id, pol.text, pol.category, emb);
      console.log(`  ✓ Indexed clause: ${pol.id}`);
    }
  }

  // 2. Seed Historical Documents for Vendor History baseline
  console.log('[Seed] Seeding historical documents and vendor baselines...');
  for (const v of sampleHistoricalVendors) {
    for (const d of v.docs) {
      const docId = `hist_${d.num.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      const existing = await prisma.document.findUnique({ where: { id: docId } });
      if (!existing) {
        const uploadDate = new Date(Date.now() - d.daysAgo * 24 * 60 * 60 * 1000);
        await prisma.document.create({
          data: {
            id: docId,
            fileName: `${d.num.toLowerCase()}.pdf`,
            fileSizeMB: 1.2,
            cloudinaryUrl: `https://storage.docforensic.ai/samples/${d.num.toLowerCase()}.pdf`,
            status: 'COMPLETE',
            uploadedAt: uploadDate,
            extractedData: {
              create: {
                vendorName: v.vendorName,
                invoiceNumber: d.num,
                amount: d.amount,
                date: uploadDate,
                lineItemsJson: [{ description: 'Procurement item batch', amount: d.amount }],
                ocrConfidence: 0.98,
              },
            },
            verdict: {
              create: {
                riskScore: 18,
                decision: 'APPROVE',
                explanation: 'Historical benchmark submission cleared with full audit compliance.',
              },
            },
          },
        });
        console.log(`  ✓ Created baseline document: ${docId} for ${v.vendorName}`);
      }
    }
  }

  console.log('[Seed] Database seed completed successfully!');
}

seed()
  .catch((e) => {
    console.error('[Seed Error]', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
