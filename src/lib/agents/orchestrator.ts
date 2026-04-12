import { randomUUID } from "node:crypto";
import { startManagedCheckSession } from "@/lib/agents/managed-agents";
import { buildCheckArtifacts } from "@/lib/checks/analysis";
import {
  createCheckShell,
  failCheck,
  finalizeCheck,
  updateCheckProgress,
} from "@/lib/checks/repository";
import type {
  CheckRecord,
  CheckSubmission,
  MatchCandidate,
  PipelineStep,
} from "@/lib/checks/types";
import {
  getLatestSanctionsEntries,
  toSourceVersionSummary,
  type StoredSanctionsEntry,
} from "@/lib/sanctions/importers";
import {
  buildMatchCandidates,
  buildMatchCandidatesForSubjects,
  type DraftMatchCandidate,
  type ScreeningSubject,
} from "@/lib/sanctions/matcher";
import { dedupeStrings, cleanString } from "@/lib/sanctions/normalize";
import {
  generateDraftReportDocument,
  generateDraftReportSections,
} from "@/lib/report/generator";

type RunningStage = "queued" | "sources" | "matching" | "report";

function buildManagedPrompt(submission: CheckSubmission) {
  return [
    "You are assisting a maritime sanctions due diligence workflow.",
    "Review the intake payload and prioritize formal sanctions signals, vessel intelligence coverage limits, and any red-flag jurisdiction references.",
    "Return concise findings that help a lawyer review the draft output critically.",
    "",
    JSON.stringify(submission, null, 2),
  ].join("\n");
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function addSyntheticMatchIds(matches: DraftMatchCandidate[]): MatchCandidate[] {
  return matches.map((match) => ({
    id: randomUUID(),
    ...match,
  }));
}

function buildProgressPipeline(
  submission: CheckSubmission,
  stage: RunningStage,
): PipelineStep[] {
  const sanctionsDetail =
    stage === "queued"
      ? "Check created. Preparing to refresh sanctions sources and begin screening."
      : stage === "sources"
        ? "Refreshing OFAC and EU source data, verifying provenance, and loading normalized records."
        : stage === "matching"
          ? "Screening vessel, IMO, counterparties, and derived linked parties against the live datasets."
          : "Generating findings, vessel coverage notes, and the draft PDF report.";

  const vesselDetail =
    submission.mode === "entity"
      ? "This entity-led run does not require vessel context."
      : stage === "queued"
        ? "Waiting for sanctions screening to finish before generating vessel-intelligence signals."
        : stage === "sources"
          ? "Preparing the vessel lane with best-effort public-data coverage and linked-party extraction."
          : stage === "matching"
            ? "Resolving vessel-specific identifiers, linked parties, and coverage disclosures."
            : "Finalizing vessel intelligence signals and report language.";

  return [
    {
      key: "intake",
      label: "Intake normalization",
      status: "complete",
      detail:
        submission.mode === "pdf"
          ? "The uploaded PDF was stored and normalized into screening subjects."
          : "The submitted intake was normalized into screening subjects.",
    },
    {
      key: "sanctions",
      label: "Formal sanctions lane",
      status: stage === "report" ? "complete" : "pending",
      detail: sanctionsDetail,
    },
    {
      key: "vessel-intelligence",
      label: "Vessel intelligence lane",
      status:
        submission.mode === "entity"
          ? "not_applicable"
          : stage === "report"
            ? "complete"
            : "pending",
      detail: vesselDetail,
    },
    {
      key: "report",
      label: "Draft report",
      status: stage === "report" ? "pending" : "pending",
      detail:
        stage === "report"
          ? "Building the review summary, citations, and PDF output now."
          : "Queued until screening and vessel-intelligence analysis complete.",
    },
  ];
}

function extractLinkedPartyNames(entry: StoredSanctionsEntry) {
  const raw = (entry.raw ?? {}) as Record<string, unknown>;
  const remarks = cleanString(raw.remarks);
  const vesselInfo = (raw.vesselInfo as Record<string, unknown> | undefined) ?? {};
  const derivedNames = new Set<string>();

  for (const fieldName of [
    "vesselOwner",
    "owner",
    "beneficialOwner",
    "operator",
    "vesselOperator",
    "manager",
    "vesselManager",
    "technicalManager",
  ] as const) {
    const value = cleanString(vesselInfo[fieldName]);

    if (value) {
      derivedNames.add(value);
    }
  }

  if (remarks) {
    const relationshipPatterns = [
      /linked to:\s*([^)]+?)(?=\)|;|$)/gi,
      /owned by:\s*([^)]+?)(?=\)|;|$)/gi,
      /managed by:\s*([^)]+?)(?=\)|;|$)/gi,
      /operated by:\s*([^)]+?)(?=\)|;|$)/gi,
    ];

    for (const pattern of relationshipPatterns) {
      for (const match of remarks.matchAll(pattern)) {
        const value = cleanString(match[1]);

        if (value) {
          derivedNames.add(value);
        }
      }
    }
  }

  return [...derivedNames];
}

function buildDerivedLinkedPartySubjects(
  draftMatches: DraftMatchCandidate[],
  entries: StoredSanctionsEntry[],
): ScreeningSubject[] {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const subjects: ScreeningSubject[] = [];

  for (const match of draftMatches) {
    const matchedEntry = entryById.get(match.entryId);

    if (!matchedEntry || matchedEntry.schema.toUpperCase() !== "VESSEL") {
      continue;
    }

    for (const linkedParty of extractLinkedPartyNames(matchedEntry)) {
      subjects.push({
        label: `Linked Party from ${matchedEntry.primaryName}`,
        names: [linkedParty],
        identifiers: [],
        countries: [],
        addresses: [],
      });
    }
  }

  return subjects;
}

