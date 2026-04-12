# Maritime Sanctions Desk

Phase 1 workspace for a maritime sanctions and vessel-intelligence platform.

## Current build

- Next.js app-router workflow with vessel, entity, and PDF-led intake
- PostgreSQL-backed check history, match candidates, and source-version provenance
- Live OFAC import from the official Sanctions List Service
- EU official-first ingestion with a labeled fallback path via OpenSanctions when direct official automation is unavailable
- Explainable sanctions matching with identifier, normalized exact, and fuzzy review thresholds
- Public-data best-effort vessel intelligence coverage with explicit limitations
- DOCX draft report generation and download
- Anthropic Managed Agents session bootstrap when `ANTHROPIC_API_KEY`, `ANTHROPIC_MANAGED_AGENT_ID`, and `ANTHROPIC_ENVIRONMENT_ID` are configured

## Local setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:push
npm run sanctions:import
npm run dev
```

The app stores uploaded PDFs and generated reports under `.data/`.

You need a reachable PostgreSQL instance for `prisma db push`, imports, and live check execution. The repo includes a `docker-compose.yml` for local Postgres/Redis, but any Postgres instance will work as long as `DATABASE_URL` points to it.

Optional EU official access variables:

```bash
EU_FSF_OFFICIAL_URL=""
EU_FSF_COOKIE=""
EU_FSF_AUTHORIZATION=""
```

## Phase One shape

Phase One now covers formal sanctions through vessel intelligence, with PDF upload as a first-class intake path. Vessel intelligence is intentionally limited to public/open-source best effort in this version and discloses that limitation in the UI and report output.
