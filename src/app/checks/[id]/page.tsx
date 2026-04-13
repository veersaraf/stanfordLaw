import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckLiveRefresh } from "@/components/check-live-refresh";
import { CheckResultsGate } from "@/components/check-results-gate";
import { StatusPill } from "@/components/status-pill";
import { getCheck } from "@/lib/checks/repository";
import { formatDateTime, formatMode } from "@/lib/format";

export const dynamic = "force-dynamic";

function Section({
  label,
  title,
  children,
  defaultOpen = false,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-line bg-background">
      <summary className="flex cursor-pointer items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
          <h2 className="mt-1 text-base font-semibold text-ink">{title}</h2>
        </div>
        <svg className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" viewBox="0 0 16 16" fill="none">
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </summary>
      <div className="border-t border-line px-5 py-4">
        {children}
      </div>
    </details>
  );
}

export default async function CheckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const check = await getCheck(id);

  if (!check) notFound();

  const isRunning = check.status === "running";
  const isFailed = check.status === "failed";

  return (
    <div className="flex flex-col gap-4">
      {/* Header — always visible */}
      <section className="rounded-xl border border-line bg-background p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                {formatMode(check.mode)}
              </span>
              <span className="text-[11px] text-muted">·</span>
              <span className="text-[11px] text-muted">{formatDateTime(check.createdAt)}</span>
            </div>
            <h1 className="mt-2 font-serif text-[1.75rem] leading-[1.1] tracking-[-0.02em] text-ink">
              {check.title}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {check.subjects.join(" · ")}
            </p>
          </div>
        </div>
      </section>

      {/* Screening animation — controls its own lifecycle */}
      <CheckLiveRefresh status={check.status} />

      {/* Everything below is gated: hidden while animation plays */}
      <CheckResultsGate status={check.status}>
        {/* Status bar */}
        <section className="flex items-center justify-between rounded-xl border border-line bg-background px-5 py-3">
          <div className="flex items-center gap-3">
            {isFailed ? (
              <span className="rounded-md bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                Failed
              </span>
            ) : (
              <span className="rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                Complete
              </span>
            )}
            <span className="text-sm text-muted">
              Screening finished {formatDateTime(check.createdAt)}
            </span>
          </div>
          {!isFailed && (
            <a
              href={`/api/checks/${check.id}/report`}
              className="rounded-lg border border-primary bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm transition hover:bg-primary hover:text-white"
            >
              Download report
            </a>
          )}
        </section>

        {/* Result summary */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
          <div className="bg-background p-4">
            <p className="text-xs text-muted">Confirmed</p>
            <p className="mt-1 text-xl font-semibold text-ink">{check.resultSummary.confirmedMatches}</p>
          </div>
          <div className="bg-background p-4">
            <p className="text-xs text-muted">Review</p>
            <p className="mt-1 text-xl font-semibold text-ink">{check.resultSummary.reviewMatches}</p>
          </div>
          <div className="bg-background p-4">
            <p className="text-xs text-muted">Lists cleared</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {check.resultSummary.clearSources.length > 0
                ? check.resultSummary.clearSources.map((s) => s.toUpperCase()).join(", ")
                : "None"}
            </p>
          </div>
          <div className="bg-background p-4">
            <p className="text-xs text-muted">Vessel coverage</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {check.vesselIntel.confidence === "medium" ? "Medium" : "Low"} (best effort)
            </p>
          </div>
        </section>

        {/* Pipeline steps */}
        <Section label="Pipeline" title="Run status">
          <div className="space-y-0">
            {check.pipeline.map((step, index) => (
              <div key={step.key} className="flex gap-3 py-2">
                <div className="flex flex-col items-center">
                  {step.status === "complete" ? (
                    <span className="mt-0.5 text-base leading-none text-success">&#9679;</span>
                  ) : step.status === "attention" ? (
                    <span className="mt-0.5 text-base leading-none text-warning">&#9679;</span>
                  ) : (
                    <span className="mt-0.5 text-base leading-none text-line">&#9675;</span>
                  )}
                  {index < check.pipeline.length - 1 && (
                    <div className={`mt-1 w-px flex-1 ${step.status === "complete" ? "bg-success/30" : "bg-line"}`} />
                  )}
                </div>
                <div className="pb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink">{step.label}</p>
                    <StatusPill kind="step" value={step.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Match candidates */}
        <Section
          label="Matches"
          title={`${check.matchCandidates.length} candidate${check.matchCandidates.length !== 1 ? "s" : ""}`}
          defaultOpen={check.matchCandidates.length > 0}
        >
          {check.matchCandidates.length > 0 ? (
            <div className="space-y-3">
              {check.matchCandidates.map((candidate) => (
                <div key={candidate.id} className="rounded-lg border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted">
                        {candidate.subjectLabel} · {candidate.source.toUpperCase()} · {candidate.sourceMode}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-ink">{candidate.primaryName}</p>
                    </div>
                    <StatusPill
                      kind="severity"
                      value={candidate.strength === "review" ? "watch" : "high"}
                    />
                  </div>
                  <p className="mt-2 text-sm text-ink">
                    {candidate.matchedField} match on <span className="font-medium">{candidate.matchedValue}</span> — score {candidate.score.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {candidate.reasons.map((r) => r.detail).join(" ")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              No candidates exceeded the review threshold in current OFAC and EU datasets.
            </p>
          )}
        </Section>

        {/* Findings */}
        {check.findings.length > 0 && (
          <Section label="Findings" title="Review points" defaultOpen>
            <div className="space-y-3">
              {check.findings.map((finding) => (
                <div key={finding.id} className="rounded-lg border border-line p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-ink">{finding.title}</h3>
                    <StatusPill kind="severity" value={finding.severity} />
                  </div>
                  <p className="mt-2 text-sm text-ink">{finding.summary}</p>
                  <p className="mt-1 text-xs text-muted">{finding.rationale}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Source versions */}
        <Section label="Provenance" title="Source versions">
          <div className="space-y-2">
            {check.sourceVersions.map((version) => (
              <a
                key={version.id}
                href={version.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-line p-3 transition hover:bg-surface"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">
                    {version.source.toUpperCase()} ({version.sourceMode})
                  </p>
                  <p className="text-xs text-muted">{formatDateTime(version.fetchedAt)}</p>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {version.label} · {version.entryCount.toLocaleString()} entries · {version.checksum.slice(0, 12)}…
                </p>
              </a>
            ))}
          </div>
        </Section>

        {/* Vessel intelligence */}
        <Section label="Vessel Intelligence" title="Coverage and signals">
          <p className="text-sm text-muted">{check.vesselIntel.summary}</p>

          {check.vesselIntel.syntheticScenario && (
            <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-warning">
                {check.vesselIntel.syntheticScenario.label}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-ink">
                {check.vesselIntel.syntheticScenario.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink">
                {check.vesselIntel.syntheticScenario.summary}
              </p>
              <p className="mt-3 rounded-md border border-warning/20 bg-background px-3 py-2 text-xs leading-5 text-warning">
                {check.vesselIntel.syntheticScenario.legalNotice}
              </p>

              {check.vesselIntel.syntheticScenario.counterparties.length > 0 && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {check.vesselIntel.syntheticScenario.counterparties.map((cp) => (
                    <div key={`${cp.vesselName}-${cp.imoNumber}`} className="rounded-md border border-line bg-background p-3">
                      <p className="text-xs text-muted">{cp.role}</p>
                      <p className="mt-0.5 text-sm font-medium text-ink">{cp.vesselName}</p>
                      <p className="text-xs text-muted">IMO {cp.imoNumber}</p>
                      <p className="mt-1 text-xs text-muted">{cp.note}</p>
                    </div>
                  ))}
                </div>
              )}

              {check.vesselIntel.syntheticScenario.timeline.length > 0 && (
                <div className="mt-3 space-y-2">
                  {check.vesselIntel.syntheticScenario.timeline.map((event) => (
                    <div key={`${event.timestamp}-${event.vesselName}`} className="rounded-md border border-line bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted">{event.timestamp}</p>
                          <p className="text-sm font-medium text-ink">{event.vesselName} · IMO {event.imoNumber}</p>
                        </div>
                        <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                          {event.aisStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink">
                        {event.area} · Course {event.course} · {event.speedKnots} kn
                      </p>
                      <p className="mt-1 text-xs text-muted">{event.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {check.vesselIntel.syntheticScenario.stsAssessment && (
                <div className="mt-3 rounded-md border border-line bg-background p-3">
                  <p className="text-xs text-muted">STS assessment</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">
                    {check.vesselIntel.syntheticScenario.stsAssessment.area}
                  </p>
                  <p className="text-xs text-muted">
                    Window: {check.vesselIntel.syntheticScenario.stsAssessment.window}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {check.vesselIntel.syntheticScenario.stsAssessment.narrative}
                  </p>
                </div>
              )}
            </div>
          )}

          {check.vesselIntel.signals.length > 0 && (
            <div className="mt-4 space-y-2">
              {check.vesselIntel.signals.map((signal) => (
                <div key={signal.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-ink">{signal.title}</h3>
                    <StatusPill kind="severity" value={signal.severity} />
                  </div>
                  <p className="mt-1 text-sm text-ink">{signal.detail}</p>
                  <p className="mt-1 text-xs text-muted">{signal.sourceLabel}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-md border border-line p-3">
            <p className="text-xs font-medium text-muted">Coverage limits</p>
            <div className="mt-1 space-y-1">
              {check.vesselIntel.limitations.map((limitation) => (
                <p key={limitation} className="text-xs text-muted">· {limitation}</p>
              ))}
            </div>
          </div>
        </Section>

        {/* Report sections */}
        {check.reportSections.length > 0 && (
          <Section label="Draft Report" title="Memo outline" defaultOpen>
            <div className="space-y-4">
              {check.reportSections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{section.body}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Footer action */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-background px-5 py-4">
          <p className="text-sm text-muted">Screen another vessel, entity, or document.</p>
          <Link
            href="/checks/new"
            className="shrink-0 rounded-lg border border-primary bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm transition hover:bg-primary hover:text-white"
          >
            New check
          </Link>
        </div>
      </CheckResultsGate>
    </div>
  );
}
