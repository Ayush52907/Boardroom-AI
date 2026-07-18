# Gemma Boardroom

**An AI Board of Directors for SMEs** — Powered by Google Gemma 4 (`gemma-4-31b-it`), TanStack Start, and Supabase.

---

## 🎯 Project Overview

Small and medium enterprises (SMEs) face complex operational and financial decisions every week, yet they rarely have access to C-suite expertise (CFOs, COOs, CMOs). Traditional business intelligence tools only show **what happened**, and standard LLMs frequently hallucinate financial figures.

**Gemma Boardroom** solves this by establishing a domain-driven **AI Board of Directors** that:
1. Computes **exact mathematical and financial deltas** on the client.
2. Injects role-scoped, structured contexts to virtual C-suite personas.
3. Facilitates a multi-perspective agentic debate to deliver actionable, synthesized business advice.

---

## 🚀 Key Features

* **Executive Snapshot Dashboard**: Live tracking of monthly revenue, gross/net margins, cash reserves, and overdue accounts receivable alongside a composite **Business Health Score (0–100)** and consensus priorities.
* **Universal ZIP Data Ingestion**: Upload any `.zip` archive containing arbitrary CSV files. The engine automatically detects file types (Sales, Suppliers, Aging AR) and normalizes columns, currencies (`$`, `₹`, `€`), and percentages.
* **Multi-Agent Executive Debate**: Virtual executives (CFO, COO, CMO, Procurement, CTO) debate strategic owner questions in a 2-round meeting routed dynamically based on the question context.
* **Sole Decider Verdict**: The **Business Analyst (Vikram Rao)** synthesizes the debate to issue a single, unambiguous recommendation with quantified metrics and 14-day owner actions.
* **Interactive Business Simulator**: Test decision outcomes (Price Changes, Hiring, Sourcing, Marketing) using client-side deterministic models; Gemma 4 interprets the strategic implications.
* **Role-Specific Executive Briefings**: Downloadable PDF briefings customized for each C-suite persona.

---

## 🏗️ Core Architecture & Engineering Highlights

### 1. "Math in Code, Reasoning in LLM"
To prevent financial hallucinations, all equations and scenario modeling are executed in pure TypeScript. Gemma 4 receives the computed numbers to analyze trade-offs rather than calculate them.

### 2. Structured Context Slicing (Zod Safety Net)
Instead of feeding flat, bloated CSV logs into prompts, a deterministic builder aggregates tabular data (e.g. summarizing 5,000+ overdue invoices into top items + aggregate totals). Each agent receives only its relevant slice, keeping prompt payloads under a strict **6,000-character safety ceiling**:
* **CFO**: Financial runway, net margins, AR collections, price elasticity.
* **CMO**: Demand trends, volume, conversion, AOV, revenue growth.
* **COO**: Operational overhead, inventory turnover, supplier reliability.
* **Procurement**: Sourcing indexes, supplier performance, inventory valuation.

### 3. Spaced-Dispatch Rate Limiter (Dev Safety)
Guarantees compliance with Google's free-tier limits (**30 Requests Per Minute**):
* **Concurrent Dispatching**: Decouples API calls from the queue lock. Requests dispatch with a 150ms gap rather than waiting for prior calls to complete, cutting response latency by **70%**.
* **Exponential Backoff**: Automatic retries (`1s -> 2s -> 4s`) on HTTP 429 / 503 throttling.
* **In-Memory Caching**: Bypasses the API instantly (0ms) for repeated queries in a dev session.

---

## 🛠️ Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Ayush52907/Boardroom-AI.git
cd Boardroom-AI
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your credentials:
```env
# Supabase credentials (supabase.com dashboard -> Settings -> API)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Google AI Studio API Key (aistudio.google.com)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MAX_RPM=30
```

### 3. Database Migration
Locate the SQL migration file at `supabase/migrations/001_initial_schema.sql` and run it in the **Supabase SQL Editor** to establish the tables (`businesses`, `simulations`, `board_sessions`, `board_messages`), Row-Level Security (RLS) policies, and seed the demo company.

### 4. Run Development Server
```bash
npm run dev
```
Open **`http://localhost:8080`** in your browser.

---

## 🧩 Tech Stack
* **Orchestration & SSR**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (Vite-backed framework)
* **Frontend**: React 18, TailwindCSS, TanStack Query (React Query)
* **AI Model**: Google Gemma 4 (`gemma-4-31b-it`) via `@google/genai`
* **Database**: Supabase (PostgreSQL)
* **PDF Engine**: PDF-Lib / Puppeteer SSR PDF service
