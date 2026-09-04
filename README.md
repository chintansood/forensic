# 🔍 DocForensic AI — Multi-Agent Document Forensics & Fraud Intelligence

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Computer%20Vision-FastAPI%20%2F%20OpenCV-green)](https://fastapi.tiangolo.com/)
[![Express](https://img.shields.io/badge/Backend-Node.js%20%2F%20Express-lightgrey)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Vector%20DB-Prisma%20pgvector-indigo)](https://www.prisma.io/)
[![MongoDB](https://img.shields.io/badge/Trace%20Store-MongoDB-brightgreen)](https://www.mongodb.com/)

**DocForensic AI** is an enterprise-grade multi-agent web application that automatically inspects, cross-references, and verifies invoices, receipts, and financial documents before payment or reimbursement. 

Unlike black-box scoring systems, DocForensic AI runs **six specialized AI agents** in parallel, providing inspectable evidence bounding boxes, policy clause citations, vendor anomaly detection, and a cross-document **Collusion Ring Detection** graph.

---

## 🌟 Key Features

- **🔎 Multi-Agent Forensic Pipeline**:
  - **Extraction Agent**: Extracts OCR text, tables, line items, VAT/Tax IDs, and geometry bounding boxes.
  - **Forensics & CV Agent**: Performs Error Level Analysis (ELA), EXIF metadata inspection, font mismatch detection, and generates 1536-dimensional perceptual document embeddings.
  - **Policy Compliance Agent**: Automatically evaluates line items against company expense policies, mileage limits, and alcohol/item bans.
  - **Vendor Intelligence Agent**: Validates bank account changes, tax ID validity, first-time high-value submission risks, and duplicate invoice IDs.
  - **Ring-Detection Agent**: Links cross-document fraud patterns across multiple submissions (e.g., duplicate invoice numbers across different vendors, identical bank account routing, perceptual template cloning).
  - **Verdict Fusion Agent**: Synthesizes all agent signals into an explainable 0–100 risk score and categorizes findings as **PASS**, **FLAGGED**, or **SUSPICIOUS**.

- **🗺️ Interactive Evidence Inspector**:
  - Visual overlay bounding boxes over the original PDF/image for every flagged anomaly (font tampering, layout distortion, duplicate amounts).

- **🕸️ Collusion Network Graph**:
  - Real-time visual network graph linking suspicious vendors, shared bank accounts, and duplicate document signatures.

- **📜 Complete Audit Trail**:
  - Full cryptographic event stream logging every agent step, timestamp, raw execution payload, and human reviewer action.

---

## 🏗️ System Architecture

```
                       ┌─────────────────────────┐
                       │  Next.js 14 Web App     │
                       │  (Interactive Dashboard)│
                       └───────────┬─────────────┘
                                   │ HTTP / REST
                                   ▼
                       ┌─────────────────────────┐
                       │  Node/Express Backend   │
                       │  (Agent Orchestration)  │
                       └─────┬──────────────┬────┘
                             │              │
        ┌────────────────────┴──┐        ┌──┴───────────────────┐
        ▼                       ▼        ▼                      ▼
┌─────────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐
│ FastAPI Engine  │ │ MongoDB Trace │ │ PostgreSQL /  │ │ LLM / Vision    │
│ (ELA, CV, EXIF) │ │ (Agent Logs)  │ │ pgvector      │ │ Reasoning APIs  │
└─────────────────┘ └───────────────┘ └───────────────┘ └─────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.x or higher
- **Python**: v3.10 or higher
- **PostgreSQL** (with `pgvector` extension)
- **MongoDB** (local instance or MongoDB Atlas)

---

### 1. Start the Computer Vision & Forensics Microservice

```bash
cd forensics_service

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install fastapi uvicorn pillow opencv-python-headless pymupdf numpy pydantic

# Launch microservice on port 8000
python main.py
```
*Health check available at: `http://127.0.0.1:8000/health`*

---

### 2. Configure & Start the Backend Orchestrator

```bash
cd backend

# Install dependencies
npm install

# Setup Prisma Schema & migrations
npx prisma generate
npx prisma db push

# Start Backend Server on port 4000
npm run dev
```

---

### 3. Launch the Frontend Dashboard

```bash
cd frontend

# Install dependencies
npm install

# Start Next.js development server on port 3000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing with Sample Data

Pre-generated test documents are available in the [`test-data/`](./test-data) directory:

- **`test-data/genuine_invoice_1.pdf`**: Clean, standard verified invoice (Scores 0–15).
- **`test-data/tampered_amount_invoice.pdf`**: Digitally modified total amount triggering ELA and Font inconsistency alarms (Scores 70–95).
- **`test-data/ring_collusion_doc_A.pdf` & `test-data/ring_collusion_doc_B.pdf`**: Collusion test case with shared routing account across distinct vendor entities.

---

## 📡 API Overview

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/documents/upload` | `POST` | Upload single or batch PDF/image invoices |
| `/api/documents/:id/verify` | `POST` | Execute 6-agent forensic pipeline on document |
| `/api/documents/:id/report` | `GET` | Retrieve complete verdict report and raw agent findings |
| `/api/documents/:id/ring-matches` | `GET` | Query cross-document ring linkages & visual graph nodes |
| `/api/vendors` | `GET` | List vendor risk profiles, submission histories, and flags |
| `/api/vendors/rings` | `GET` | Fetch all detected collusion clusters |
| `/api/policies` | `GET / POST` | Manage automated compliance threshold rules |
| `/api/audit-log` | `GET` | Retrieve chronological agent decision traces |

---

## 🛡️ Security & Privacy

- Documents uploaded for analysis are held in temporary storage and cleaned up post-processing according to configured retention policies.
- Secrets and API credentials must be managed via local environment variables (`.env`).
- Never commit private API keys or production database credentials to source control.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
