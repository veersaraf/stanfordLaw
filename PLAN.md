# Maritime Sanctions Check Platform — Comprehensive Plan

## 1. Product Overview

A SaaS web application that enables maritime lawyers, ship brokers, ship owners, and in-house bank counsel to run comprehensive sanctions and risk checks on **vessels**, **individuals**, and **companies**. The system checks formal sanctions lists, performs pre-sanctions risk intelligence (adverse media, corporate network analysis, PEP screening, leaked databases), and tracks vessel behavior — then produces a Word (.docx) draft report with citations for the lawyer to review and finalize.

**Key differentiator:** Unlike tools such as Pole Star that only do vessel tracking and formal sanctions matching, this platform provides a **pre-sanctions intelligence layer** — identifying high-risk connections, adverse media, and network associations *before* a person or entity is formally listed.

---

## 2. Users & Use Cases

### User Personas (priority order)
1. **Maritime lawyers** — Check sanctions when clients buy/sell ships, onboard new counterparties (charterers, brokers)
2. **In-house bank counsel** — Sanctions screening for client onboarding at financial institutions
3. **Ship brokers** — Due diligence on counterparties before deals
4. **Ship owners** — Verify charterers and business partners

### Core Use Cases
| Use Case | Input | What Gets Checked |
|---|---|---|
| Ship sale/purchase | BIMCO SSA 22 form fields (manual entry) | Vessel + seller + buyer + guarantor |
| New counterparty onboarding | Company name / person name / address / company number | Entity + individuals + corporate network |
| Charter party check | Charterer details | Entity + beneficial owners + vessel history |
| Bank client onboarding | Company / individual details | Entity + individuals + PEP + adverse media |

### Account Model
- Single-user accounts
- Each user can save and revisit past searches

---

## 3. Input — Manual Data Entry + PDF Upload

### Check Type A: Vessel + Transaction Check
Fields from BIMCO Ship Sale 22 form:
- Vessel name
- IMO number
- Gross tonnage, net tonnage
- Year built, place of build
- Vessel flag/registry
- Classification society & class notation
- Date of agreement
- Seller name
- Buyer name
- Seller's guarantor (if applicable)
- Deposit holder
- Seller's account
- Banking days
- Delivery place and range

### Check Type B: Entity / Individual Check
Minimum required (any one of):
- Name
- Address
- Company registration number

Optional enrichment fields:
- Country of incorporation/nationality
- Date of birth (for individuals)
- Known aliases

### Check Type C: PDF-Led Intake
- Upload a single transaction PDF
- Extract vessel and counterparty details where possible
- Let the reviewer supplement any missing fields before or after extraction

### No bulk upload — one check at a time.

---

## 4. Sanctions & Formal Lists

### Lists to Check (priority order)
| Priority | List | Source | Format |
|---|---|---|---|
| 1 | **US OFAC SDN** | treasury.gov | XML/CSV, free |
| 2 | **EU Consolidated Sanctions** | data.europa.eu | XML, free |
| 3 | **UN Security Council** | un.org | XML, free |
| 4 | **UK OFSI** | gov.uk | CSV/ODS, free |
| 5 | **Australia DFAT** | dfat.gov.au | XLSX, free |
| 6 | **Canada SEMA** | international.gc.ca | XML, free |
| 7 | **Switzerland SECO** | seco.admin.ch | XML, free |
| 8 | **Countries sanctioning Israel** | Curated/maintained | Manual |
| 9 | **Other country-specific lists** | Various | Various |

### Refresh Strategy
- **Daily automated download** of all lists
- Store locally in normalized database schema
- Track list versions and update timestamps
- Maintain history of past listings (for delisted entity detection)

### Matching Strategy
- **High sensitivity** — a missed match could cost millions
- Fuzzy name matching using Levenshtein distance, Soundex, phonetic algorithms
- Transliteration support for Arabic, Farsi, Russian, Greek names
- Flag partial matches with confidence scores
- Flag **previously sanctioned but now delisted** entities
- Match against: names, aliases, IMO numbers, company registration numbers, addresses

---

## 5. Vessel Intelligence

### AIS Data Provider
**Recommended: Spire Maritime** (best cost/coverage ratio for API-first use)
- Alternatives evaluated: MarineTraffic (expensive), VesselFinder (limited API), Windward (expensive, overkill), Pole Star (limited)
- Spire offers: historical AIS, vessel tracking, port calls, dark period detection
- Pricing: usage-based, ~$0.01-0.10 per vessel query (negotiable)

