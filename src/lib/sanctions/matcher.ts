import { distance } from "fastest-levenshtein";
import type { MatchStrength } from "@prisma/client";
import type {
  CheckSubmission,
  MatchCandidate,
  MatchReason,
} from "@/lib/checks/types";
import type { StoredSanctionsEntry } from "@/lib/sanctions/importers";
import {
  buildIdentifierVariants,
  buildNameVariants,
  cleanString,
  dedupeStrings,
  normalizeIdentifier,
  normalizeText,
} from "@/lib/sanctions/normalize";

export interface ScreeningSubject {
  label: string;
  names: string[];
  identifiers: Array<{ type: string; value: string; normalizedValue: string }>;
  countries: string[];
  addresses: string[];
}

export interface DraftMatchCandidate {
  sourceVersionId: string;
  entryId: string;
  externalId: string;
  source: "ofac" | "eu";
  sourceMode: "official" | "fallback";
  primaryName: string;
  schema: string;
  subjectLabel: string;
  matchedField: string;
  matchedValue: string;
  score: number;
  strength: MatchStrength;
  reasons: MatchReason[];
}

function parseJsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function similarity(left: string, right: string) {
  const longestLength = Math.max(left.length, right.length);

  if (longestLength === 0) {
    return 1;
  }

  return 1 - distance(left, right) / longestLength;
}

function buildIdentifier(type: string, value: string | undefined) {
  if (!value) {
    return null;
  }

  return {
    type,
    value,
    normalizedValue: normalizeIdentifier(value),
  };
}

export function buildScreeningSubjects(submission: CheckSubmission) {
  const subjects: ScreeningSubject[] = [];

  if (submission.mode === "vessel" && submission.vessel) {
    const vesselIdentifiers = [
      buildIdentifier("IMO", submission.vessel.imoNumber),
    ].filter(Boolean) as ScreeningSubject["identifiers"];

    subjects.push({
      label: "Vessel",
      names: dedupeStrings([submission.vessel.vesselName]),
      identifiers: vesselIdentifiers,
      countries: dedupeStrings([submission.vessel.flag, submission.vessel.registry]),
      addresses: dedupeStrings([submission.vessel.deliveryPlace]),
    });

    for (const [label, value] of [
      ["Owner", submission.vessel.ownerName],
      ["Operator", submission.vessel.operatorName],
      ["Manager", submission.vessel.managerName],
      ["Seller", submission.vessel.sellerName],
      ["Buyer", submission.vessel.buyerName],
      ["Guarantor", submission.vessel.guarantor],
      ["Deposit Holder", submission.vessel.depositHolder],
    ] as const) {
      if (!value) {
        continue;
      }

      subjects.push({
        label,
        names: [value],
        identifiers: [],
        countries: [],
        addresses: [],
      });
    }
  }

  if (submission.mode === "entity" && submission.entity) {
    const companyNumber = buildIdentifier(
      "Company Number",
      submission.entity.companyNumber,
    );

    subjects.push({
      label: submission.entity.subjectType === "individual" ? "Individual" : "Entity",
      names: dedupeStrings([
        submission.entity.subjectName,
        ...(submission.entity.aliases ?? []),
      ]),
      identifiers: companyNumber ? [companyNumber] : [],
      countries: dedupeStrings([submission.entity.nationality]),
      addresses: dedupeStrings([submission.entity.address]),
    });
  }

  if (submission.mode === "pdf" && submission.pdf) {
    const imo = buildIdentifier("IMO", submission.pdf.parsedFields.imoNumber);

    if (submission.pdf.parsedFields.vesselName) {
      subjects.push({
        label: "PDF Vessel",
        names: [submission.pdf.parsedFields.vesselName],
        identifiers: imo ? [imo] : [],
        countries: [],
        addresses: [],
      });
    }

    for (const [label, value] of [
      ["PDF Owner", submission.pdf.parsedFields.ownerName],
      ["PDF Operator", submission.pdf.parsedFields.operatorName],
      ["PDF Manager", submission.pdf.parsedFields.managerName],
      ["PDF Seller", submission.pdf.parsedFields.sellerName],
      ["PDF Buyer", submission.pdf.parsedFields.buyerName],
    ] as const) {
      if (!value) {
        continue;
      }

      subjects.push({
        label,
        names: [value],
        identifiers: [],
        countries: [],
        addresses: [],
      });
    }
  }

  return subjects;
}

