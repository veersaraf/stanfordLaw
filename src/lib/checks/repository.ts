import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  AgentRun,
  CheckMode,
  CheckRecord,
  CheckStatus,
  CheckSubmission,
  CheckSummary,
  Citation,
  Finding,
  MatchReasonSummary,
  PipelineStep,
  ReportSection,
  ResultSummary,
  SourceVersionSummary,
  VesselIntelCoverage,
} from "@/lib/checks/types";
import { mapPersistedMatchCandidate } from "@/lib/sanctions/matcher";

function fromJson<T>(value: Prisma.JsonValue | null | undefined, fallback: T) {
  return (value as T | null | undefined) ?? fallback;
}

function toJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function mapCheckRecord(check: Awaited<ReturnType<typeof fetchCheck>>) {
  if (!check) {
    return null;
  }

  const subjects = fromJson<string[]>(check.subjects, []);
  const payload = fromJson<CheckSubmission>(check.payload, {
    mode: check.mode as CheckMode,
    title: check.title,
    subjects,
  });

  return {
    id: check.id,
    title: check.title,
    mode: check.mode as CheckMode,
    status: check.status as CheckStatus,
    createdAt: check.createdAt.toISOString(),
    updatedAt: check.updatedAt.toISOString(),
    subjects,
    vessel: payload.vessel,
    entity: payload.entity,
    pdf: payload.pdf,
    pipeline: fromJson<PipelineStep[]>(check.pipeline, []),
    findings: fromJson<Finding[]>(check.findings, []),
    citations: fromJson<Citation[]>(check.citations, []),
    reportSections: fromJson<ReportSection[]>(check.report, []),
    agentRun: fromJson<AgentRun>(check.agentRun, {
      provider: "local",
      note: "No managed-agent metadata was stored for this run.",
    }),
    sourceVersions: fromJson<SourceVersionSummary[]>(check.sourceVersions, []),
    matchCandidates: check.matches.map(mapPersistedMatchCandidate),
    matchReasons: buildMatchReasonSummaries(check.matches),
    resultSummary: fromJson<ResultSummary>(check.resultSummary, {
      confirmedMatches: 0,
      reviewMatches: 0,
      clearSources: [],
      overallStatus: "clear",
    }),
    vesselIntel: fromJson<VesselIntelCoverage>(check.vesselIntel, {
      mode: "best_effort_public",
      confidence: "low",
      summary: "No vessel intelligence was generated.",
      limitations: [],
      linkedParties: [],
      signals: [],
    }),
    docxPath: check.docxPath ?? undefined,
  } satisfies CheckRecord;
}

function buildMatchReasonSummaries(
  matches: Array<{
    id: string;
    subjectLabel: string;
    reasons: Prisma.JsonValue;
  }>,
) {
  return matches.map((match) => ({
    candidateId: match.id,
    subjectLabel: match.subjectLabel,
    summary: Array.isArray(match.reasons)
      ? (match.reasons as Array<{ detail?: string }>)
          .map((reason) => reason.detail)
          .filter(Boolean)
          .join(" ")
      : "",
  })) satisfies MatchReasonSummary[];
}

