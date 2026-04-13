import {
  buildMatchCandidates,
  buildScreeningSubjects,
} from "@/lib/sanctions/matcher";
import type { StoredSanctionsEntry } from "@/lib/sanctions/importers";
import type { CheckSubmission } from "@/lib/checks/types";
import { normalizeIdentifier, normalizeText } from "@/lib/sanctions/normalize";

function makeEntry(overrides: Partial<StoredSanctionsEntry> = {}): StoredSanctionsEntry {
  const primaryName = overrides.primaryName ?? "ACME SHIPPING LLC";
  const aliases = (overrides.aliases as string[] | undefined) ?? [];

  return {
    id: "entry-1",
    sourceVersionId: "sv-1",
    externalId: "EXT-1",
    schema: "Entity",
    primaryName,
    normalizedName: normalizeText(primaryName),
    aliases: aliases as never,
    normalizedAliases: aliases.map((value) => normalizeText(value)) as never,
    countries: [] as never,
    addresses: [] as never,
    identifiers: [] as never,
    birthDates: [] as never,
    sanctionsPrograms: [] as never,
    raw: {} as never,
    createdAt: new Date(),
    updatedAt: new Date(),
    sourceVersion: {
      id: "sv-1",
      source: "ofac",
      sourceMode: "official",
      label: "OFAC SDN XML",
      url: "https://example.com/ofac",
      checksum: "deadbeef",
      fetchedAt: new Date(),
      publishedAt: null,
      entryCount: 1,
      metadata: null,
    },
    ...overrides,
  } as unknown as StoredSanctionsEntry;
}

describe("buildScreeningSubjects", () => {
  it("builds a vessel subject with IMO identifier and separate linked-party subjects", () => {
    const submission: CheckSubmission = {
      mode: "vessel",
      title: "Transaction",
      subjects: [],
      vessel: {
        vesselName: "PACIFIC DAWN",
        imoNumber: "1234567",
        flag: "Panama",
        ownerName: "Acme Holdings",
      },
    };
    const subjects = buildScreeningSubjects(submission);
    const labels = subjects.map((subject) => subject.label);
    expect(labels).toEqual(expect.arrayContaining(["Vessel", "Owner"]));
    const vessel = subjects.find((subject) => subject.label === "Vessel")!;
    expect(vessel.names).toContain("PACIFIC DAWN");
    expect(vessel.identifiers.some((id) => id.type === "IMO" && id.value === "1234567")).toBe(true);
  });

  it("emits PDF-led subjects from parsedFields", () => {
    const submission: CheckSubmission = {
      mode: "pdf",
      title: "Doc",
      subjects: [],
      pdf: {
        fileName: "intake.pdf",
        storedPath: "uploads/intake.pdf",
        sizeBytes: 100,
        extractedText: "",
        parsedFields: {
          vesselName: "NORTHERN LIGHT",
          imoNumber: "7654321",
          ownerName: "Contoso Maritime",
        },
      },
    };
    const subjects = buildScreeningSubjects(submission);
    const labels = subjects.map((subject) => subject.label);
    expect(labels).toEqual(expect.arrayContaining(["PDF Vessel", "PDF Owner"]));
  });

  it("emits a single entity subject with aliases", () => {
    const submission: CheckSubmission = {
      mode: "entity",
      title: "Entity",
      subjects: [],
      entity: {
        subjectName: "Acme Holdings",
        subjectType: "company",
        aliases: ["Acme Holding Co."],
      },
    };
    const subjects = buildScreeningSubjects(submission);
    expect(subjects).toHaveLength(1);
    expect(subjects[0].names).toEqual(
      expect.arrayContaining(["Acme Holdings", "Acme Holding Co."]),
    );
  });
});

