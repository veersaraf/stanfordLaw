import type {
  CheckSubmission,
  Citation,
  Finding,
  MatchCandidate,
  PipelineStep,
  PipelineStepStatus,
  ResultSummary,
  SourceVersionSummary,
  VesselIntelCoverage,
  VesselIntelSignal,
} from "@/lib/checks/types";
import { buildSyntheticVesselScenario } from "@/lib/vessel-intel/demo-scenarios";

const riskTerms = [
  "iran",
  "russia",
  "venezuela",
  "north korea",
  "cuba",
  "syria",
  "crimea",
  "libya",
  "south sudan",
];

function buildStep(
  key: string,
  label: string,
  status: PipelineStepStatus,
  detail: string,
): PipelineStep {
  return { key, label, status, detail };
}

function gatherRiskJurisdictions(submission: CheckSubmission) {
  const text = [
    submission.vessel?.flag,
    submission.vessel?.registry,
    submission.vessel?.deliveryPlace,
    submission.vessel?.notes,
    submission.entity?.address,
    submission.entity?.nationality,
    submission.entity?.notes,
    submission.pdf?.note,
    submission.pdf?.extractedText,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  return riskTerms.filter((term) => text.includes(term));
}

function buildResultSummary(
  matchCandidates: MatchCandidate[],
  sourceVersions: SourceVersionSummary[],
): ResultSummary {
  const confirmedMatches = matchCandidates.filter((match) => match.strength !== "review").length;
  const reviewMatches = matchCandidates.filter((match) => match.strength === "review").length;
  const matchedSources = new Set(matchCandidates.map((match) => match.source));
  const clearSources = sourceVersions
    .map((version) => version.source)
    .filter((source, index, values) => values.indexOf(source) === index)
    .filter((source) => !matchedSources.has(source));

  return {
    confirmedMatches,
    reviewMatches,
    clearSources,
    overallStatus:
      confirmedMatches > 0 ? "match" : reviewMatches > 0 ? "review" : "clear",
  };
}

function buildVesselSignals(
  submission: CheckSubmission,
  matchCandidates: MatchCandidate[],
  sourceVersions: SourceVersionSummary[],
) {
  const signals: VesselIntelSignal[] = [];
  const linkedParties =
    submission.mode === "vessel" && submission.vessel
      ? [
          submission.vessel.ownerName,
          submission.vessel.operatorName,
          submission.vessel.managerName,
          submission.vessel.sellerName,
          submission.vessel.buyerName,
          submission.vessel.guarantor,
          submission.vessel.depositHolder,
        ].filter((value): value is string => Boolean(value))
      : submission.mode === "pdf" && submission.pdf
        ? [
            submission.pdf.parsedFields.ownerName,
            submission.pdf.parsedFields.operatorName,
            submission.pdf.parsedFields.managerName,
            submission.pdf.parsedFields.sellerName,
            submission.pdf.parsedFields.buyerName,
          ].filter((value): value is string => Boolean(value))
        : [];
  const jurisdictions = gatherRiskJurisdictions(submission);
  const vesselName =
    submission.vessel?.vesselName ?? submission.pdf?.parsedFields.vesselName;
  const imoNumber =
    submission.vessel?.imoNumber ?? submission.pdf?.parsedFields.imoNumber;

  if (submission.mode !== "entity") {
    signals.push({
      id: "identifier-coverage",
      title: imoNumber ? "IMO resolved" : "IMO missing",
      severity: imoNumber ? "clear" : "watch",
      detail: imoNumber
        ? `IMO ${imoNumber} is available for best-effort vessel normalization and sanctions cross-checking.`
        : "No IMO was captured, so vessel context is name-led and lower confidence.",
      sourceLabel: "Intake payload",
    });
  }

  if (jurisdictions.length > 0) {
    signals.push({
      id: "risk-jurisdictions",
      title: "Jurisdiction risk terms detected",
      severity: "high",
      detail: `The intake references ${jurisdictions.join(", ")}, which should be escalated for legal review.`,
      sourceLabel: "Intake and uploaded text",
    });
  }

  for (const match of matchCandidates.filter((candidate) => candidate.strength !== "review")) {
    signals.push({
      id: `match-${match.id}`,
      title: `${match.subjectLabel} matched ${match.source.toUpperCase()}`,
      severity: "high",
      detail: `${match.subjectLabel} matched ${match.primaryName} (${match.matchedField}).`,
      sourceLabel: `${match.source.toUpperCase()} ${match.sourceMode}`,
    });
  }

  if (
    submission.mode !== "entity" &&
    sourceVersions.some((version) => version.source === "eu" && version.sourceMode === "fallback")
  ) {
    signals.push({
      id: "eu-fallback",
      title: "EU coverage is fallback-backed",
      severity: "watch",
      detail:
        "EU screening used the fallback OpenSanctions mirror because direct official EU automation is credential-gated in this environment.",
      sourceLabel: "EU data import",
    });
  }

  return {
    vesselName,
    imoNumber,
    linkedParties,
    signals,
  };
}

function buildVesselIntelCoverage(
  submission: CheckSubmission,
  matchCandidates: MatchCandidate[],
  sourceVersions: SourceVersionSummary[],
) {
  const { vesselName, imoNumber, linkedParties, signals: baseSignals } = buildVesselSignals(
    submission,
    matchCandidates,
    sourceVersions,
  );
  const syntheticScenario =
    submission.mode === "entity" ? undefined : buildSyntheticVesselScenario(submission);
  const signals = [...baseSignals];

  if (syntheticScenario) {
    signals.push(
      {
        id: "synthetic-demo-scenario",
        title: `${syntheticScenario.label} attached`,
        severity: "watch",
        detail: `${syntheticScenario.title} was added as scenario analysis support for the vessel-intelligence section. ${syntheticScenario.legalNotice}`,
        sourceLabel: syntheticScenario.label,
      },
      {
        id: "synthetic-demo-sts-sequence",
        title: "AIS-dark STS sequence analysis",
        severity: "watch",
        detail: syntheticScenario.stsAssessment.narrative,
        sourceLabel: syntheticScenario.label,
      },
    );
  }

  return {
    mode: "best_effort_public",
    confidence:
      submission.mode === "entity" ? "low" : imoNumber ? "medium" : "low",
    summary:
      submission.mode === "entity"
        ? "This run focused on sanctions screening without vessel movement coverage."
        : syntheticScenario
          ? "Vessel intelligence combines public-data best-effort screening with AIS/STS scenario analysis. No paid AIS provider is connected."
          : "Vessel intelligence is limited to public/open-source best-effort context, linked-party screening, and rule-based red flags in this phase.",
    limitations: [
      ...(syntheticScenario
        ? [
            "This report includes a vessel-intelligence scenario analysis that is not derived from commercial AIS or independently verified movement evidence.",
          ]
        : []),
      "No paid AIS provider is connected, so there is no production-grade port-call, dark-period, or STS reconstruction.",
      "Ownership and operator context is limited to names surfaced in intake, uploads, and sanctions source records.",
      "EU source provenance is disclosed per import because direct official automation may require a credentialed session.",
    ],
    linkedParties,
    vesselName,
    imoNumber,
    signals,
    syntheticScenario,
  } satisfies VesselIntelCoverage;
}

function buildFindings(
  submission: CheckSubmission,
  matchCandidates: MatchCandidate[],
  resultSummary: ResultSummary,
  vesselIntel: VesselIntelCoverage,
) {
  const findings: Finding[] = [];
  const confirmedMatches = matchCandidates.filter((match) => match.strength !== "review");
  const reviewMatches = matchCandidates.filter((match) => match.strength === "review");
  const indirectMatches = confirmedMatches.filter(
    (match) =>
      match.subjectLabel.startsWith("Linked Party from") ||
      match.reasons.some((reason) => reason.code === "linked_party_derivation"),
  );
  const relatedPartyMatches = confirmedMatches.filter(
    (match) =>
      !indirectMatches.some((indirectMatch) => indirectMatch.id === match.id) &&
      match.subjectLabel !== "Vessel" &&
      match.subjectLabel !== "PDF Vessel",
  );

  if (confirmedMatches.length > 0) {
    findings.push({
      id: "confirmed-matches",
      title: "Confirmed or strong sanctions matches detected",
      severity: "high",
      summary: `${confirmedMatches.length} match${confirmedMatches.length === 1 ? "" : "es"} require immediate legal review.`,
      rationale:
        "These results came from identifier or normalized exact matching against the imported sanctions datasets.",
      relatedMatchIds: confirmedMatches.map((match) => match.id),
    });
  }

  if (relatedPartyMatches.length > 0) {
    findings.push({
      id: "related-party-matches",
      title: "Transaction-party or control-party matches detected",
      severity: "high",
      summary: `${relatedPartyMatches.length} screened owner, operator, manager, or transaction party match${relatedPartyMatches.length === 1 ? "" : "es"} were found.`,
      rationale:
        "These are factual matches on named parties associated with the matter, not just on the vessel itself.",
      relatedMatchIds: relatedPartyMatches.map((match) => match.id),
    });
  }

  if (indirectMatches.length > 0) {
    findings.push({
      id: "indirect-connections",
      title: "Indirect sanctions connections were surfaced",
      severity: "high",
      summary: `${indirectMatches.length} connection${indirectMatches.length === 1 ? "" : "s"} were surfaced through linked-party data attached to a matched record.`,
      rationale:
        "These are factual linkages derived from names or relationship details present on matched source records.",
      relatedMatchIds: indirectMatches.map((match) => match.id),
    });
  }

  if (reviewMatches.length > 0) {
    findings.push({
      id: "review-matches",
      title: "Fuzzy review matches surfaced",
      severity: confirmedMatches.length > 0 ? "watch" : "high",
      summary: `${reviewMatches.length} fuzzy candidate${reviewMatches.length === 1 ? "" : "s"} should be reviewed before clearing the matter.`,
      rationale:
        "These results cleared the fuzzy-threshold review gate but are not treated as confirmed matches automatically.",
      relatedMatchIds: reviewMatches.map((match) => match.id),
    });
  }

  if (vesselIntel.syntheticScenario) {
    findings.push({
      id: "synthetic-demo-scenario",
      title: "Vessel-intelligence scenario attached",
      severity: "watch",
      summary: `${vesselIntel.syntheticScenario.title} was added as scenario analysis for the vessel-intelligence section.`,
      rationale:
        "This scenario analysis is included to supplement the screening when commercial maritime data is not available. It is not independently verified movement evidence.",
    });
  }

  if (resultSummary.overallStatus === "clear") {
    findings.push({
      id: "lists-cleared",
      title: "No OFAC or EU matches were found",
      severity: "clear",
      summary:
        "The current OFAC and EU datasets were checked and no candidate match cleared the review thresholds.",
      rationale:
        "This is still a legal screening output, not a compliance certification. Coverage limits remain visible in the report.",
    });
  }

  const vesselAlerts = vesselIntel.signals.filter((signal) => signal.severity !== "clear");

  if (vesselAlerts.length > 0) {
    findings.push({
      id: "vessel-intel-signals",
      title: "Vessel-intelligence signals need attention",
      severity: vesselAlerts.some((signal) => signal.severity === "high") ? "high" : "watch",
      summary: `${vesselAlerts.length} vessel or transaction-context signal${vesselAlerts.length === 1 ? "" : "s"} were surfaced.`,
      rationale:
        "These signals come from the intake payload, uploaded documents, sanctions-linked vessel details, and explicit coverage disclosures.",
    });
  }

  if (submission.mode === "pdf" && submission.pdf) {
    findings.push({
      id: "pdf-normalized",
      title: "Uploaded PDF normalized into a screening payload",
      severity: submission.pdf.extractedText ? "clear" : "watch",
      summary: submission.pdf.extractedText
        ? `The PDF yielded ${submission.pdf.extractedText.length.toLocaleString()} characters of extracted text and was screened as structured intake.`
        : "The PDF was stored, but text extraction produced limited content.",
      rationale:
        "Document-led intake uses the same screening path as manual submissions, with field extraction used where possible.",
    });
  }

  return findings;
}

function buildCitations(
  submission: CheckSubmission,
  sourceVersions: SourceVersionSummary[],
  vesselIntel: VesselIntelCoverage,
): Citation[] {
  const citations: Citation[] = sourceVersions.map((version) => ({
    id: version.id,
    label: `${version.source.toUpperCase()} dataset (${version.sourceMode})`,
    url: version.url,
    kind: "sanctions" as const,
    accessedAt: version.fetchedAt,
    sourceVersionId: version.id,
    sourceMode: version.sourceMode,
  }));

  if (submission.pdf) {
    citations.push({
      id: "uploaded-pdf",
      label: submission.pdf.fileName,
      url: submission.pdf.storedPath,
      kind: "upload",
    });
  }

  if (vesselIntel.syntheticScenario) {
    citations.push({
      id: "synthetic-demo-scenario",
      label: `${vesselIntel.syntheticScenario.label}: ${vesselIntel.syntheticScenario.title}`,
      url: "Embedded scenario analysis",
      kind: "system",
    });
  }

  return citations;
}

export function buildCheckArtifacts({
  submission,
  sourceVersions,
  matchCandidates,
}: {
  submission: CheckSubmission;
  sourceVersions: SourceVersionSummary[];
  matchCandidates: MatchCandidate[];
}) {
  const resultSummary = buildResultSummary(matchCandidates, sourceVersions);
  const vesselIntel = buildVesselIntelCoverage(
    submission,
    matchCandidates,
    sourceVersions,
  );
  const sanctionsDetail =
    resultSummary.confirmedMatches > 0
      ? `${resultSummary.confirmedMatches} confirmed/strong match${resultSummary.confirmedMatches === 1 ? "" : "es"} found.`
      : resultSummary.reviewMatches > 0
        ? `${resultSummary.reviewMatches} fuzzy review match${resultSummary.reviewMatches === 1 ? "" : "es"} found.`
        : `No matches found across ${sourceVersions.map((version) => version.source.toUpperCase()).join(" and ")}.`;
  const pipeline: PipelineStep[] = [
    buildStep(
      "intake",
      "Intake normalization",
      "complete",
      submission.mode === "pdf"
        ? "The uploaded PDF was stored, parsed, and normalized into screening subjects."
        : "The submitted form payload was normalized into structured screening subjects.",
    ),
    buildStep(
      "sanctions",
      "Formal sanctions lane",
      resultSummary.overallStatus === "match" ? "attention" : "complete",
      `${sanctionsDetail} Source versions were recorded for OFAC and EU provenance.`,
    ),
    buildStep(
      "vessel-intelligence",
      "Vessel intelligence lane",
      submission.mode === "entity"
        ? "not_applicable"
        : vesselIntel.signals.some((signal) => signal.severity === "high")
          ? "attention"
          : "complete",
      submission.mode === "entity"
        ? "This entity-led run did not require vessel context."
        : vesselIntel.summary,
    ),
    buildStep(
      "report",
      "Draft report",
      "complete",
      "A structured memo outline and PDF artifact were generated from the saved check record.",
    ),
  ];

  return {
    pipeline,
    findings: buildFindings(submission, matchCandidates, resultSummary, vesselIntel),
    citations: buildCitations(submission, sourceVersions, vesselIntel),
    resultSummary,
    vesselIntel,
  };
}
