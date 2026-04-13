# Architecture Overview

This document serves as a critical, living template designed to equip agents with a rapid and comprehensive understanding of the codebase's architecture, enabling efficient navigation and effective contribution from day one. Update this document as the codebase evolves.

## 1. Project Structure

The project is a single Next.js (App Router) application — no split frontend/backend directories. Server-side logic lives alongside React components inside `src/`, with Next.js server actions and route handlers acting as the backend.

```
stanfordLaw/
├── src/
│   ├── app/                          # Next.js App Router (pages + API)
│   │   ├── layout.tsx                # Root layout, fonts, header/nav
│   │   ├── page.tsx                  # Landing page with check register
│   │   ├── globals.css               # Tailwind v4 styles
│   │   ├── checks/
│   │   │   ├── new/
│   │   │   │   ├── page.tsx          # Intake form page (vessel/entity/pdf)
│   │   │   │   └── actions.ts        # Server action: submitCheck
│   │   │   └── [id]/page.tsx         # Single check detail view
│   │   ├── instructions/page.tsx     # How-to page; links to /checks/new
│   │   ├── build-notes/page.tsx      # Prototype scope + intake-handling notes
│   │   ├── history/page.tsx          # Prior run list
│   │   └── api/
│   │       └── checks/
│   │           ├── route.ts          # GET /api/checks (summaries)
│   │           └── [id]/
│   │               ├── route.ts      # GET /api/checks/:id
│   │               └── report/route.ts # GET /api/checks/:id/report (DOCX/PDF download)
│   ├── components/                   # React components (forms, live refresh, pills, country combobox)
│   ├── lib/                          # Server-side domain logic
│   │   ├── agents/
│   │   │   ├── orchestrator.ts       # Pipeline driver: intake → sources → match → report
│   │   │   └── managed-agents.ts     # Anthropic Managed Agents session bootstrap
│   │   ├── checks/
│   │   │   ├── analysis.ts           # Builds findings, citations, pipeline, summary
│   │   │   ├── parser.ts             # FormData → CheckSubmission
│   │   │   ├── repository.ts         # Prisma read/write for Check records
│   │   │   ├── schema.ts             # Zod schemas + action state types
│   │   │   └── types.ts              # Domain types (CheckRecord, MatchCandidate, …)
│   │   ├── sanctions/
│   │   │   ├── importers.ts          # OFAC XML + EU CSV ingestion & persistence
│   │   │   ├── matcher.ts            # Screening: identifier/exact/fuzzy candidates
│   │   │   └── normalize.ts          # Name/identifier normalization helpers
│   │   ├── report/generator.ts       # DOCX draft-report generation
│   │   ├── storage/fs-store.ts       # Local filesystem store (.data/)
│   │   ├── vessel-intel/demo-scenarios.ts # Synthetic vessel-intel scenarios
│   │   ├── countries.ts              # ISO 3166-1 country list + flag emoji helpers
│   │   ├── db.ts                     # Prisma client singleton (PG adapter)
│   │   ├── queue.ts                  # Optional BullMQ/Redis queue (unused by default)
│   │   ├── format.ts                 # Display formatting utilities
│   │   └── utils.ts                  # Shared utilities
│   └── scripts/
│       └── import-sanctions.ts       # CLI entry: refresh OFAC + EU source versions
├── prisma/
│   └── schema.prisma                 # PostgreSQL schema (Check, SourceVersion, SanctionsEntry, MatchCandidate)
├── public/                           # Static SVG assets
├── .data/                            # Runtime-generated (uploaded PDFs, generated reports) — gitignored
├── docker-compose.yml                # Local Postgres + Redis
├── next.config.ts, eslint.config.mjs, postcss.config.mjs, tsconfig.json, prisma.config.ts
├── package.json                      # Scripts: dev, build, typecheck, prisma:*, sanctions:import
├── PLAN.md                           # Product plan
├── README.md                         # Quick start
├── AGENTS.md / CLAUDE.md             # Agent instructions
└── ARCHITECTURE.md                   # This document
```

## 2. High-Level System Diagram