describe("buildMatchCandidates", () => {
  it("finds an exact identifier match on IMO", () => {
    const submission: CheckSubmission = {
      mode: "vessel",
      title: "x",
      subjects: [],
      vessel: { vesselName: "UNRELATED NAME", imoNumber: "1234567" },
    };
    const entry = makeEntry({
      primaryName: "SOMETHING ELSE",
      schema: "Vessel",
      identifiers: [
        { type: "IMO", value: "1234567", normalizedValue: normalizeIdentifier("1234567") },
      ] as never,
    });

    const [match] = buildMatchCandidates(submission, [entry]);
    expect(match).toBeDefined();
    expect(match.matchedField).toBe("identifier");
    expect(match.strength).toBe("exact");
    expect(match.score).toBe(1);
  });

  it("finds an exact normalized-name match on the vessel subject", () => {
    const submission: CheckSubmission = {
      mode: "vessel",
      title: "x",
      subjects: [],
      vessel: { vesselName: "MV Pacific Dawn" },
    };
    const entry = makeEntry({
      primaryName: "PACIFIC DAWN",
      schema: "Vessel",
    });

    const [match] = buildMatchCandidates(submission, [entry]);
    expect(match).toBeDefined();
    expect(match.matchedField).toBe("name");
    expect(match.strength).toBe("strong");
    expect(match.score).toBeGreaterThanOrEqual(0.95);
  });

  it("boosts the score when country context overlaps", () => {
    const submission: CheckSubmission = {
      mode: "vessel",
      title: "x",
      subjects: [],
      vessel: { vesselName: "PACIFIC DAWN", flag: "Panama" },
    };
    const entry = makeEntry({
      primaryName: "PACIFIC DAWN",
      schema: "Vessel",
      countries: ["Panama"] as never,
    });

    const [match] = buildMatchCandidates(submission, [entry]);
    expect(match.strength).toBe("exact");
    expect(match.score).toBeCloseTo(0.98);
    expect(match.reasons.some((reason) => reason.code === "country_overlap")).toBe(true);
  });

  it("reports a fuzzy review candidate when names are close but not identical", () => {
    const submission: CheckSubmission = {
      mode: "entity",
      title: "x",
      subjects: [],
      entity: { subjectName: "Acme Shiping LLC", subjectType: "company" },
    };
    const entry = makeEntry({ primaryName: "Acme Shipping LLC" });

    const [match] = buildMatchCandidates(submission, [entry]);
    expect(match).toBeDefined();
    expect(match.matchedField).toBe("fuzzy_name");
    expect(match.strength).toBe("review");
    expect(match.score).toBeGreaterThan(0.9);
    expect(match.score).toBeLessThan(1);
  });

  it("returns no matches when the subject is clearly unrelated", () => {
    const submission: CheckSubmission = {
      mode: "entity",
      title: "x",
      subjects: [],
      entity: { subjectName: "Wholly Unrelated Clean Party", subjectType: "company" },
    };
    const entry = makeEntry({ primaryName: "ACME SHIPPING LLC" });

    const results = buildMatchCandidates(submission, [entry]);
    expect(results).toEqual([]);
  });

  it("matches against an alias when the primary name differs", () => {
    const submission: CheckSubmission = {
      mode: "entity",
      title: "x",
      subjects: [],
      entity: { subjectName: "Contoso Maritime", subjectType: "company" },
    };
    const entry = makeEntry({
      primaryName: "Different Entity",
      aliases: ["Contoso Maritime"],
    });

    const [match] = buildMatchCandidates(submission, [entry]);
    expect(match).toBeDefined();
    expect(match.matchedField).toBe("alias");
    expect(match.strength).toBe("strong");
  });

  it("returns at most 25 results sorted by descending score", () => {
    const submission: CheckSubmission = {
      mode: "entity",
      title: "x",
      subjects: [],
      entity: { subjectName: "ACME SHIPPING LLC", subjectType: "company" },
    };
    const entries = Array.from({ length: 40 }, (_, index) =>
      makeEntry({
        id: `entry-${index}`,
        externalId: `EXT-${index}`,
        primaryName: "ACME SHIPPING LLC",
      }),
    );

    const results = buildMatchCandidates(submission, entries);
    expect(results.length).toBeLessThanOrEqual(25);
    for (let index = 1; index < results.length; index += 1) {
      expect(results[index - 1].score).toBeGreaterThanOrEqual(results[index].score);
    }
  });
});
