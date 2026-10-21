<div align="center">

  <h1>🏛️ LexGuard</h1>
  <h3>AI contract review for Indian law</h3>

  <p align="center">
    <i>Upload an employment, freelance or vendor contract. LexGuard splits it into clauses, rates how risky each one is for the person signing, explains it in plain language, cites the Indian statute it touches, and drafts a fairer rewrite.</i>
  </p>

  <p align="center">
    <a href="https://github.com/Aditya2514/LexGuard/actions/workflows/tests.yml"><img src="https://github.com/Aditya2514/LexGuard/actions/workflows/tests.yml/badge.svg" alt="Tests" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT License" /></a>
    <a href="#-tech-stack-matrix"><img src="https://img.shields.io/badge/React-19-61DAFB.svg?logo=react" alt="React 19" /></a>
    <a href="#-tech-stack-matrix"><img src="https://img.shields.io/badge/Node.js-Express-339933.svg?logo=nodedotjs" alt="Node.js + Express" /></a>
    <a href="#️-rag-statutory-grounding-engine"><img src="https://img.shields.io/badge/MongoDB-Atlas_Vector_Search-47A248.svg?logo=mongodb" alt="MongoDB Atlas Vector Search" /></a>
  </p>

  <br />

  <img src="artifacts/01_landing.png" width="96%" alt="LexGuard Hero Interface" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);" />

</div>

<br />

---

## 🧗 What Was Hard

A contract reviewer that is right most of the time is easy to demo and hard to trust. Most of the work went into the parts around the LLM:

- **LLMs under-rate polished traps.** A predatory clause written in calm legal language often comes back LOW. After the risk analyst and an adversarial second pass, a deterministic detector (36 hand-written trap patterns in `classifierService.js`) can force an escalation, and a reflection loop makes the model explain the trap it missed.
- **Fitting in 512 MB.** The first host capped RAM at 512 MB. The backend runs with a 380 MB V8 heap limit, drops local embedding models after inactivity in `LOW_MEMORY_MODE`, and forces garbage collection after each job.
- **Providers fail mid-document.** Hugging Face serverless returns 402 when free credit runs out. The AI client cascades across Gemini, Groq, Hugging Face, Grok and local Ollama; if every provider fails it returns a keyword-heuristic placeholder answer instead of failing the job.
- **Extracted text is messy.** PDFs glue section numbers onto the previous sentence (`courts.16. GOVERNING LAW`) and lose line breaks. A two-pass chunker repairs that before any model sees it, and parsing falls back from LlamaParse to `pdf-parse` to Tesseract OCR for scans.
- **Clause IDs drift.** Letting the LLM echo clause IDs back attached results to the wrong clause, so clauses are keyed by their position in the document instead.

---

## 📌 Table of Contents