**Fallback/supplement: UN Comtrade + OpenAIS + public AIS sources** for cost reduction.

### What to Check on Vessels
1. **Port call history** (5 years back)
2. **AIS dark periods** — signal gaps indicating intentional concealment
3. **Unexplained stationary periods** — anchored in unusual locations
4. **Ship-to-ship (STS) transfers** — prolonged proximity to other vessels
5. **Entry into red-flag waters:**
   - Russia
   - Venezuela
   - Ukraine (conflict zones)
   - Cuba
   - North Korea
   - Iran
   - Libya
   - Lebanon
   - South Sudan

### Entity Checks Per Vessel (all checked separately)
1. Vessel itself (IMO, flag, class)
2. Registered owner
3. Beneficial owner
4. Operator
5. Manager/ISM manager
6. Cross-reference connections between all five against sanctions + risk databases

---

## 6. Pre-Sanctions Risk Intelligence (Key Differentiator)

### 6.1 Adverse Media Screening
**Sources:**
- Google News API (multi-language: English, Greek, Arabic, Farsi, Spanish)
- GDELT Project (free global news database)
- Investigative journalism: OCCRP, ICIJ, Global Witness, Reuters Investigates
- Court records where publicly available

**How it works:**
- Search entity/individual name + aliases across all sources
- Filter for sanctions-related, corruption, money laundering, fraud, smuggling keywords
- Return summarized findings with source citations
- Multi-language search (EN, EL, AR, FA, ES)

### 6.2 Corporate Ownership & Network Analysis
**Sources (least-cost priority):**
- **OpenSanctions** (free, open-source, aggregates 80+ sources)
- **OpenCorporates** (free tier + paid API for deeper data)
- **Sayari Analytics** (paid, best for network/relationship mapping)
- **Orbis / Bureau van Dijk** (expensive, gold standard — consider later)

**What to check:**
- Beneficial ownership chains
- Directors, shareholders, officers
- **2nd and 3rd degree connections** to sanctioned entities
  - 1st degree: directly connected (shared director, direct ownership)
  - 2nd degree: connected through one intermediary
  - 3rd degree: connected through two intermediaries
- Shell company indicators (registered in secrecy jurisdictions, nominee directors)
- Recently formed entities with thin corporate history

### 6.3 PEP (Politically Exposed Persons) Screening
**Sources:**
- OpenSanctions PEP dataset (free)
- EveryPolitician dataset (free)
- National PEP lists where available

**What to check:**
- Is the individual a current or former PEP?
- Are they related to or closely associated with a PEP?
- Flag but don't block — PEP status is a risk indicator, not a prohibition

### 6.4 ICIJ Leaked Databases
**Sources (all free/public):**
- Panama Papers
- Pandora Papers
- Paradise Papers
- FinCEN Files
- Offshore Leaks database

**What to check:**
- Name matches in any leaked dataset
- Connected entities in leaked structures

### 6.5 Delisted Entity Tracking
- Maintain historical records of previously sanctioned entities
- Flag if an entity was previously on any list, even if currently delisted
- Include date listed, date delisted, reason if available

---

## 7. Report Output

### Format
- **Microsoft Word (.docx)** — generated as a draft
- The lawyer reviews, edits, and finalizes before sending to client
- Structured compliance report format (not formal legal memo)

### Report Structure
```
1. EXECUTIVE SUMMARY
   - Check type (vessel/entity/individual)
   - Date of check
   - Subject(s) checked
   - Key findings summary

2. FORMAL SANCTIONS CHECK
   - For each entity/vessel/individual checked:
     - List checked | Match found (Y/N) | Details | Citation
   - Delisted entity matches (if any)

3. VESSEL INTELLIGENCE (if applicable)
   - Port call history (5 years) with red-flag ports highlighted
   - AIS anomalies (dark periods, stationary periods, STS transfers)
   - Red-flag water entries with dates and durations
   - Registered owner / beneficial owner / operator / manager checks

4. PRE-SANCTIONS RISK INTELLIGENCE
   - Adverse media findings with source citations
   - Corporate network analysis
     - Ownership structure
     - 1st/2nd/3rd degree connections to sanctioned entities
   - PEP screening results
   - ICIJ database matches
   - Previously delisted entity matches

5. SOURCES & CITATIONS
   - Every finding cited with:
     - Source name
     - URL/reference
     - Date accessed
```

### No risk rating — the system outputs findings and the lawyer makes the call.

---

## 8. Technical Architecture