function mergeDraftMatches(matchGroups: DraftMatchCandidate[][]) {
  const deduped = new Map<string, DraftMatchCandidate>();

  for (const group of matchGroups) {
    for (const match of group) {
      const key = `${match.entryId}:${match.subjectLabel}`;
      const existing = deduped.get(key);

      if (!existing || existing.score < match.score) {
        deduped.set(key, match);
      }
    }
  }

  return [...deduped.values()].sort((left, right) => right.score - left.score);
}

async function prepareAgentRun(submission: CheckSubmission) {
  const managedRun =
    await startManagedCheckSession({
      title: submission.title,
      prompt: buildManagedPrompt(submission),
    }).catch(() => null);

  return (
    managedRun ??
    ({
      provider: "local",
      note: "Running the local Phase 1 execution path with live sanctions imports and public-data vessel context.",
    } satisfies CheckRecord["agentRun"])
  );
}

export async function startCheckRun(submission: CheckSubmission) {
  const agentRun = await prepareAgentRun(submission);
  const shell = await createCheckShell({
    submission,
    agentRun,
    pipeline: buildProgressPipeline(submission, "queued"),
  });

  return {
    id: shell.id,
    agentRun,
  };
}

export async function executeCheckRun({
  id,
  submission,
  agentRun,
}: {
  id: string;
  submission: CheckSubmission;
  agentRun: CheckRecord["agentRun"];
}) {
  try {
    await sleep(650);
    await updateCheckProgress({
      id,
      pipeline: buildProgressPipeline(submission, "sources"),
    });

    const { versions, entries } = await getLatestSanctionsEntries();
    const sourceVersions = versions.map(toSourceVersionSummary);

    await updateCheckProgress({
      id,
      pipeline: buildProgressPipeline(submission, "matching"),
      sourceVersions,
    });
    await sleep(650);

    const primaryMatches = buildMatchCandidates(submission, entries);
    const derivedSubjects = buildDerivedLinkedPartySubjects(primaryMatches, entries);
    const derivedMatches = buildMatchCandidatesForSubjects(derivedSubjects, entries).map(
      (match) => ({
        ...match,
        reasons: [
          {
            code: "linked_party_derivation",
            detail: `This candidate was derived from a linked party named on a matched vessel record.`,
          },
          ...match.reasons,
        ],
      }),
    );
    const mergedMatches = mergeDraftMatches([primaryMatches, derivedMatches]);
    const analysisMatches = addSyntheticMatchIds(mergedMatches);
    const artifacts = buildCheckArtifacts({
      submission,
      sourceVersions,
      matchCandidates: analysisMatches,
    });

    await updateCheckProgress({
      id,
      pipeline: buildProgressPipeline(submission, "report"),
      sourceVersions,
      findings: artifacts.findings,
      citations: artifacts.citations,
      resultSummary: artifacts.resultSummary,
      vesselIntel: artifacts.vesselIntel,
    });
    await sleep(650);

    const draftCheck = {
      id,
      status: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...submission,
      pipeline: artifacts.pipeline,
      findings: artifacts.findings,
      citations: artifacts.citations,
      reportSections: [] as CheckRecord["reportSections"],
      agentRun,
      sourceVersions,
      matchCandidates: analysisMatches,
      matchReasons: analysisMatches.map((candidate) => ({
        candidateId: candidate.id,
        subjectLabel: candidate.subjectLabel,
        summary: candidate.reasons.map((reason) => reason.detail).join(" "),
      })),
      resultSummary: artifacts.resultSummary,
      vesselIntel: artifacts.vesselIntel,
    } satisfies CheckRecord;

    draftCheck.reportSections = generateDraftReportSections(draftCheck);
    const docxPath = await generateDraftReportDocument(draftCheck);

    const finalized = await finalizeCheck({
      id,
      status: "completed",
      pipeline: artifacts.pipeline,
      findings: artifacts.findings,
      citations: [
        ...artifacts.citations,
        {
          id: "report-docx",
          label: "Draft PDF report",
          url: docxPath,
          kind: "report",
        },
      ],
      reportSections: draftCheck.reportSections,
      vesselIntel: artifacts.vesselIntel,
      resultSummary: artifacts.resultSummary,
      sourceVersions,
      docxPath,
      matches: mergedMatches.map((match) => ({
        sanctionsEntryId: match.entryId,
        sourceVersionId: match.sourceVersionId,
        subjectLabel: match.subjectLabel,
        matchedField: match.matchedField,
        matchedValue: match.matchedValue,
        score: match.score,
        strength: match.strength,
        reasons: match.reasons,
        isSelected: match.strength !== "review",
      })),
    });

    if (!finalized) {
      throw new Error("The completed check could not be reloaded from the database.");
    }

    return finalized;
  } catch (error) {
    const executionError =
      error instanceof Error ? error : new Error("Unknown execution failure.");
    await failCheck(id, executionError);
    throw executionError;
  }
}

export async function createCheckRun(submission: CheckSubmission) {
  const { id, agentRun } = await startCheckRun(submission);
  return executeCheckRun({ id, submission, agentRun });
}
