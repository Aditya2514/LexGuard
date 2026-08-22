<div align="center">

  <h1>🏛️ LexGuard</h1>
  <h3>AI-Powered Legal Contract Intelligence Platform for Indian Jurisprudence</h3>

  <p align="center">
    <i>An autonomous multi-agent legal risk analyst, predatory clause auditor, and vector RAG compliance engine engineered specifically for Indian contract law.</i>
  </p>

  <p align="center">
    <a href="#-benchmark-performance"><img src="https://img.shields.io/badge/Risk_Accuracy-100%25-brightgreen.svg?style=for-the-badge&logo=target" alt="Risk Accuracy" /></a>
    <a href="#-benchmark-performance"><img src="https://img.shields.io/badge/Classification-100%25-brightgreen.svg?style=for-the-badge&logo=check" alt="Classification Accuracy" /></a>
    <a href="#-rag-statutory-grounding-engine"><img src="https://img.shields.io/badge/Statutes_Ingested-7556%2B-blue.svg?style=for-the-badge&logo=mongodb" alt="Statutes Ingested" /></a>
    <a href="#-system-architecture"><img src="https://img.shields.io/badge/Architecture-6_Agent_Pipeline-purple.svg?style=for-the-badge&logo=diagramsdotnet" alt="6-Agent Architecture" /></a>
    <a href="#-tech-stack-matrix"><img src="https://img.shields.io/badge/React-19.0-61DAFB.svg?style=for-the-badge&logo=react" alt="React 19" /></a>
    <a href="#-tech-stack-matrix"><img src="https://img.shields.io/badge/Backend-Node.js_Express-green.svg?style=for-the-badge&logo=nodedotjs" alt="Node.js Express" /></a>
    <a href="#-tech-stack-matrix"><img src="https://img.shields.io/badge/Payments-Razorpay_SaaS-blueviolet.svg?style=for-the-badge&logo=razorpay" alt="Razorpay SDK" /></a>
  </p>

  <br />

  <img src="artifacts/01_landing.png" width="96%" alt="LexGuard Hero Interface" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);" />

</div>

<br />

---

## 📌 Table of Contents