### Stack
| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS | Fast SaaS development, SSR for SEO |
| **Backend** | Next.js API routes + Python worker services | Next.js for API, Python for data processing/NLP |
| **Database** | PostgreSQL + pgvector | Relational data + fuzzy text search |
| **Task Queue** | Redis + BullMQ | Orchestrate long-running check agents |
| **File Generation** | python-docx | Word report generation |
| **Hosting** | Vercel (frontend) + Railway/Fly.io (Python workers) | Low cost, scalable |
| **Sanctions Data** | Daily cron job downloads → PostgreSQL | Normalized local copies |
| **Agent Runtime** | Anthropic Claude Managed Agents | Session-based orchestration in managed infrastructure |

### Agent Architecture
Each check can spawn **Anthropic Claude Managed Agent sessions** for long-running orchestration, with a local prototype fallback path during development:

```
User submits check
        │
        ▼
   ┌─────────────┐
   │  Orchestrator │
   └──────┬──────┘
          │ spawns parallel agents
          ▼
  ┌───────────────────────────────────────────────┐
  │                                               │
  ▼           ▼           ▼           ▼           ▼
┌─────┐  ┌─────────┐  ┌──────┐  ┌───────┐  ┌─────────┐
│Sanc- │  │ Vessel  │  │Adverse│  │Network│  │  PEP /  │
│tions │  │  AIS    │  │Media  │  │Analysis│  │  ICIJ   │
│Lists │  │Tracking │  │Search │  │Corps  │  │ Search  │
└──┬──┘  └───┬─────┘  └──┬───┘  └──┬────┘  └───┬─────┘
   │         │           │         │            │
   ▼         ▼           ▼         ▼            ▼
  ┌───────────────────────────────────────────────┐
  │            Results Aggregator                  │
  └──────────────────┬────────────────────────────┘
                     │
                     ▼
              ┌─────────────┐
              │Report Generator│
              │  (.docx)      │
              └───────────────┘
```

### Data Flow
1. User enters data via web form
2. Orchestrator validates input and spawns agents
3. Each agent queries its data source(s) independently
4. Results stream back to the aggregator as they complete
5. User sees a progress indicator per agent
6. When all agents complete, report generator produces .docx
7. User downloads draft report
8. Check and report are saved to user's history

---

## 9. Data Sources & Cost Estimates

### Free / Open Sources
| Source | Data | Cost |
|---|---|---|
| OFAC SDN | US sanctions | Free |
| EU Consolidated List | EU sanctions | Free |
| UN SC Consolidated List | UN sanctions | Free |
| UK OFSI | UK sanctions | Free |
| OpenSanctions | Aggregated sanctions + PEP + corporate | Free (open-source) |
| ICIJ Offshore Leaks DB | Panama/Pandora Papers etc. | Free |
| GDELT | Global news events | Free |
| OpenCorporates | Company data | Free tier (limited) |
| EveryPolitician | PEP data | Free |

### Paid APIs (least-cost options)
| Source | Data | Est. Cost |
|---|---|---|
| Spire Maritime API | AIS, port calls, vessel tracking | ~$500-2000/mo depending on volume |
| Google Custom Search API | News search | $5 per 1000 queries |
| OpenCorporates API | Deep corporate data | ~$500/mo |
| Sayari Analytics | Network/relationship mapping | ~$1000+/mo (negotiate) |

### Total Estimated Monthly API Costs
- **MVP (low volume):** ~$200-500/mo (Spire basic + Google Search + OpenSanctions free tier)
- **Growth:** ~$2000-5000/mo (full Spire + OpenCorporates + Sayari)

---

## 10. Implementation Phases

### Phase 1 — MVP + Vessel Intelligence Foundation (Weeks 1-7)
**Goal:** Working sanctions checker with vessel intelligence included from the first build

- [ ] Project scaffolding (Next.js + PostgreSQL + Redis)
- [ ] Manual data entry forms (vessel check + entity check)
- [ ] PDF upload + extraction intake path
- [ ] Sanctions list ingestion pipeline (OFAC, EU, UN, UK)
- [ ] Daily refresh cron job for sanctions lists
- [ ] Fuzzy name matching engine (high sensitivity)
- [ ] Basic sanctions check results page
- [ ] Spire Maritime API integration
- [ ] Port call history (5 years)
- [ ] AIS dark period detection
- [ ] STS transfer detection (vessel proximity analysis)
- [ ] Red-flag waters entry detection
- [ ] Vessel ownership chain resolution (owner, beneficial owner, operator, manager)
- [ ] Cross-check all vessel-related entities against sanctions
- [ ] Word (.docx) report generation — sanctions section only
- [ ] Search history (save & revisit)
- [ ] Add vessel intelligence section to report