```
                     ┌─────────────────────────────────┐
                     │  User (lawyer / reviewer)       │
                     └──────────────┬──────────────────┘
                                    │ browser
                                    ▼
                  ┌─────────────────────────────────────┐
                  │  Next.js App Router (single app)    │
                  │  - React pages (RSC)                │
                  │  - Server Actions (submitCheck)     │
                  │  - Route Handlers (/api/checks/*)   │
                  └──────┬──────────────────┬───────────┘
                         │                  │
      orchestrator       │                  │ report download
      (in-process)       ▼                  ▼
      ┌────────────────────────┐     ┌──────────────────────┐
      │ Check Orchestrator     │     │ .data/ filesystem    │
      │ src/lib/agents         │     │ (uploaded PDFs +     │
      │  - intake normalization│     │  generated DOCX/PDF) │
      │  - sanctions matcher   │     └──────────────────────┘
      │  - report generator    │
      └──┬──────────┬──────────┘
         │          │
         │          └──────────────┐
         ▼                         ▼
 ┌───────────────────┐   ┌────────────────────────────┐
 │ PostgreSQL        │   │ External data sources      │
 │ (Prisma)          │   │  - OFAC SDN XML (official) │
 │  - Check          │   │  - EU FSF (official/fb)    │
 │  - SourceVersion  │◄──│  - OpenSanctions (fallback)│
 │  - SanctionsEntry │   └────────────────────────────┘
 │  - MatchCandidate │
 └───────────────────┘

 Optional:
   Anthropic Managed Agents API (session bootstrap) — when env vars configured
   Redis + BullMQ (queue scaffolded in src/lib/queue.ts, not wired into the main flow)
```

Flow: the user submits an intake form → a server action creates a `Check` shell in Postgres, then schedules the orchestrator to run after the response via `after()`. The orchestrator refreshes sanctions source versions (OFAC/EU), runs matching, derives linked-party subjects for vessel matches, builds findings + citations, writes the DOCX report to `.data/`, and finalizes the record. The client polls via the live-refresh component until status is `completed` or `failed`.

## 3. Core Components

### 3.1. Frontend (co-located in the Next.js app)

- **Name:** Maritime Sanctions Desk (web UI)
- **Description:** Server-rendered React UI for creating checks (vessel, entity, or PDF intake), watching a check progress through its pipeline, reviewing match candidates/findings/citations, and downloading a draft report. Key components: `check-intake-form.tsx`, `check-live-refresh.tsx`, `status-pill.tsx`, `submit-button.tsx`, `country-combobox.tsx` (flag-emoji autocomplete backed by `src/lib/countries.ts`).
- **Technologies:** Next.js 16 (App Router, React Server Components), React 19, TypeScript, Tailwind CSS v4, `lucide-react` icons, Google Fonts (`Cormorant_Garamond`, `Source_Sans_3`).
- **Deployment:** Runs as a single Next.js server (`next start`). No deployment target is configured in-repo.

### 3.2. Backend Services

The backend is not split into microservices — it is the server-side half of the same Next.js app.

#### 3.2.1. Check Orchestrator

- **Name:** Check Orchestrator (`src/lib/agents/orchestrator.ts`)
- **Description:** Drives a check through its stages (`queued → sources → matching → report`). Creates the `Check` shell, refreshes sanctions source versions, runs primary + derived linked-party matching, builds findings/citations/pipeline artifacts, and generates the DOCX report. Invoked in-process from a server action via `next/server`'s `after()`.
- **Technologies:** TypeScript, Prisma, domain modules in `src/lib/*`.
- **Deployment:** In-process within the Next.js server.

#### 3.2.2. Sanctions Importers

- **Name:** Sanctions Importers (`src/lib/sanctions/importers.ts`)
- **Description:** Fetches OFAC SDN XML from the official Sanctions List Service and EU Financial Sanctions data (official-first with OpenSanctions fallback), parses entries, normalizes names/identifiers, and persists `SourceVersion` + `SanctionsEntry` rows. Runnable as a CLI (`npm run sanctions:import`) or lazily from the orchestrator (24-hour freshness gate).
- **Technologies:** `fast-xml-parser`, `csv-parse`, `fetch`, `transliteration`, Prisma.
- **Deployment:** In-process and via `tsx` CLI script.

#### 3.2.3. Sanctions Matcher

- **Name:** Sanctions Matcher (`src/lib/sanctions/matcher.ts`)
- **Description:** Builds `MatchCandidate`s from screening subjects against stored sanctions entries using identifier-exact, normalized-name-exact, and fuzzy (Levenshtein) strategies — each candidate carries explainable `reasons`.
- **Technologies:** `fastest-levenshtein`, TypeScript.

