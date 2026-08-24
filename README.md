# Maritime Sanctions Desk

A sanctions and vessel-intelligence desk for maritime counterparties. Intake a vessel, an entity, or a PDF; match against live OFAC and EU lists with an explainable audit trail; download a DOCX draft report.

Built as a working Phase 1 product: Next.js, Postgres, live list ingestion, and optional Anthropic-managed-agent sessions.

## What it does

- Next.js App Router workflow with vessel, entity, and PDF-led intake
- PostgreSQL-backed check history, match candidates, and source-version provenance
- Live OFAC import from the official Sanctions List Service
- EU official-first ingestion, with a labeled OpenSanctions fallback when direct official automation is unavailable
- Explainable matching with identifier, normalized-exact, and fuzzy review thresholds
- Public-data, best-effort vessel intelligence, with the limitation disclosed in the UI and the report
- DOCX draft report generation and download
- Anthropic Managed Agents session bootstrap when `ANTHROPIC_API_KEY`, `ANTHROPIC_MANAGED_AGENT_ID`, and `ANTHROPIC_ENVIRONMENT_ID` are set

Vessel intelligence in this version is intentionally limited to public/open-source data.

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

You need a reachable PostgreSQL instance for `prisma db push`, imports, and live checks. The repo includes a `docker-compose.yml` for local Postgres/Redis; any Postgres instance works if `DATABASE_URL` points at it.

Optional EU official access variables:

```bash
EU_FSF_OFFICIAL_URL=""
EU_FSF_COOKIE=""
EU_FSF_AUTHORIZATION=""
```

## Tests

Unit + integration (Jest, Node environment, no DB or network required — external calls are mocked):

```bash
npm test                 # all Jest suites
npm run test:unit        # normalize, matcher, analysis, parser, schema, format
npm run test:integration # mocked orchestrator pipeline and OFAC/EU importers
npm run test:coverage    # writes coverage/
```

End-to-end smoke tests (Playwright against a running app — needs Postgres via `DATABASE_URL`):

```bash
npm run test:e2e:install # one-time Chromium download
npm run test:e2e         # boots `next dev` and runs tests/e2e/*
npm run test:e2e:smoke   # smoke spec only
```

Playwright auto-starts `next dev` on port 3000 (override with `PLAYWRIGHT_PORT` or `PLAYWRIGHT_BASE_URL`). Set `PLAYWRIGHT_SKIP_WEBSERVER=1` to point at an already-running server.

## License

MIT — see [LICENSE](LICENSE).
