import { normalizeIdentifier, normalizeText } from "@/lib/sanctions/normalize";

const storage: {
  checks: Map<string, Record<string, unknown>>;
  entries: Array<Record<string, unknown>>;
} = { checks: new Map(), entries: [] };

jest.mock("@/lib/agents/managed-agents", () => ({
  startManagedCheckSession: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/report/generator", () => ({
  generateDraftReportDocument: jest.fn().mockResolvedValue("reports/fake.docx"),
  generateDraftReportSections: jest.fn().mockReturnValue([
    { title: "Summary", body: "A generated draft summary." },
  ]),
}));

jest.mock("@/lib/sanctions/importers", () => {
  const { normalizeText, normalizeIdentifier } = jest.requireActual(
    "@/lib/sanctions/normalize",
  );
  const sourceVersion = {
    id: "sv-test",
    source: "ofac",
    sourceMode: "official",
    label: "OFAC SDN XML",
    url: "https://example.com/ofac",
    checksum: "test",
    fetchedAt: new Date(),
    publishedAt: null,
    entryCount: 1,
    metadata: null,
  };
  const matchingEntry = {
    id: "entry-match",
    sourceVersionId: sourceVersion.id,
    externalId: "EXT-1",
    schema: "Vessel",
    primaryName: "PACIFIC DAWN",
    normalizedName: normalizeText("PACIFIC DAWN"),
    aliases: [],
    normalizedAliases: [],
    countries: ["Panama"],
    addresses: [],
    identifiers: [
      { type: "IMO", value: "1234567", normalizedValue: normalizeIdentifier("1234567") },
    ],
    birthDates: [],
    sanctionsPrograms: [],
    raw: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    sourceVersion,
  };

  return {
    getLatestSanctionsEntries: jest.fn().mockResolvedValue({
      versions: [sourceVersion],
      entries: [matchingEntry],
    }),
    toSourceVersionSummary: (version: typeof sourceVersion) => ({
      id: version.id,
      source: version.source,
      sourceMode: version.sourceMode,
      label: version.label,
      url: version.url,
      checksum: version.checksum,
      fetchedAt: version.fetchedAt.toISOString(),
      publishedAt: undefined,
      entryCount: version.entryCount,
    }),
  };
});

jest.mock("@/lib/checks/repository", () => ({
  createCheckShell: jest.fn().mockImplementation(async ({ submission, agentRun, pipeline }) => {
    const id = `check-${storage.checks.size + 1}`;
    storage.checks.set(id, { id, submission, agentRun, pipeline, status: "running" });
    return { id };
  }),
  updateCheckProgress: jest.fn().mockImplementation(async ({ id, ...rest }) => {
    const existing = storage.checks.get(id) ?? { id };
    storage.checks.set(id, { ...existing, ...rest });
  }),
  finalizeCheck: jest.fn().mockImplementation(async ({ id, ...rest }) => {
    const existing = storage.checks.get(id) ?? { id };
    const record = { ...existing, ...rest, status: "completed" };
    storage.checks.set(id, record);
    return record;
  }),
  failCheck: jest.fn().mockImplementation(async (id: string, error: Error) => {
    const existing = storage.checks.get(id) ?? { id };
    storage.checks.set(id, { ...existing, status: "failed", error: error.message });
  }),
}));

import { createCheckRun } from "@/lib/agents/orchestrator";
import type { CheckSubmission } from "@/lib/checks/types";

describe("orchestrator end-to-end (with mocks)", () => {
  beforeEach(() => {
    storage.checks.clear();
    storage.entries.length = 0;
  });

  it("runs a vessel check through intake → sources → matching → report and finalizes with a match", async () => {
    const submission: CheckSubmission = {
      mode: "vessel",
      title: "PACIFIC DAWN transaction",
      subjects: ["PACIFIC DAWN", "1234567"],
      vessel: {
        vesselName: "PACIFIC DAWN",
        imoNumber: "1234567",
        flag: "Panama",
      },
    };

    const result = await createCheckRun(submission);

    expect(result.status).toBe("completed");
    expect(result.matches.length).toBeGreaterThan(0);
    const identifierMatch = result.matches.find((match: { matchedField: string }) => match.matchedField === "identifier");
    expect(identifierMatch).toBeDefined();
    expect(result.pipeline.some((step: { key: string; status: string }) =>
      step.key === "sanctions" && step.status !== "pending",
    )).toBe(true);
    expect(result.docxPath).toBe("reports/fake.docx");
  });

  it("marks the run failed when the sanctions source lookup throws", async () => {
    const importers = jest.requireMock("@/lib/sanctions/importers");
    importers.getLatestSanctionsEntries.mockRejectedValueOnce(
      new Error("upstream is down"),
    );

    const submission: CheckSubmission = {
      mode: "entity",
      title: "Entity screen",
      subjects: ["Acme Holdings"],
      entity: { subjectName: "Acme Holdings", subjectType: "company" },
    };

    await expect(createCheckRun(submission)).rejects.toThrow("upstream is down");
    const ids = Array.from(storage.checks.keys());
    const latest = storage.checks.get(ids[ids.length - 1])!;
    expect(latest.status).toBe("failed");
  });
});

// Keeps the imported helpers live so the mocked `jest.requireActual` call above
// stays valid even if the file is run in isolation.
void normalizeIdentifier;
void normalizeText;