function evaluateSubjectAgainstEntry(
  subject: ScreeningSubject,
  entry: StoredSanctionsEntry,
): DraftMatchCandidate | null {
  const entryIdentifiers = parseJsonArray(entry.identifiers) as Array<{
    type?: string;
    value?: string;
    normalizedValue?: string;
  }>;
  const normalizedAliases = parseJsonArray(entry.normalizedAliases).flatMap((value) =>
    cleanString(value) ? [cleanString(value)!] : [],
  );
  const entryCountries = parseJsonArray(entry.countries).flatMap((value) =>
    cleanString(value) ? [normalizeText(value)] : [],
  );
  const vesselContext =
    entry.schema.toUpperCase() === "VESSEL" || subject.label.toUpperCase().includes("VESSEL");

  for (const identifier of subject.identifiers) {
    const subjectVariants = buildIdentifierVariants(identifier.type, identifier.value);

    if (subjectVariants.length === 0) {
      continue;
    }

    const matchedIdentifier = entryIdentifiers.find(
      (candidate) => {
        const candidateVariants = buildIdentifierVariants(
          cleanString(candidate.type),
          cleanString(candidate.value) ?? cleanString(candidate.normalizedValue) ?? "",
        );

        return candidateVariants.some((variant) => subjectVariants.includes(variant));
      },
    );

    if (matchedIdentifier) {
      return {
        sourceVersionId: entry.sourceVersionId,
        entryId: entry.id,
        externalId: entry.externalId,
        source: entry.sourceVersion.source,
        sourceMode: entry.sourceVersion.sourceMode,
        primaryName: entry.primaryName,
        schema: entry.schema,
        subjectLabel: subject.label,
        matchedField: "identifier",
        matchedValue: identifier.value,
        score: 1,
        strength: "exact",
        reasons: [
          {
            code: "identifier_exact",
            detail: `${identifier.type} matched exactly against the source record.`,
          },
        ],
      } satisfies DraftMatchCandidate;
    }
  }

  let bestCandidate: DraftMatchCandidate | null = null;
  const primaryNameVariants = buildNameVariants(entry.primaryName, {
    vessel: vesselContext,
  });
  const entryName = primaryNameVariants[0] ?? normalizeText(entry.primaryName);
  const aliasNameVariants = dedupeStrings(
    normalizedAliases.flatMap((alias) =>
      buildNameVariants(alias, {
        vessel: vesselContext,
      }),
    ),
  );
  const candidateNames = dedupeStrings([
    ...primaryNameVariants,
    ...aliasNameVariants,
  ]);

  for (const rawName of subject.names) {
    const subjectVariants = buildNameVariants(rawName, {
      vessel: vesselContext,
    });
    const normalizedSubject = subjectVariants[0] ?? normalizeText(rawName);

    if (normalizedSubject.length < 3) {
      continue;
    }

    if (primaryNameVariants.some((candidateName) => subjectVariants.includes(candidateName))) {
      const reasons: MatchReason[] = [
        {
          code: "primary_name_exact",
          detail: vesselContext
            ? "Vessel name matched exactly after normalization, including common vessel-prefix cleanup."
            : "Primary name matched exactly after normalization.",
        },
      ];
      const countryOverlap = subject.countries
        .map((country) => normalizeText(country))
        .find((country) => entryCountries.includes(country));

      if (countryOverlap) {
        reasons.push({
          code: "country_overlap",
          detail: `Country context overlaps on ${countryOverlap}.`,
        });
      }

      return {
        sourceVersionId: entry.sourceVersionId,
        entryId: entry.id,
        externalId: entry.externalId,
        source: entry.sourceVersion.source,
        sourceMode: entry.sourceVersion.sourceMode,
        primaryName: entry.primaryName,
        schema: entry.schema,
        subjectLabel: subject.label,
        matchedField: "name",
        matchedValue: rawName,
        score: countryOverlap ? 0.98 : 0.95,
        strength: countryOverlap ? "exact" : "strong",
        reasons,
      } satisfies DraftMatchCandidate;
    }

    const aliasIndex = aliasNameVariants.findIndex((alias) =>
      subjectVariants.includes(alias),
    );

    if (aliasIndex >= 0) {
      return {
        sourceVersionId: entry.sourceVersionId,
        entryId: entry.id,
        externalId: entry.externalId,
        source: entry.sourceVersion.source,
        sourceMode: entry.sourceVersion.sourceMode,
        primaryName: entry.primaryName,
        schema: entry.schema,
        subjectLabel: subject.label,
        matchedField: "alias",
        matchedValue: rawName,
        score: 0.92,
        strength: "strong",
        reasons: [
          {
            code: "alias_exact",
            detail: "The subject name matched an alias on the source record.",
          },
        ],
      } satisfies DraftMatchCandidate;
    }

    if (normalizedSubject.length < 8) {
      continue;
    }

    for (const candidateName of candidateNames) {
      if (candidateName.length < 8 || candidateName[0] !== normalizedSubject[0]) {
        continue;
      }

      const fuzzyScore = similarity(normalizedSubject, candidateName);

      if (fuzzyScore < 0.93) {
        continue;
      }

      const draft: DraftMatchCandidate = {
        sourceVersionId: entry.sourceVersionId,
        entryId: entry.id,
        externalId: entry.externalId,
        source: entry.sourceVersion.source,
        sourceMode: entry.sourceVersion.sourceMode,
        primaryName: entry.primaryName,
        schema: entry.schema,
        subjectLabel: subject.label,
        matchedField: "fuzzy_name",
        matchedValue: rawName,
        score: Number(fuzzyScore.toFixed(4)),
        strength: "review",
        reasons: [
          {
            code: "name_fuzzy",
            detail: `Normalized names are similar enough to require review (${Math.round(
              fuzzyScore * 100,
            )}% similarity).`,
          },
        ],
      };

      if (!bestCandidate || bestCandidate.score < draft.score) {
        bestCandidate = draft;
      }
    }
  }

  return bestCandidate;
}

