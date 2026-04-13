import { buildCheckArtifacts } from "@/lib/checks/analysis";
import type {
  CheckSubmission,
  MatchCandidate,
  SourceVersionSummary,
} from "@/lib/checks/types";

const baseSourceVersions: SourceVersionSummary[] = [
  {
    id: "sv-ofac",
    source: "ofac",
    sourceMode: "official",
    label: "OFAC SDN XML",
    url: "https://example.com/ofac",
    checksum: "a",
    fetchedAt: "2026-04-12T00:00:00Z",
    entryCount: 100,
  },
  {
    id: "sv-eu",
    source: "eu",
    sourceMode: "fallback",
    label: "EU FSF (fallback)",
    url: "https://example.com/eu",
    checksum: "b",
    fetchedAt: "2026-04-12T00:00:00Z",
    entryCount: 200,
  },
];

function makeMatch(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    id: "match-1",
    source: "ofac",
    sourceMode: "official",
    sourceVersionId: "sv-ofac",
    entryId: "entry-1",
    externalId: "EXT-1",
    primaryName: "ACME SHIPPING LLC",
    schema: "Entity",
    subjectLabel: "Entity",
    matchedField: "name",
    matchedValue: "Acme Shipping LLC",
    score: 0.98,
    strength: "exact",
    reasons: [{ code: "primary_name_exact", detail: "exact" }],
    ...overrides,
  };
}

function entitySubmission(): CheckSubmission {
  return {
    mode: "entity",
    title: "Screen Acme",
    subjects: ["Acme Shipping LLC"],
    entity: {
      subjectName: "Acme Shipping LLC",
      subjectType: "company",
    },
  };
}

describe("buildCheckArtifacts", () => {
  it("reports 'clear' overall status when there are no matches", () => {
    const artifacts = buildCheckArtifacts({
      submission: entitySubmission(),
      sourceVersions: baseSourceVersions,
      matchCandidates: [],
    });
    expect(artifacts.resultSummary.overallStatus).toBe("clear");
    expect(artifacts.resultSummary.confirmedMatches).toBe(0);
    expect(artifacts.resultSummary.reviewMatches).toBe(0);
    expect(artifacts.findings.some((finding) => finding.id === "lists-cleared")).toBe(true);
  });

  it("reports 'match' status and adds a confirmed-matches finding when an exact match exists", () => {
    const artifacts = buildCheckArtifacts({
      submission: entitySubmission(),
      sourceVersions: baseSourceVersions,
      matchCandidates: [makeMatch()],
    });
    expect(artifacts.resultSummary.overallStatus).toBe("match");
    expect(artifacts.resultSummary.confirmedMatches).toBe(1);
    expect(artifacts.findings.some((finding) => finding.id === "confirmed-matches")).toBe(true);
  });

  it("reports 'review' status for fuzzy-only matches", () => {
    const artifacts = buildCheckArtifacts({
      submission: entitySubmission(),
      sourceVersions: baseSourceVersions,
      matchCandidates: [makeMatch({ strength: "review", score: 0.94 })],
    });
    expect(artifacts.resultSummary.overallStatus).toBe("review");
    expect(artifacts.resultSummary.reviewMatches).toBe(1);
    expect(artifacts.findings.some((finding) => finding.id === "review-matches")).toBe(true);
  });

  it("flags risk jurisdictions mentioned in the intake", () => {
    const submission: CheckSubmission = {
      mode: "vessel",
      title: "x",
      subjects: [],
      vessel: { vesselName: "X", imoNumber: "1234567", flag: "Iran" },
    };
    const artifacts = buildCheckArtifacts({
      submission,
      sourceVersions: baseSourceVersions,
      matchCandidates: [],
    });
    expect(
      artifacts.vesselIntel.signals.some(
        (signal) => signal.id === "risk-jurisdictions" && signal.severity === "high",
      ),
    ).toBe(true);
  });

  it("marks the vessel-intelligence pipeline step not-applicable for entity mode", () => {
    const artifacts = buildCheckArtifacts({
      submission: entitySubmission(),
      sourceVersions: baseSourceVersions,
      matchCandidates: [],
    });
    const vesselStep = artifacts.pipeline.find((step) => step.key === "vessel-intelligence");
    expect(vesselStep?.status).toBe("not_applicable");
  });

  it("emits a citation for the uploaded PDF in PDF-led runs", () => {
    const submission: CheckSubmission = {
      mode: "pdf",
      title: "Doc",
      subjects: [],
      pdf: {
        fileName: "intake.pdf",
        storedPath: "uploads/intake.pdf",
        sizeBytes: 100,
        extractedText: "Owner name: Foo",
        parsedFields: { ownerName: "Foo" },
      },
    };
    const artifacts = buildCheckArtifacts({
      submission,
      sourceVersions: baseSourceVersions,
      matchCandidates: [],
    });
    expect(artifacts.citations.some((citation) => citation.id === "uploaded-pdf")).toBe(true);
  });
});
