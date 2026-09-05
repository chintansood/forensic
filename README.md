# 🔍 DocForensic AI — Multi-Agent Document Forensics & Collusion Intelligence

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Computer%20Vision-FastAPI%20%2F%20OpenCV-green)](https://fastapi.tiangolo.com/)
[![Express](https://img.shields.io/badge/Backend-Node.js%20%2F%20Express-lightgrey)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Vector%20DB-Prisma%20pgvector-indigo)](https://www.prisma.io/)
[![MongoDB](https://img.shields.io/badge/Trace%20Store-MongoDB-brightgreen)](https://www.mongodb.com/)

> **NioHack 2026 — AI Agent for Finance**  
> **Team Nexora (T-1008)**: Chintan Sood, Avi Garg, Shreshth Garg, Paarangana Seth  
> *Thapar Institute of Engineering and Technology*

**DocForensic AI** is an enterprise-grade multi-agent document intelligence platform that verifies invoices and receipts before payment or reimbursement. Rather than relying on simple OCR or black-box LLM scoring, DocForensic AI fuses **pixel-level structural forensics** with a **heterogeneous cross-document collusion graph**.

---

## 🌟 Key Features

- **🔎 6-Agent Parallel Pipeline**:
  - **Extraction Agent**: Parses structured line items, VAT/Tax IDs, dates, and spatial geometry bounding boxes.
  - **Forensics & CV Agent (FastAPI)**: Computes Error Level Analysis (ELA), Laplacian font edge sharpness, and generates 2D-DCT & Sobel perceptual embeddings.
  - **Policy Compliance Agent**: Evaluates line items and spending limits against corporate policy clauses.
  - **Vendor Intelligence Agent**: Monitors historical spend velocity, tax ID formats, and unexpected bank routing changes.
  - **Ring-Detection Agent**: Performs cosine distance queries in `pgvector` to identify cloned templates and shared payment infrastructure across ostensibly separate vendors.
  - **Verdict Fusion Agent**: Synthesizes all multi-modal signals into an explainable **Composite Forensic Risk Index (0–100)**.

- **🕸️ Heterogeneous Collusion Evidence Graph**:
  - Distinguishes legitimate shared templates (e.g. QuickBooks, Canva) from coordinated fraud rings by requiring multi-edge corroboration (Template similarity + Overlapping bank account + Tax/domain footprint).

- **🗺️ Audit-Ready Evidence Canvas**:
  - Renders real-time spatial bounding-box overlays over original documents, highlighting anomalous font variations and digital tampering regions.

- **🛡️ Traceable Decision Trail**:
  - Full cryptographic event stream logging every agent trace and reviewer action (**Approve, Escalate, Reject**).

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
│ (ELA, CV, DCT)  │ │ (Agent Logs)  │ │ pgvector      │ │ Reasoning APIs  │
└─────────────────┘ └───────────────┘ └───────────────┘ └─────────────────┘
```

---

## 🧪 Adversarial Evaluation Matrix

| Adversarial Attack Transformation | Forensic Detection Layer | System Sensitivity |
| :--- | :--- | :---: |
| **PDF Text / Font Replacement** (Acrobat/Editor) | Font descriptor table & object revision stream | **High (✅)** |
| **Cross-Entity Cloned Template Ring** | Perceptual embedding + Remittance graph edge | **High (✅)** |
| **Legitimate Shared Template** (e.g. QuickBooks) | Multi-edge graph corroboration (Separate bank/tax) | **Filtered (✅ No False Ring)** |
| **Flattened Image Export** (Metadata stripped) | Font stroke density & visual layout embedding | **Moderate (🟡)** |
| **Cleanly Generated Synthetic Fake Invoice** | Historical vendor baseline & Entity graph | **Moderate (🟡)** |

---

## 🚀 Getting Started

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

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