export function buildMatchCandidates(
  submission: CheckSubmission,
  entries: StoredSanctionsEntry[],
) {
  const screeningSubjects = buildScreeningSubjects(submission);
  return buildMatchCandidatesForSubjects(screeningSubjects, entries);
}

export function buildMatchCandidatesForSubjects(
  screeningSubjects: ScreeningSubject[],
  entries: StoredSanctionsEntry[],
) {
  const matches = new Map<string, DraftMatchCandidate>();

  for (const subject of screeningSubjects) {
    for (const entry of entries) {
      const candidate = evaluateSubjectAgainstEntry(subject, entry);

      if (!candidate) {
        continue;
      }

      const key = `${candidate.entryId}:${candidate.subjectLabel}`;
      const existing = matches.get(key);

      if (!existing || existing.score < candidate.score) {
        matches.set(key, candidate);
      }
    }
  }

  return [...matches.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, 25);
}

export function mapPersistedMatchCandidate(match: {
  id: string;
  matchedField: string;
  matchedValue: string;
  score: number;
  strength: MatchStrength;
  subjectLabel: string;
  reasons: unknown;
  sanctionsEntry: {
    id: string;
    externalId: string;
    primaryName: string;
    schema: string;
  };
  sourceVersion: {
    id: string;
    source: "ofac" | "eu";
    sourceMode: "official" | "fallback";
  };
}): MatchCandidate {
  return {
    id: match.id,
    source: match.sourceVersion.source,
    sourceMode: match.sourceVersion.sourceMode,
    sourceVersionId: match.sourceVersion.id,
    entryId: match.sanctionsEntry.id,
    externalId: match.sanctionsEntry.externalId,
    primaryName: match.sanctionsEntry.primaryName,
    schema: match.sanctionsEntry.schema,
    subjectLabel: match.subjectLabel,
    matchedField: match.matchedField,
    matchedValue: match.matchedValue,
    score: match.score,
    strength: match.strength,
    reasons: Array.isArray(match.reasons) ? (match.reasons as MatchReason[]) : [],
  };
}