async function fetchCheck(id: string) {
  return prisma.check.findUnique({
    where: { id },
    include: {
      matches: {
        include: {
          sanctionsEntry: true,
          sourceVersion: true,
        },
        orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function createCheckShell({
  submission,
  agentRun,
  pipeline,
}: {
  submission: CheckSubmission;
  agentRun: AgentRun;
  pipeline: PipelineStep[];
}) {
  return prisma.check.create({
    data: {
      title: submission.title,
      mode: submission.mode,
      status: "running",
      subjects: toJson(submission.subjects),
      payload: toJson(submission),
      pipeline: toJson(pipeline),
      findings: toJson([]),
      report: toJson([]),
      vesselIntel: toJson({
        mode: "best_effort_public",
        confidence: "low",
        summary: "Run has started.",
        limitations: [],
        linkedParties: [],
        signals: [],
      }),
      resultSummary: toJson({
        confirmedMatches: 0,
        reviewMatches: 0,
        clearSources: [],
        overallStatus: "clear",
      }),
      sourceVersions: toJson([]),
      citations: toJson([]),
      agentRun: toJson(agentRun),
    },
  });
}

export async function updateCheckProgress({
  id,
  pipeline,
  findings,
  citations,
  sourceVersions,
  resultSummary,
  vesselIntel,
}: {
  id: string;
  pipeline?: PipelineStep[];
  findings?: Finding[];
  citations?: Citation[];
  sourceVersions?: SourceVersionSummary[];
  resultSummary?: ResultSummary;
  vesselIntel?: VesselIntelCoverage;
}) {
  await prisma.check.update({
    where: { id },
    data: {
      status: "running",
      ...(pipeline ? { pipeline: toJson(pipeline) } : {}),
      ...(findings ? { findings: toJson(findings) } : {}),
      ...(citations ? { citations: toJson(citations) } : {}),
      ...(sourceVersions ? { sourceVersions: toJson(sourceVersions) } : {}),
      ...(resultSummary ? { resultSummary: toJson(resultSummary) } : {}),
      ...(vesselIntel ? { vesselIntel: toJson(vesselIntel) } : {}),
    },
  });
}

export async function finalizeCheck({
  id,
  status,
  pipeline,
  findings,
  citations,
  reportSections,
  vesselIntel,
  resultSummary,
  sourceVersions,
  docxPath,
  matches,
}: {
  id: string;
  status: CheckStatus;
  pipeline: PipelineStep[];
  findings: Finding[];
  citations: Citation[];
  reportSections: ReportSection[];
  vesselIntel: VesselIntelCoverage;
  resultSummary: ResultSummary;
  sourceVersions: SourceVersionSummary[];
  docxPath?: string;
  matches: Array<{
    sanctionsEntryId: string;
    sourceVersionId: string;
    subjectLabel: string;
    matchedField: string;
    matchedValue: string;
    score: number;
    strength: "exact" | "strong" | "review";
    reasons: Array<{ code: string; detail: string }>;
    isSelected: boolean;
  }>;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.matchCandidate.deleteMany({
      where: { checkId: id },
    });

    await tx.check.update({
      where: { id },
      data: {
        status,
        pipeline: toJson(pipeline),
        findings: toJson(findings),
        citations: toJson(citations),
        report: toJson(reportSections),
        vesselIntel: toJson(vesselIntel),
        resultSummary: toJson(resultSummary),
        sourceVersions: toJson(sourceVersions),
        docxPath,
      },
    });

    if (matches.length > 0) {
      await tx.matchCandidate.createMany({
        data: matches.map((match) => ({
          checkId: id,
          sanctionsEntryId: match.sanctionsEntryId,
          sourceVersionId: match.sourceVersionId,
          subjectLabel: match.subjectLabel,
          matchedField: match.matchedField,
          matchedValue: match.matchedValue,
          score: match.score,
          strength: match.strength,
          reasons: toJson(match.reasons),
          isSelected: match.isSelected,
        })),
      });
    }
  });

  const check = await fetchCheck(id);
  return mapCheckRecord(check);
}

export async function updateCheckReportPath(id: string, reportPath: string) {
  await prisma.check.update({
    where: { id },
    data: {
      docxPath: reportPath,
    },
  });
}

export async function updateCheckReportArtifacts({
  id,
  reportPath,
  reportSections,
}: {
  id: string;
  reportPath: string;
  reportSections: ReportSection[];
}) {
  await prisma.check.update({
    where: { id },
    data: {
      docxPath: reportPath,
      report: toJson(reportSections),
    },
  });
}

export async function failCheck(id: string, error: Error) {
  await prisma.check.update({
    where: { id },
    data: {
      status: "failed",
      findings: toJson([
        {
          id: "execution-failed",
          title: "Run failed",
          severity: "high",
          summary: error.message,
          rationale:
            "The check did not complete successfully. Review the import and database configuration before retrying.",
        },
      ]),
      pipeline: toJson([
        {
          key: "intake",
          label: "Intake normalization",
          status: "complete",
          detail: "The intake payload was accepted before the run failed.",
        },
        {
          key: "sanctions",
          label: "Formal sanctions lane",
          status: "attention",
          detail: error.message,
        },
      ]),
    },
  });
}

export async function getCheck(id: string) {
  return mapCheckRecord(await fetchCheck(id));
}

export async function listChecks() {
  const checks = await prisma.check.findMany({
    orderBy: { createdAt: "desc" },
  });

  return checks.map((check) => ({
    id: check.id,
    title: check.title,
    mode: check.mode as CheckMode,
    status: check.status as CheckStatus,
    createdAt: check.createdAt.toISOString(),
    subjects: fromJson<string[]>(check.subjects, []),
    confirmedMatches: fromJson<{ confirmedMatches: number; reviewMatches: number }>(
      check.resultSummary,
      {
        confirmedMatches: 0,
        reviewMatches: 0,
      },
    ).confirmedMatches,
    reviewMatches: fromJson<{ confirmedMatches: number; reviewMatches: number }>(
      check.resultSummary,
      {
        confirmedMatches: 0,
        reviewMatches: 0,
      },
    ).reviewMatches,
  })) satisfies CheckSummary[];
}

export async function listCheckSummaries() {
  return listChecks();
}