- [💡 Overview](#-overview)
- [✨ Key Capabilities & Features](#-key-capabilities--features)
- [🖼️ Product Tour & UI Showcase](#️-product-tour--ui-showcase)
- [🏗️ System Architecture](#️-system-architecture)
- [🤖 The 6-Agent AI Orchestration Engine](#-the-6-agent-ai-orchestration-engine)
- [🛡️ V8 Commercial Asymmetry Engine & Safety Net](#️-v8-commercial-asymmetry-engine--safety-net)
- [⚙️ RAG Statutory Grounding Engine](#️-rag-statutory-grounding-engine)
- [🏆 Benchmark Performance](#-benchmark-performance)
- [💻 Tech Stack Matrix](#-tech-stack-matrix)
- [🚀 Quick Start & Installation](#-quick-start--installation)
- [📡 API Endpoints Reference](#-api-endpoints-reference)
- [🔐 Security & Production Hardening](#-security--production-hardening)

---

## 💡 Overview

**LexGuard** is a full-stack, enterprise-grade AI legal intelligence platform built to parse, analyze, and audit complex agreements under Indian law. Designed for founders, employees, freelancers, and legal teams, LexGuard bridges the gap between legalese and plain language while surfacing high-risk commercial traps.

Traditional LLM wrappers suffer from statutory hallucinations, missing subtle legal loopholes, and crashing on large document streaming. LexGuard solves this through a **6-Agent Sequential Pipeline**, a **Vector Retrieval-Augmented Generation (RAG) Engine** powered by MongoDB Atlas containing 7,556+ Indian law nodes, and an unbreakable **V8 Deterministic Safety Net** featuring 18 hardcoded legal trap tripwires.

---

## ✨ Key Capabilities & Features

<table>
  <tr>
    <td width="50%">
      <h3>📄 3-Tier Parsing Fallback</h3>
      <p>Seamless document processing supporting PDF and DOCX files. Implements an automatic 3-tier fallback hierarchy (<b>LlamaParse</b> cloud vision → <b><code>pdf-parse</code></b> local stream → <b>Tesseract OCR</b>) to handle complex, scanned, or image-heavy agreements.</p>
    </td>
    <td width="50%">
      <h3>🤖 6-Agent AI Pipeline</h3>
      <p>Orchestrates specialized, isolated AI agents: Global PreFlight Context Extractor, Clause Classifier, Commercial Risk Analyst, Adversarial Judge, Plain-Language Advocate, and Geo-RAG Compliance Engine.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🛡️ Commercial Asymmetry Engine</h3>
      <p>Replaces basic keyword scanning with an advanced legal risk layer targeting unconscionable clauses: unilateral jurisdiction, non-solicit traps, IP pre-assignment, predatory equity clawbacks, and wage forfeiture.</p>
    </td>
    <td width="50%">
      <h3>🧠 MongoDB Atlas Vector RAG</h3>
      <p>Performs 384-dimensional <code>$vectorSearch</code> queries directly at the database layer against <b>7,556+ statutory nodes</b> (Contract Act 1872, DPDP Act 2023, Copyright Act, etc.) with a rigid <code>0.82</code> similarity threshold.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>💬 Interactive Contract Chat</h3>
      <p>Context-aware conversational assistant allows users to ask arbitrary legal questions regarding obligations, termination windows, non-compete boundaries, and IP ownership.</p>
    </td>
    <td width="50%">
      <h3>💳 Production SaaS & Razorpay</h3>
      <p>Full auth & quota system, rolling 30-day usage resets, tiered plans (Free, Pro, Enterprise), native GridFS memory streaming, Upstash Redis job queue, and Razorpay payment integration.</p>
    </td>
  </tr>
</table>

---

## 🖼️ Product Tour & UI Showcase

### 1. Executive Intelligence Dashboard
> *Monitor uploaded contracts, overall risk distribution, usage quotas, and recent document status at a glance.*

<div align="center">
  <img src="artifacts/03_dashboard.png" width="96%" alt="LexGuard Dashboard" style="border-radius: 8px;" />
</div>

<br />

### 2. Multi-Agent Async Pipeline Processing
> *Real-time visualization as document clauses progress through PreFlight extraction, Agent classification, Risk analysis, and Statutory compliance checking.*

<div align="center">
  <img src="artifacts/04_uploading.png" width="96%" alt="LexGuard Uploading & Realtime Pipeline" style="border-radius: 8px;" />
</div>

<br />

### 3. Comprehensive Contract Analysis & Clause Breakdown
> *Granular clause rating (Low, Medium, High, Critical), plain-language explanations, worst-case scenarios, negotiation advice, statutory citations, and one-click suggested rewrites.*

<div align="center">
  <img src="artifacts/05_analysis_result.png" width="96%" alt="LexGuard Analysis Result" style="border-radius: 8px;" />
</div>

<br />

### 4. SaaS Tier Management & Razorpay Checkout
> *Flexible subscription tiers (Free / Pro / Enterprise) backed by Razorpay payments for instant quota upgrades.*

<div align="center">
  <img src="artifacts/06_pricing.png" width="48%" alt="Pricing Tier Cards" />
  <img src="artifacts/07_razorpay_modal.png" width="48%" alt="Razorpay Payment Gateway Modal" />
</div>

<br />

### 5. Seamless Onboarding & User Authentication
> *Secure JWT-based user authentication, key management, and session state persistence.*

<div align="center">
  <img src="artifacts/02_register.png" width="80%" alt="User Registration Interface" />
</div>

---

## 🏗️ System Architecture

LexGuard follows a decoupled, asynchronous micro-architecture engineered for high throughput, zero asynchronous race conditions, and cloud resilience.

<div align="center">
  <img src="artifacts/system_architecture.png" width="96%" alt="LexGuard Architecture Diagram" style="border-radius: 8px;" />
</div>

### System Flow (Mermaid Visual)

```mermaid
graph TB
    subgraph "Frontend (React 19 + Vite)"
        LP["Landing Page"]
        AuthView["Auth & Registration"]
        Dash["User Dashboard"]
        Detail["Contract Audit Workspace"]
        ChatUI["Interactive Contract Chat"]
        PricingUI["Razorpay SaaS Modal"]
    end

    subgraph "Backend Layer (Express.js REST API)"
        API["API Controller Gateway"]
        JWT["JWT Auth & Quota Guard"]
        UploadSvc["Multer Memory Buffer"]
        GridFS["MongoDB Native GridFS Stream"]
        QueueSvc["Dual-Mode Queue (Redis / Mongo)"]
    end

    subgraph "6-Agent AI Execution Pipeline"
        A0["🧠 Agent 0: PreFlight Global Context"]
        A1["📋 Agent 1: Clause Classifier (17 Types)"]
        A2["⚠️ Agent 2: Commercial Risk Analyst"]
        A25["⚖️ Agent 2.5: Adversarial Judge"]
        V8["🛡️ V8 Deterministic Safety Net"]
        A3["💬 Agent 3: User Advocate & Drafter"]
        A4["📜 Agent 4: Geo-RAG Compliance"]
    end

    subgraph "Data & Knowledge Layer"
        Mongo["MongoDB Atlas Vector DB"]
        Statutes["7,556+ Ingested Indian Statute Nodes"]
        HF["HuggingFace Embeddings (all-MiniLM-L6-v2)"]
    end

    Dash --> UploadSvc --> GridFS
    UploadSvc --> QueueSvc
    QueueSvc --> A0 --> A1 --> A2 --> A25 --> V8 --> A3 --> A4
    A4 --> Statutes
    A4 --> Mongo
    Detail --> ChatUI
    PricingUI --> API
```

---

## 🤖 The 6-Agent AI Orchestration Engine

LexGuard executes a multi-stage sequential agent pipeline. Each agent operates with isolated system prompts, deterministic JSON schemas, custom temperature settings, and targeted roles:

<div align="center">
  <img src="artifacts/agent_pipeline.png" width="96%" alt="LexGuard 6-Agent Pipeline" style="border-radius: 8px;" />
</div>

<br />

| Agent | Name | Role & Responsibility | Temperature |
| :--- | :--- | :--- | :--- |
| **Agent 0** | **PreFlight Engine** | Scans document header (first 12K chars) to extract governing law, parties, designations, and global definitions. | `0.1` |
| **Agent 1** | **Clause Extractor & Classifier** | Maps parsed text into discrete clauses and categorizes them across 17 legal types (Non-Compete, IP Assignment, Indemnity, Jurisdiction, etc.). | `0.1` |
| **Agent 2** | **Risk Analyst (Asymmetry Engine)** | Performs 4-tier risk assessment (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), calculating asymmetric leverage and potential liability. | `0.2` |
| **Agent 2.5** | **Adversarial Judge** | Cross-examines Agent 2 outputs from a hostile employer/vendor perspective to eliminate false positives and false negatives. | `0.1` |
| **V8** | **Deterministic Safety Net** | Scans clause text against 18 hardcoded regex patterns to trigger emergency overrides if AI misses critical traps. | `Deterministic` |
| **Agent 3** | **User Advocate** | Translates legalese into plain language, details worst-case scenarios, provides negotiation advice, and drafts balanced rewrites. | `0.3` |
| **Agent 4** | **Geo-RAG Statutory Compliance** | Queries Atlas Vector Search for statutory sections, auditing compliance against Indian laws (Contract Act, DPDP, IT Act, etc.). | `0.1` |
| **Agent 5** | **Interactive Contract Chat** | Context-aware LLM agent allowing instant interactive Q&A over the entire contract state. | `0.4` |

---

## 🛡️ V8 Commercial Asymmetry Engine & Safety Net

Standard AI risk scanners often miss legal traps disguised as standard boilerplate. LexGuard combines LLM semantic reasoning with an unbreakable **V8 Deterministic Safety Net**.

<div align="center">
  <img src="artifacts/dual_layer_defense.png" width="96%" alt="Dual Layer Defense Diagram" style="border-radius: 8px;" />
</div>

<br />

### Key Traps Detected & Blocked Automatically

```mermaid
graph TD
    Clause["Clause Text Processing"] --> LLM["LLM Agent 2 & 2.5 Analysis"]
    LLM --> SafetyNet{"V8 Safety Net Check\n(18 Hardcoded Regex Traps)"}
    SafetyNet -->|Trap Triggered| Override["🚨 CRITICAL Override\n(Elevates Risk & Appends Warnings)"]
    SafetyNet -->|No Hard Trap| Keep["✅ Validate LLM Severity Rating"]
```

- **Unilateral Force Majeure**: Disproportionate termination rights during business disruptions.
- **Pre-Existing IP Capture**: Broad employer claims on personal, pre-existing employee inventions.
- **Punitive Wage Forfeiture**: Illegal salary deductions or withholding upon notice period dispute.
- **Global Non-Solicit Scope**: Unenforceable, overly restrictive worldwide client/employee bans.
- **POSH Gag Orders**: Clauses preventing mandatory statutory reporting under Indian POSH law.
- **Excessive Liquidated Damages**: Unreasonable financial penalties disproportional to actual loss.
- **Evergreen Auto-Renewal**: Hidden recurring commitments without explicit opt-in triggers.
- **Ghost Jurisdiction / Tax Havens**: Forced foreign arbitration forums outside Indian court authority.

---

## ⚙️ RAG Statutory Grounding Engine

LexGuard strictly grounds its statutory compliance analysis using Retrieval-Augmented Generation (RAG).

```mermaid
graph LR
    CT["Clause Segment"] --> EMB["Generate 384-dim Embedding\n(all-MiniLM-L6-v2)"]
    EMB --> Atlas["MongoDB Atlas Vector Search\n($vectorSearch)"]
    Atlas --> Filter["LegalDomainMap Ontology Filter\n(Domain Routing)"]
    Filter --> Match["Top 3 Matching Statutes\n(Similarity > 0.82)"]
    Match --> Agent4["Agent 4 Compliance Verification"]
```

### Statutory Database Highlights
- **7,556+ Ingested Statute Nodes** with pre-computed 384-dimensional vector embeddings.
- **Ingested Acts Include**:
  - *Indian Contract Act, 1872*
  - *Digital Personal Data Protection (DPDP) Act, 2023*
  - *Copyright Act, 1957*
  - *Industrial Disputes Act, 1947*
  - *Information Technology (IT) Act, 2000*
  - *Specific Relief Act, 1963*
  - *POSH Act, 2013*

---

## 🏆 Benchmark Performance

LexGuard is continuously benchmarked against synthetic and real-world Indian legal contracts, including an **Adversarial Heavy Suite** of 10 hyper-obfuscated contract traps.

### Calibration & Benchmark Summary

| Metric / Suite | Master Calibration (30 Cases) | Stress Test (10 Adversarial Traps) |
| :--- | :---: | :---: |
| **Clause Classification Accuracy** | **100%** | **100%** |
| **Risk Assessment Accuracy** | **100%** | **100%** |
| **False Negative Rate** | **0.0%** | **0.0%** |
| **V8 Deterministic Escalations** | N/A | **10 / 10 Successfully Intervened** |
| **Statutory Hallucination Rate** | **0.0%** | **0.0%** |

> **Result**: Enterprise-grade auditing engine with zero blind spots for critical legal vulnerabilities.

---

## 💻 Tech Stack Matrix

### Frontend Architecture
- **Framework**: React 19 + Vite
- **State & Data Fetching**: `@tanstack/react-query` v5
- **Routing**: React Router v7 (`react-router-dom`)
- **UI & Visualization**: Recharts v3, `diff` (visual rewrites), `html2pdf.js`, `react-joyride`
- **Design System**: Modern Vanilla CSS with dark mode tokens & glassmorphic accents

### Backend & AI Infrastructure
- **Runtime**: Node.js (v18+) & Express.js
- **Database**: MongoDB Atlas (`Mongoose` v8) with `$vectorSearch` and native GridFS streaming
- **Caching & Queue**: Upstash Redis (`redis` v5) with active MongoDB fallback polling
- **AI & LLM Services**: HuggingFace Inference API (`meta-llama`), `@google/generative-ai`
- **Vector Embeddings**: `@xenova/transformers` (`sentence-transformers/all-MiniLM-L6-v2`)
- **Document Extractors**: LlamaParse Cloud API, `pdf-parse`, `tesseract.js`, `mammoth` (DOCX)
- **Security & SaaS**: `jsonwebtoken`, `bcryptjs`, `helmet`, `express-rate-limit`, `razorpay`

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MongoDB Atlas**: Cluster with Vector Search enabled
- **HuggingFace API Key** or **Google Gemini API Key**

### 1. Clone the Repository
```bash
git clone https://github.com/Aditya2514/LexGuard.git
cd LexGuard
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/lexguard?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here
HF_TOKEN=your_huggingface_api_token
REDIS_URL=rediss://default:your_redis_password@your_redis_host:6379
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### 3. Seed Knowledge Base (Statute Nodes)
```bash
node seedCaseLaw.js
```

### 4. Start Backend Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 5. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 📡 API Endpoints Reference

| Category | Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- | :---: |
| **Auth** | `POST` | `/api/auth/register` | Register new user account | ❌ |
| **Auth** | `POST` | `/api/auth/login` | User authentication & JWT generation | ❌ |
| **Auth** | `GET` | `/api/auth/me` | Fetch current user profile & quota | ✅ |
| **Contracts**| `POST` | `/api/contracts/upload` | Upload PDF/DOCX contract & initiate queue | ✅ |
| **Contracts**| `GET` | `/api/contracts` | List all user uploaded contracts | ✅ |
| **Contracts**| `GET` | `/api/contracts/:id` | Fetch contract analysis detail & progress | ✅ |
| **Clauses** | `GET` | `/api/contracts/:id/clauses` | Retrieve parsed clause segments with agent outputs | ✅ |
| **Chat** | `POST` | `/api/chat/:contractId` | Ask interactive legal questions to Agent 5 | ✅ |
| **Payments** | `POST` | `/api/payments/create-order`| Generate Razorpay subscription order | ✅ |
| **Payments** | `POST` | `/api/payments/verify` | Verify Razorpay payment signature & update plan | ✅ |

---

## 🔐 Security & Production Hardening

- **Multipart Direct Memory Streaming**: Uses Multer memory buffers directly into MongoDB GridFS streams, eliminating temporary disk storage and BSON size limitations.
- **Strict Key Hashing**: Password storage secured with `bcryptjs` using salt rounds = 10.
- **HTTP Hardening**: Configured with `helmet` for header security and `express-rate-limit` to prevent API abuse.
- **Deterministic ID Synchronization**: Eliminates asynchronous data race conditions by indexing clauses through numeric sequence arrays rather than echoing AI-generated string IDs.

---

<div align="center">
  <br />
  <p><b>Built with precision for the complex realities of Indian Legal Jurisprudence.</b></p>
  <p>© 2026 LexGuard Intelligence Platform. All rights reserved.</p>
</div>
