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

## Tests

Unit + integration (Jest, Node environment, no DB or network required — external calls are mocked):

```bash
npm test                 # runs all jest suites
npm run test:unit        # pure logic: normalize, matcher, analysis, parser, schema, format
npm run test:integration # mocked orchestrator pipeline and OFAC/EU importer parsers
npm run test:coverage    # writes coverage/ (src/lib excluding db.ts and queue.ts)
```

End-to-end smoke tests (Playwright against a running app — needs Postgres reachable via `DATABASE_URL`):

```bash
npm run test:e2e:install # one-time Chromium browser download
npm run test:e2e         # boots `next dev` via playwright.config.ts and runs tests/e2e/*
npm run test:e2e:smoke   # just the smoke spec
```

Playwright auto-starts `next dev` on port 3000 (override with `PLAYWRIGHT_PORT` or `PLAYWRIGHT_BASE_URL`). Set `PLAYWRIGHT_SKIP_WEBSERVER=1` to point at an already-running server.

## Phase One shape

Phase One now covers formal sanctions through vessel intelligence, with PDF upload as a first-class intake path. Vessel intelligence is intentionally limited to public/open-source best effort in this version and discloses that limitation in the UI and report output.