### Phase 2 — Pre-Sanctions Intelligence (Weeks 8-11)
**Goal:** The differentiator — adverse media, network analysis, PEP, ICIJ

- [ ] Adverse media search engine (Google News + GDELT + OCCRP)
- [ ] Multi-language search (EN, EL, AR, FA, ES)
- [ ] AI-powered relevance filtering (discard irrelevant results)
- [ ] Corporate network analysis (OpenSanctions + OpenCorporates)
- [ ] 2nd and 3rd degree connection mapping
- [ ] PEP screening
- [ ] ICIJ leaked database search
- [ ] Delisted entity tracking
- [ ] Add pre-sanctions intelligence section to report

### Phase 3 — Polish & Launch (Weeks 12-14)
**Goal:** Production-ready SaaS

- [ ] Agent orchestration with progress indicators
- [ ] Full report generation with all sections and citations
- [ ] UI/UX polish
- [ ] Error handling and edge cases
- [ ] Stripe billing integration
- [ ] Landing page
- [ ] Deploy to production

---

## 11. Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| PDF upload | Yes | Manual entry plus document-led intake |
| Bulk checks | No | One check at a time |
| Risk rating | No | Lawyer makes the call, system just provides data |
| Ongoing monitoring | No | One-time checks only |
| Audit trail | No | Not required for MVP |
| Data residency | No constraints | Cloud storage acceptable |
| Multi-language | 5 languages for adverse media | EN, EL, AR, FA, ES |
| Match sensitivity | Maximum | False positives preferred over false negatives |
| History lookback | 5 years | For vessel AIS and port history |
| Connection depth | 3 degrees | For corporate network analysis |

---

## 12. File Structure (Planned)

```
StanfordLaw/
├── PLAN.md                          # This file
├── README.md
├── package.json
├── next.config.ts
├── tsconfig.json
├── prisma.config.ts
├── prisma/
│   └── schema.prisma                # Database schema
├── src/
│   ├── app/                         # Next.js app router
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Landing / dashboard
│   │   ├── checks/
│   │   │   ├── new/                 # New check forms
│   │   │   │   ├── vessel/          # Vessel + transaction check
│   │   │   │   └── entity/          # Entity / individual check
│   │   │   └── [id]/               # Check results & report
│   │   └── history/                 # Past checks
│   ├── components/                  # UI components
│   ├── lib/
│   │   ├── db.ts                    # Database client
│   │   ├── queue.ts                 # BullMQ task queue
│   │   └── report/
│   │       └── generator.ts         # .docx report builder
│   └── agents/                      # Check agents
│       ├── orchestrator.ts          # Spawns and coordinates agents
│       ├── sanctions/               # Formal sanctions list checks
│       │   ├── ofac.ts
│       │   ├── eu.ts
│       │   ├── un.ts
│       │   └── matcher.ts           # Fuzzy matching engine
│       ├── vessel/                  # AIS + vessel intelligence
│       │   ├── ais.ts
│       │   ├── portHistory.ts
│       │   ├── darkPeriods.ts
│       │   └── stsTransfers.ts
│       ├── media/                   # Adverse media search
│       │   ├── googleNews.ts
│       │   ├── gdelt.ts
│       │   └── relevanceFilter.ts
│       ├── network/                 # Corporate network analysis
│       │   ├── openSanctions.ts
│       │   ├── openCorporates.ts
│       │   └── connectionMapper.ts
│       └── pep/                     # PEP + ICIJ checks
│           ├── pepScreen.ts
│           └── icij.ts
├── workers/                         # Python worker services
│   ├── sanctions_ingester/          # Daily sanctions list download
│   ├── name_matcher/                # Fuzzy matching (Python for NLP)
│   └── report_generator/            # python-docx report builder
└── docker-compose.yml               # Local dev (Postgres + Redis)
```

---

## 13. Open Questions / Decisions Needed

1. **Pricing model** — Per check? Monthly subscription? Tiered?
2. **Product name** — Need a name for the platform
3. **Spire Maritime** vs alternatives — Need to evaluate API access and pricing
4. **Sayari Analytics** — Worth the cost for network mapping, or start with OpenSanctions only?
5. **AI summarization** — Use an LLM to summarize adverse media findings in the report, or just list raw results?
6. **Demo data** — Do we need sample/demo checks for sales presentations?