#### 3.2.4. Report Generator

- **Name:** Draft Report Generator (`src/lib/report/generator.ts`)
- **Description:** Produces a downloadable `.docx` draft report (via `docx`) or PDF (via `pdfkit`) summarizing findings, match reasons, vessel intelligence coverage/limitations, and citations. Output written to `.data/` and exposed through `/api/checks/:id/report`.
- **Technologies:** `docx`, `pdfkit`.

#### 3.2.5. Anthropic Managed Agents Client (optional)

- **Name:** Managed Agents Bootstrap (`src/lib/agents/managed-agents.ts`)
- **Description:** When `ANTHROPIC_API_KEY`, `ANTHROPIC_MANAGED_AGENT_ID`, and `ANTHROPIC_ENVIRONMENT_ID` are present, creates a Managed Agents session (`POST /v1/sessions`) and seeds it with the intake payload. If absent or failing, the orchestrator silently falls back to the local execution path.
- **Technologies:** Anthropic REST API (beta header `managed-agents-2026-04-01`), `@anthropic-ai/sdk` dependency present but the call uses raw `fetch`.

## 4. Data Stores

### 4.1. Primary Relational Store

- **Name:** Application Postgres
- **Type:** PostgreSQL 16 (via Prisma 7 + `@prisma/adapter-pg`)
- **Purpose:** Stores check runs, sanctions source versions with provenance checksums, normalized sanctions entries, and explainable match candidates. Connection is configured by `DATABASE_URL` (defaults to the local `docker-compose` Postgres).
- **Key Models:**
  - `Check` — a user's screening run (mode, status, subjects, pipeline, findings, report sections, vessel-intel, source versions, citations, agent-run metadata, `docxPath`).
  - `SourceVersion` — an imported dataset snapshot (`source` ofac/eu, `sourceMode` official/fallback, `checksum`, `fetchedAt`, `publishedAt`, `entryCount`).
  - `SanctionsEntry` — a normalized record from a `SourceVersion` (primary name, aliases, identifiers, addresses, countries, birth dates, sanctions programs, raw JSON).
  - `MatchCandidate` — a screening hit linking a `Check` to a `SanctionsEntry` with score, strength (`exact`/`strong`/`review`), and reasons.

### 4.2. Local Filesystem Store

- **Name:** `.data/` directory (`src/lib/storage/fs-store.ts`)
- **Type:** Local filesystem (root overridable via `STORAGE_ROOT`).
- **Purpose:** Holds uploaded PDFs and generated DOCX/PDF report artifacts. Paths are stored on `Check.docxPath` and referenced by the report download route.

### 4.3. Redis / BullMQ (optional, scaffolded)

- **Name:** Checks Queue (`src/lib/queue.ts`)
- **Type:** Redis 7 + BullMQ.
- **Purpose:** Scaffolded for background check execution. Currently the orchestrator runs in-process via Next's `after()`; the queue is only instantiated when `REDIS_URL` is set and is not wired into the submission flow yet.

## 5. External Integrations / APIs

- **OFAC Sanctions List Service** — Purpose: Source of record for U.S. OFAC SDN list. Integration: HTTPS fetch of `SDN.XML` (`https://sanctionslistservice.ofac.treas.gov/…`).
- **EU Financial Sanctions Database (data.europa.eu)** — Purpose: Source of record for EU consolidated sanctions. Integration: REST metadata lookup + CSV download; optionally authenticated via `EU_FSF_OFFICIAL_URL`, `EU_FSF_COOKIE`, `EU_FSF_AUTHORIZATION`.
- **OpenSanctions (EU FSF mirror)** — Purpose: Labeled fallback when direct EU automation is unavailable (`EU_FSF_FALLBACK_URL`, default `https://data.opensanctions.org/.../eu_fsf/targets.simple.csv`).
- **Anthropic Managed Agents API** — Purpose: Optional session-backed agent execution. Integration: REST (`POST /v1/sessions`, `POST /v1/sessions/:id/events`) with `anthropic-beta: managed-agents-2026-04-01`.

## 6. Deployment & Infrastructure

