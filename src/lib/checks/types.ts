export type CheckMode = "vessel" | "entity" | "pdf";

export type CheckStatus = "draft" | "running" | "completed" | "failed";

export type CheckSeverity = "clear" | "watch" | "high";

export type PipelineStepStatus =
  | "complete"
  | "attention"
  | "pending"
  | "not_applicable";

export type SanctionsSource = "ofac" | "eu";

export type SourceMode = "official" | "fallback";

export type MatchStrength = "exact" | "strong" | "review";

export interface PipelineStep {
  key: string;
  label: string;
  status: PipelineStepStatus;
  detail: string;
}

export interface Citation {
  id: string;
  label: string;
  url: string;
  kind: "sanctions" | "vessel" | "upload" | "system" | "report";
  accessedAt?: string;
  sourceVersionId?: string;
  sourceMode?: SourceMode;
}

export interface Finding {
  id: string;
  title: string;
  severity: CheckSeverity;
  summary: string;
  rationale: string;
  relatedMatchIds?: string[];
}

export interface ReportSection {
  title: string;
  body: string;
}

export interface MatchReason {
  code: string;
  detail: string;
}

export interface MatchCandidate {
  id: string;
  source: SanctionsSource;
  sourceMode: SourceMode;
  sourceVersionId: string;
  entryId: string;
  externalId: string;
  primaryName: string;
  schema: string;
  subjectLabel: string;
  matchedField: string;
  matchedValue: string;
  score: number;
  strength: MatchStrength;
  reasons: MatchReason[];
}

export interface MatchReasonSummary {
  subjectLabel: string;
  summary: string;
  candidateId: string;
}

export interface SourceVersionSummary {
  id: string;
  source: SanctionsSource;
  sourceMode: SourceMode;
  label: string;
  url: string;
  checksum: string;
  fetchedAt: string;
  publishedAt?: string;
  entryCount: number;
}

export interface ResultSummary {
  confirmedMatches: number;
  reviewMatches: number;
  clearSources: SanctionsSource[];
  overallStatus: "clear" | "review" | "match";
}

export interface VesselIntelSignal {
  id: string;
  title: string;
  severity: CheckSeverity;
  detail: string;
  sourceLabel: string;
}

export interface VesselIntelCounterparty {
  vesselName: string;
  imoNumber: string;
  role: string;
  note: string;
}

export interface VesselIntelTimelineEvent {
  timestamp: string;
  vesselName: string;
  imoNumber: string;
  area: string;
  course: string;
  speedKnots: string;
  aisStatus: "transmitting" | "dark" | "reappeared";
  latitude?: number;
  longitude?: number;
  detail: string;
}

export interface VesselIntelSyntheticScenario {
  isSynthetic: boolean;
  label: string;
  title: string;
  summary: string;
  legalNotice: string;
  counterparties: VesselIntelCounterparty[];
  timeline: VesselIntelTimelineEvent[];
  stsAssessment: {
    area: string;
    window: string;
    narrative: string;
    confidence: "demo";
  };
}

export interface VesselIntelCoverage {
  mode: "best_effort_public";
  confidence: "low" | "medium";
  summary: string;
  limitations: string[];
  linkedParties: string[];
  vesselName?: string;
  imoNumber?: string;
  signals: VesselIntelSignal[];
  syntheticScenario?: VesselIntelSyntheticScenario;
}

export interface VesselCheckInput {
  vesselName?: string;
  imoNumber?: string;
  flag?: string;
  registry?: string;
  ownerName?: string;
  operatorName?: string;
  managerName?: string;
  sellerName?: string;
  buyerName?: string;
  guarantor?: string;
  depositHolder?: string;
  deliveryPlace?: string;
  notes?: string;
}

export interface EntityCheckInput {
  subjectName: string;
  subjectType: "company" | "individual";
  address?: string;
  companyNumber?: string;
  nationality?: string;
  aliases?: string[];
  notes?: string;
}

export interface PdfParsedFields {
  vesselName?: string;
  imoNumber?: string;
  ownerName?: string;
  operatorName?: string;
  managerName?: string;
  sellerName?: string;
  buyerName?: string;
}

export interface PdfCheckInput {
  fileName: string;
  storedPath: string;
  sizeBytes: number;
  extractedText: string;
  note?: string;
  parsedFields: PdfParsedFields;
}

export interface CheckSubmission {
  mode: CheckMode;
  title: string;
  subjects: string[];
  vessel?: VesselCheckInput;
  entity?: EntityCheckInput;
  pdf?: PdfCheckInput;
}

export interface AgentRun {
  provider: "local" | "anthropic-managed-agents";
  note: string;
  sessionId?: string;
}

export interface CheckRecord extends CheckSubmission {
  id: string;
  status: CheckStatus;
  createdAt: string;
  updatedAt: string;
  pipeline: PipelineStep[];
  findings: Finding[];
  citations: Citation[];
  reportSections: ReportSection[];
  agentRun: AgentRun;
  sourceVersions: SourceVersionSummary[];
  matchCandidates: MatchCandidate[];
  matchReasons: MatchReasonSummary[];
  resultSummary: ResultSummary;
  vesselIntel: VesselIntelCoverage;
  docxPath?: string;
}

export interface CheckSummary {
  id: string;
  title: string;
  mode: CheckMode;
  createdAt: string;
  subjects: string[];
  status: CheckStatus;
  confirmedMatches: number;
  reviewMatches: number;
}
