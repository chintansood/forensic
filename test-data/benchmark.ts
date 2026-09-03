import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:4000/api';
const GENUINE_DIR = path.resolve(__dirname, 'genuine');
const TAMPERED_DIR = path.resolve(__dirname, 'tampered');
const RING_DIR = path.resolve(__dirname, 'ring_fraud');

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadAndVerify(filePath: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  // 1. Upload
  const uploadRes = await axios.post(`${BASE_URL}/documents/upload`, formData, {
    headers: formData.getHeaders(),
  });
  const { documentId } = uploadRes.data;

  // 2. Verify
  await axios.post(`${BASE_URL}/documents/${documentId}/verify`);

  // 3. Poll status until COMPLETE
  let attempts = 0;
  while (attempts < 30) {
    await sleep(600);
    const statusRes = await axios.get(`${BASE_URL}/documents/${documentId}/status`);
    if (statusRes.data.pipelineStatus === 'COMPLETE') {
      break;
    }
    attempts++;
  }

  // 4. Fetch Report
  const reportRes = await axios.get(`${BASE_URL}/documents/${documentId}/report`);
  return reportRes.data;
}

async function runBenchmark() {
  console.log('======================================================');
  console.log('🔬 STARTING DOCFORENSIC PIPELINE BENCHMARK SUITE');
  console.log('======================================================\n');

  let truePositives = 0; // Correctly flagged tampered/ring
  let falsePositives = 0; // Genuine falsely flagged
  let trueNegatives = 0; // Genuine correctly cleared
  let falseNegatives = 0; // Tampered incorrectly cleared

  // 1. Test Genuine Invoices
  console.log('🧪 Testing Genuine Invoices (Expected: Low Risk / APPROVE / CLEAR)...');
  const genuineFiles = fs.readdirSync(GENUINE_DIR).filter((f) => f.endsWith('.jpg')).slice(0, 4);
  for (const f of genuineFiles) {
    const filePath = path.join(GENUINE_DIR, f);
    const report = await uploadAndVerify(filePath);
    const isClean = report.decision === 'APPROVE' || report.riskScore < 40;
    if (isClean) {
      trueNegatives++;
      console.log(`  ✓ ${f} -> Decision: ${report.decision}, Risk: ${report.riskScore}/100 [CLEARED]`);
    } else {
      falsePositives++;
      console.log(`  ✗ ${f} -> Decision: ${report.decision}, Risk: ${report.riskScore}/100 [FALSE POSITIVE]`);
    }
  }

  // 2. Test Tampered Invoices
  console.log('\n🧪 Testing Tampered Invoices (Expected: High Forensics Risk / REJECT / REVIEW)...');
  const tamperedFiles = fs.readdirSync(TAMPERED_DIR).filter((f) => f.endsWith('.jpg')).slice(0, 4);
  for (const f of tamperedFiles) {
    const filePath = path.join(TAMPERED_DIR, f);
    const report = await uploadAndVerify(filePath);
    const isFlagged = report.decision !== 'APPROVE' || report.riskScore >= 40;
    const hasForensicFlag = report.findings.some((find: any) => find.agent === 'Forensics' && find.severity !== 'CLEAR');

    if (isFlagged && hasForensicFlag) {
      truePositives++;
      console.log(`  ✓ ${f} -> Decision: ${report.decision}, Risk: ${report.riskScore}/100, Forensics: FLAGGED`);
    } else {
      falseNegatives++;
      console.log(`  ✗ ${f} -> Decision: ${report.decision}, Risk: ${report.riskScore}/100 [MISSED TAMPERING]`);
    }
  }

  // 3. Test Ring Fraud Template Cluster
  console.log('\n🧪 Testing Ring-Detection Template Cluster (Expected: Cross-document match)...');
  const ringFiles = fs.readdirSync(RING_DIR).filter((f) => f.endsWith('.jpg'));
  const ringDocIds: string[] = [];
  for (const f of ringFiles) {
    const filePath = path.join(RING_DIR, f);
    const report = await uploadAndVerify(filePath);
    ringDocIds.push(report.documentId);
    const ringFinding = report.findings.find((find: any) => find.agent === 'Ring-Detection');
    console.log(
      `  • ${f} -> DocID: ${report.documentId}, Ring Severity: ${ringFinding?.severity}, Matches: ${
        ringFinding?.matchedDocumentIds?.length || 0
      }`
    );
  }

  // Calculate Precision and Recall
  const precision = (truePositives / (truePositives + falsePositives || 1)) * 100;
  const recall = (truePositives / (truePositives + falseNegatives || 1)) * 100;
  const f1 = (2 * precision * recall) / (precision + recall || 1);

  console.log('\n======================================================');
  console.log('📊 BENCHMARK METRICS SUMMARY');
  console.log('======================================================');
  console.log(`True Positives (Tampered detected):  ${truePositives}`);
  console.log(`True Negatives (Genuine cleared):    ${trueNegatives}`);
  console.log(`False Positives:                    ${falsePositives}`);
  console.log(`False Negatives:                    ${falseNegatives}`);
  console.log(`Precision:                          ${precision.toFixed(1)}%`);
  console.log(`Recall:                             ${recall.toFixed(1)}%`);
  console.log(`F1 Score:                           ${f1.toFixed(1)}%`);
  console.log('======================================================\n');
}

runBenchmark().catch((err) => {
  console.error('Benchmark execution error:', err.response?.data || err.message);
  process.exit(1);
});