- [🧗 What Was Hard](#-what-was-hard)
- [💡 Overview](#-overview)
- [✨ Key Capabilities & Features](#-key-capabilities--features)
- [🖼️ Product Tour & UI Showcase](#️-product-tour--ui-showcase)
- [🏗️ System Architecture](#️-system-architecture)
- [🤖 The Agent Pipeline](#-the-agent-pipeline)
- [🛡️ Commercial Asymmetry Engine & Deterministic Safety Net](#️-commercial-asymmetry-engine--deterministic-safety-net)
- [⚙️ RAG Statutory Grounding Engine](#️-rag-statutory-grounding-engine)
- [📏 Evaluation](#-evaluation)
- [💻 Tech Stack Matrix](#-tech-stack-matrix)
- [🚀 Quick Start & Installation](#-quick-start--installation)
- [📡 API Endpoints Reference](#-api-endpoints-reference)
- [🔐 Security & Production Hardening](#-security--production-hardening)

---

## 💡 Overview

**LexGuard** is a full-stack app that parses, analyzes and audits agreements under Indian law. It is built for employees, freelancers and founders who sign contracts without a lawyer, and it turns legalese into plain language while surfacing one-sided clauses.

A single LLM call misses subtle traps, cites statutes that don't exist, and falls over on long documents. LexGuard splits the job into a **sequential agent pipeline**, grounds statutory citations with **retrieval over 7,556+ Indian law sections** in MongoDB Atlas Vector Search, and backs the LLM with a **deterministic safety net** of 36 hand-written trap patterns.

---

## ✨ Key Capabilities & Features

<table>
  <tr>
    <td width="50%">
      <h3>📄 3-Tier Parsing Fallback</h3>
      <p>Seamless document processing supporting PDF and DOCX files. Implements an automatic 3-tier fallback hierarchy (<b>LlamaParse</b> cloud vision → <b><code>pdf-parse</code></b> local stream → <b>Tesseract OCR</b>) to handle complex, scanned, or image-heavy agreements.</p>
    </td>
    <td width="50%">
      <h3>🤖 Multi-Agent Pipeline</h3>
      <p>Runs separate LLM agents with their own prompts: PreFlight context extractor, clause classifier, risk analyst with an adversarial judge pass, plain-language advocate, RAG compliance checker, financial and date extractors, a cross-reference auditor and a redline drafter.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🛡️ Commercial Asymmetry Engine</h3>
      <p>Hand-written keyword rules that run after the LLM and can only raise a clause's risk rating, targeting one-sided clauses: hostile jurisdiction, broad non-solicits, IP pre-assignment, equity clawbacks and wage forfeiture.</p>
    </td>
    <td width="50%">
      <h3>🧠 MongoDB Atlas Vector RAG</h3>
      <p>Performs 1024-dimensional (BGE-M3) <code>$vectorSearch</code> queries directly at the database layer against a stated corpus of <b>7,556+ statutory nodes</b> (Contract Act 1872, DPDP Act 2023, Copyright Act, etc.) filtered by legal domain and jurisdiction, keeping matches at <code>0.70</code> similarity or above and tagging those under <code>0.80</code> as lower confidence.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>💬 Interactive Contract Chat</h3>
      <p>Context-aware conversational assistant allows users to ask arbitrary legal questions regarding obligations, termination windows, non-compete boundaries, and IP ownership.</p>
    </td>
    <td width="50%">
      <h3>💳 Production SaaS & Razorpay</h3>
      <p>Full auth & quota system, rolling 30-day usage resets, tiered plans (Free, Pro, Enterprise), native GridFS memory streaming, Redis job queue with a MongoDB polling fallback, and Razorpay payment integration.</p>
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

Uploads are stored in GridFS and processed asynchronously by a queue worker (Redis when available, MongoDB polling otherwise), so the API returns immediately and the UI streams progress.

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

    subgraph "Agent Pipeline (jobQueueService.js)"
        A0["🧠 PreFlight + Agent 0 Symbol Table"]
        A1["📋 Agent 1: Clause Classifier (20 Types)"]
        A2["⚠️ Agent 2: Risk Analyst + 2.5 Judge + Safety Net"]
        AX["💰 Financial & 📅 Date Extractors"]
        A10["🧮 Agent 10: Deterministic Auditor"]
        A3["💬 Agent 3: User Advocate"]
        A4["📜 Agent 4: RAG Compliance"]
        A9["🔗 Agent 9: Cross-Ref Auditor"]
        A8["✍️ Agent 8: Redline Drafter"]
    end

    subgraph "Data & Knowledge Layer"
        Mongo["MongoDB Atlas Vector DB"]
        Statutes["Indian Statute Nodes (7,556+ stated)"]
        HF["Local Embeddings (Xenova/bge-m3, 1024-dim)"]
    end

    Dash --> UploadSvc --> GridFS
    UploadSvc --> QueueSvc
    QueueSvc --> A0 --> A1 --> A2
    A1 --> AX
    A2 --> A10
    AX --> A10
    A10 --> A3 --> A8
    A10 --> A4 --> A8
    A10 --> A9 --> A8
    A4 --> Statutes
    A4 --> Mongo
    Detail --> ChatUI
    PricingUI --> API
```

---

## 🤖 The Agent Pipeline

`backend/src/services/jobQueueService.js` runs the stages below for every uploaded contract. Each LLM agent has its own system prompt, JSON output schema and temperature; independent stages run concurrently behind a shared concurrency limit.

1. PreFlight context + Agent 0 symbol table (in parallel)
2. Agent 1 classification + clause embeddings
3. Agent 2 risk analysis (with the 2.5 judge pass, the deterministic safety net and a reflection retry), alongside a financial-obligation extractor and a lifecycle-date extractor
4. Agent 10 auditor: deterministic fact extraction and cross-clause contradiction rules, then an optional LLM pass when a provider is available
5. Agent 3 advocate, Agent 4 compliance and Agent 9 cross-reference audit (in parallel)
6. Jurisdiction overrides, citation verification, Agent 8 redline drafter, confidence scoring
7. Agent 6 adversary red-teams the suggested rewrites in the background after the job is marked complete

The main agents:

| Agent | Name | Role & Responsibility | Temperature |
| :--- | :--- | :--- | :--- |
| **Agent 0** | **PreFlight Engine** | Reads the first 20,000 characters (and the last 5,000 if governing law is still missing) to extract governing law, parties and designations; a separate symbol-table pass collects defined terms. | `0.1` |
| **Agent 1** | **Clause Extractor & Classifier** | Classifies each clause produced by the deterministic chunker into one of 20 clause types (non-compete, IP, indemnification, dispute resolution, etc.). | `0.1` |
| **Agent 2** | **Risk Analyst (Asymmetry Engine)** | Performs 4-tier risk assessment (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), calculating asymmetric leverage and potential liability. | `0.2` |
| **Agent 2.5** | **Adversarial Judge** | Re-checks Agent 2's ratings against the clause text, downgrading clauses with explicit safe-harbour wording and escalating missed traps. | `0.1` |
| **Safety net** | **Deterministic Trap Detector** | Scans clause text against 36 hand-written trap patterns and escalates the rating if the AI missed or under-rated a trap. | `Deterministic` |
| **Agent 3** | **User Advocate** | Translates legalese into plain language, details worst-case scenarios, provides negotiation advice, and drafts balanced rewrites. | `0.25` |
| **Agent 4** | **Geo-RAG Statutory Compliance** | Queries Atlas Vector Search for statutory sections, auditing compliance against Indian laws (Contract Act, DPDP, IT Act, etc.). | `0.0` |
| **Chat** | **Interactive Contract Chat** (`agent5Chat.js`) | Runs on demand, outside the pipeline: Q&A over the analysed contract. | `0.3` |

---

## 🛡️ Commercial Asymmetry Engine & Deterministic Safety Net

LLM risk scanners often miss traps disguised as standard boilerplate. LexGuard runs a **deterministic safety net** after the LLM: if a known trap pattern matches, the clause cannot be rated below it. The patterns are keyword rules in `detectPredatoryTraps()` (mostly AND-combinations of phrase lists); they raise ratings and never lower them, so their failure mode is over-flagging.

### Examples of Patterns in the Safety Net

```mermaid
graph TD
    Clause["Clause Text Processing"] --> LLM["LLM Agent 2 & 2.5 Analysis"]
    LLM --> SafetyNet{"Safety Net Check\n(36 Hand-Written Trap Patterns)"}
    SafetyNet -->|Trap Triggered| Override["🚨 Escalate to HIGH / CRITICAL\n(Elevates Risk & Appends Warnings)"]
    SafetyNet -->|No Hard Trap| Keep["✅ Validate LLM Severity Rating"]
```

- **Unilateral Force Majeure**: One side's obligations suspended by a force majeure event while the other's remain absolute.
- **Pre-Existing IP Capture**: Broad employer claims on personal, pre-existing employee inventions.
- **Punitive Wage Forfeiture**: Salary or commission withheld or permanently forfeited.
- **Global Non-Solicit Scope**: Worldwide bans on soliciting or accepting business from any client or prospect.
- **POSH Arbitration**: Sexual-harassment or discrimination claims forced into private or binding arbitration.
- **Excessive Liquidated Damages**: Unreasonable financial penalties disproportional to actual loss.
- **Evergreen Auto-Renewal**: Automatic renewal combined with a 365-day or 12-month notice window or 5-year renewal terms.
- **Hostile Jurisdiction**: Exclusive jurisdiction or governing law in Delaware, New York, Singapore, England or the Cayman Islands.

---

## ⚙️ RAG Statutory Grounding Engine

Agent 4 grounds its statutory citations in sections retrieved from the database (`lawRetrieverService.js`), and a citation verifier re-checks each cited section against the statute text with a `bge-reranker-base` cross-encoder (a word-overlap check in low-memory mode).

```mermaid
graph LR
    CT["Clause Segment"] --> EMB["Generate 1024-dim Embedding\n(Xenova/bge-m3)"]
    EMB --> Atlas["MongoDB Atlas Vector Search\n($vectorSearch)"]
    Atlas --> Filter["LegalDomainMap Ontology Filter\n(Domain Routing)"]
    Filter --> Match["Top 5 Matching Statutes\n(Similarity ≥ 0.70)"]
    Match --> Agent4["Agent 4 Compliance Verification"]
```

### Statutory Database Highlights
- **7,556+ statute nodes** (stated corpus size of the hosted database) with pre-computed 1024-dimensional BGE-M3 embeddings. The source PDFs are in `backend/data/bare_acts`; `backend/scripts/reingest_statutes.js` rebuilds the nodes.
- **Source acts in `backend/data/bare_acts` include**:
  - *Indian Contract Act, 1872*
  - *Digital Personal Data Protection (DPDP) Act, 2023*
  - *Copyright Act, 1957*
  - *Industrial Disputes Act, 1947*
  - *Information Technology (IT) Act, 2000*
  - *Specific Relief Act, 1963*
  - *POSH Act, 2013*

---

## 📏 Evaluation

These numbers come from the reports committed in [`backend/benchmark/`](backend/benchmark) (May 2026 runs). Each case is a single clause with an expected clause type and risk tier. The committed reports predate the October 2026 removal of trap phrases and fallback rules that had been copied from the benchmark clauses, so they may overstate what the current code scores; a re-run is pending.

| Suite | Cases | Clause type correct | Risk tier correct | Risky clauses rated too low |
| :--- | :---: | :---: | :---: | :---: |
| Master calibration | 30 | 28 (93%) | 21 (70%) | 0 |
| Adversarial ("heavy") | 10 | 9 (90%) | 10 (100%) | 0 |
| Ultra | 5 | 5 | 4 | 0 |

What these numbers do and don't say:

- **It errs toward over-flagging.** All 9 risk misses in the master suite rated a clause *more* severe than expected (HIGH → CRITICAL, or a fair safe-harbour clause → HIGH or CRITICAL). It never under-rated a risky clause in these runs. That is the right direction to fail for a tool protecting the signer, but it means noise on fair contracts.
- **I wrote the cases.** The same person wrote the test clauses and the trap patterns, so these suites catch regressions; they do not show how well LexGuard generalises to contracts it has never seen. A held-out set of real contracts is the next step.
- **Benchmarks need live services.** `npm run benchmark` calls the LLM providers and MongoDB. The May reports contain no measured rewrite quality: every rewrite score is either 5/10, the runner's fallback when the judge call returns no usable number, or 10/10, which the runner assigns without calling the judge when the clause was rated LOW or had no rewrite. The offline unit suite (`npm test`, runs in CI on pushes to master and on pull requests) covers the deterministic layer: text cleaning, clause chunking, fact extraction and the cross-clause contradiction rules.

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
- **AI & LLM Services**: Gemini (`@google/generative-ai`), Groq (Llama 3.3 70B / 3.1 8B), Hugging Face Inference (`Qwen/Qwen2.5-7B-Instruct` by default), Grok, optional local Ollama
- **Vector Embeddings**: `@xenova/transformers` (`Xenova/bge-m3`, 1024-dim; `Xenova/bge-reranker-base` for citation re-ranking)
- **Document Extractors**: LlamaParse Cloud API, `pdf-parse`, `tesseract.js`, `mammoth` (DOCX)
- **Security & SaaS**: `jsonwebtoken`, `bcryptjs`, `helmet`, `express-rate-limit`, `razorpay`

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MongoDB Atlas**: Cluster with Vector Search enabled
- An API key for at least one of **Gemini**, **Groq** or **Hugging Face**

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

Copy `backend/.env.example` to `backend/.env` and fill in at least `MONGODB_URI`, `JWT_SECRET` and one LLM key (`GEMINI_API_KEY`, `GROQ_API_KEY` or `HUGGINGFACE_API_KEY`). Redis, Pinecone, Neo4j and Razorpay are optional.

```bash
cp .env.example .env
```

### 3. Seed Landmark Case Law
```bash
node seedCaseLaw.js
```
This seeds a small set of Supreme Court precedents. Statute nodes are ingested separately with the scripts in `backend/scripts/` (for example `reingest_statutes.js`).

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

### 6. Run the Tests
```bash
cd backend
npm test            # offline unit suite, no keys needed
npm run benchmark   # LLM benchmark suites, needs .env
```
`backend/scripts/dev/` holds ad-hoc debug scripts from development; they also need `.env` and live services.

---

## 📡 API Endpoints Reference

| Category | Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- | :---: |
| **Auth** | `POST` | `/api/auth/register` | Register new user account | ❌ |
| **Auth** | `POST` | `/api/auth/login` | User authentication & JWT generation | ❌ |
| **Auth** | `GET` | `/api/auth/me` | Fetch current user profile & quota | ✅ |
| **Contracts**| `POST` | `/api/contracts` | Upload PDF/DOCX contract & initiate queue | ✅ |
| **Contracts**| `GET` | `/api/contracts` | List all user uploaded contracts | ✅ |
| **Contracts**| `GET` | `/api/contracts/:id` | Fetch contract analysis detail & progress | ✅ |
| **Contracts**| `GET` | `/api/contracts/:id/stream` | Server-sent progress updates | ✅ |
| **Contracts**| `DELETE` | `/api/contracts/:id` | Delete a contract and its clauses | ✅ |
| **Clauses** | `GET` | `/api/contracts/:id/clauses` | Retrieve parsed clause segments with agent outputs | ✅ |
| **Clauses** | `GET` | `/api/contracts/:id/risk-summary` | Contract-level risk summary | ✅ |
| **Export** | `GET` | `/api/contracts/:id/export-redline` | Download the redlined DOCX | ✅ |
| **Chat** | `POST` | `/api/contracts/:id/chat` | Ask questions about the contract (`agent5Chat.js`) | ✅ |
| **Payments** | `POST` | `/api/payments/create-order`| Generate Razorpay subscription order | ✅ |
| **Payments** | `POST` | `/api/payments/verify` | Verify Razorpay payment signature & update plan | ✅ |

---

## 🔐 Security & Production Hardening

- **Multipart Direct Memory Streaming**: Uses Multer memory buffers piped into MongoDB GridFS streams, so uploads never touch local disk and are not bound by the 16 MB BSON document limit.
- **Strict Key Hashing**: Password storage secured with `bcryptjs` using salt rounds = 10.
- **HTTP Hardening**: Configured with `helmet` for header security and `express-rate-limit` to prevent API abuse.
- **Deterministic ID Synchronization**: Clauses are keyed by their position in the document rather than by IDs the LLM echoes back, so agent results cannot be attached to the wrong clause.

---

<div align="center">
  <br />
  <p>Released under the <a href="LICENSE">MIT License</a>. LexGuard explains contracts; it is not legal advice.</p>
</div>