- **Cloud Provider:** Not configured in-repo. Runs anywhere Node.js + PostgreSQL are available.
- **Key Services Used (local):** `docker-compose.yml` provides Postgres 16 and Redis 7 for development.
- **CI/CD Pipeline:** None in-repo (no `.github/` present at time of writing).
- **Monitoring & Logging:** None configured; errors are logged via `console.warn` (e.g., EU official import fallback) and surfaced through the `Check.status = failed` state.

## 7. Security Considerations

- **Authentication:** None in the application — there is no login, session, or multi-tenant boundary. The app is a single-user prototype.
- **Authorization:** None — all endpoints and pages are open to any caller with access to the running server.
- **Data Encryption:** TLS is used for outbound fetches to OFAC/EU/OpenSanctions/Anthropic. No at-rest encryption is configured beyond what the host Postgres/filesystem provide.
- **Secrets Handling:** Secrets (`DATABASE_URL`, `ANTHROPIC_*`, `EU_FSF_*`, `REDIS_URL`, `STORAGE_ROOT`) are read from environment via `.env`.
- **Provenance & Integrity:** Each imported dataset is hashed (SHA-256 over raw bytes) and stored as a `SourceVersion` — checks cite the specific `SourceVersion` used, so findings are reproducible against a known snapshot.
- **Key Security Tools/Practices:** None beyond standard Next.js defaults and ESLint.

## 8. Development & Testing Environment

- **Local Setup:** See `README.md` — `npm install`, copy `.env.example` to `.env`, `npm run prisma:generate`, `npm run prisma:push`, `npm run sanctions:import`, `npm run dev`. A local Postgres (and optional Redis) is available via `docker-compose up`.
- **Scripts:** `dev`, `build`, `start`, `lint` (ESLint), `typecheck` (`tsc --noEmit`), `prisma:generate`, `prisma:push`, `sanctions:import`.
- **Testing Frameworks:** None installed — no test suite exists in the repo.
- **Code Quality Tools:** ESLint (`eslint-config-next`), TypeScript strict typing, Tailwind v4.

## 9. Future Considerations / Roadmap

- Wire the BullMQ queue in `src/lib/queue.ts` into the submission flow so orchestration runs out of the request lifecycle and can retry on failure.
- Upgrade EU ingestion from the OpenSanctions fallback to full official automation once credentialed session access (`EU_FSF_COOKIE` / `EU_FSF_AUTHORIZATION`) is provisioned.
- Expand vessel intelligence beyond best-effort public data — integrate a paid AIS/ownership provider and replace the synthetic demo scenarios in `src/lib/vessel-intel/demo-scenarios.ts`.
- Add authentication and multi-tenant authorization before any non-prototype use.
- Add automated tests (unit for matcher/normalize, integration for the orchestrator pipeline).
- See `PLAN.md` for the product roadmap across phases.

## 10. Project Identification

- **Project Name:** Maritime Sanctions Desk (package name: `stanford-law`)
- **Repository URL:** Local repository at `/home/joshu/code/stanfordLaw` (no remote URL recorded here).
- **Primary Contact/Team:** Joshua Sorkin (git author).
- **Date of Last Update:** 2026-04-12

## 11. Glossary / Acronyms

- **OFAC:** U.S. Treasury Office of Foreign Assets Control — administers the SDN list.
- **SDN:** Specially Designated Nationals and Blocked Persons List (OFAC).
- **EU FSF:** European Union Financial Sanctions Files / Database — consolidated list of persons, groups, and entities subject to EU financial sanctions.
- **AIS:** Automatic Identification System — vessel tracking broadcast system.
- **IMO:** International Maritime Organization; here, the unique IMO vessel number.
- **STS:** Ship-to-ship (transfer) — a common sanctions-evasion pattern surfaced in vessel intel.
- **RSC:** React Server Components (Next.js App Router default).
- **Managed Agents:** Anthropic's managed agent execution API (beta).
- **Check:** A single screening run created by a user (vessel, entity, or PDF-led).
- **SourceVersion:** A dated, checksummed snapshot of an imported sanctions dataset.
- **MatchCandidate:** A scored, explainable link between a `Check` subject and a `SanctionsEntry`.
- **Match strength:** `exact` (identifier/normalized-name match), `strong` (high fuzzy score), `review` (below auto-confirm threshold, needs human review).
