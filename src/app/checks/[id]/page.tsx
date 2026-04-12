import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckLiveRefresh } from "@/components/check-live-refresh";
import { StatusPill } from "@/components/status-pill";
import { getCheck } from "@/lib/checks/repository";
import { formatDateTime, formatMode } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CheckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const check = await getCheck(id);

  if (!check) {
    notFound();
  }

  const isRunning = check.status === "running";
  const statusLabel =
    check.status === "running"
      ? "Started"
      : check.status === "failed"
        ? "Failed"
        : "Completed";
  const reportLabel =
    check.docxPath?.endsWith(".pdf") || !isRunning
      ? "Download Final Report (PDF)"
      : "Download Report";

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <CheckLiveRefresh status={check.status} />

      <section className="panel rounded-[2rem] p-7 lg:p-9 xl:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="eyebrow text-xs font-semibold text-muted">
              {formatMode(check.mode)}
            </p>
            <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight text-navy">
              {check.title}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
              {statusLabel} {formatDateTime(check.createdAt)} for{" "}
              {check.subjects.join(" • ")}.
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="rounded-[1.5rem] border border-line bg-white/80 px-5 py-4 text-right">
              <p className="text-sm text-muted">Execution path</p>
              <p className="mt-2 text-base font-semibold text-navy">
                {check.agentRun.provider === "anthropic-managed-agents"
                  ? "Anthropic Managed Agents"
                  : "Local live sanctions lane"}
              </p>
            </div>

            {!isRunning ? (
              <a
                href={`/api/checks/${check.id}/report`}
                className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy/90"
              >
                {reportLabel}
              </a>
            ) : (
              <div className="rounded-full border border-line bg-white/80 px-6 py-3 text-sm font-semibold text-muted">
                Final report is generating...
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="panel rounded-[2rem] p-7 xl:col-span-2">
        <div className="grid gap-4 md:grid-cols-4">
          <article className="rounded-[1.5rem] border border-line bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Confirmed / Strong
            </p>
            <p className="mt-3 text-4xl font-semibold text-navy">
              {check.resultSummary.confirmedMatches}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-line bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Review Matches
            </p>
            <p className="mt-3 text-4xl font-semibold text-navy">
              {check.resultSummary.reviewMatches}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-line bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Lists Cleared
            </p>
            <p className="mt-3 text-lg font-semibold text-navy">
              {check.resultSummary.clearSources.length > 0
                ? check.resultSummary.clearSources.map((source) => source.toUpperCase()).join(", ")
                : "None"}
            </p>
          </article>
          <article className="rounded-[1.5rem] border border-line bg-white/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Vessel Coverage
            </p>
            <p className="mt-3 text-lg font-semibold text-navy">
              {check.vesselIntel.confidence === "medium"
                ? "Best effort (medium)"
                : "Best effort (low)"}
            </p>
          </article>
        </div>
      </section>

      <section className="panel rounded-[2rem] p-7">
        <p className="eyebrow text-xs font-semibold text-muted">Pipeline</p>
        <h2 className="mt-3 font-serif text-3xl text-navy">Run status</h2>
        <div className="mt-6 space-y-4">
          {check.pipeline.map((step) => (
            <article key={step.key} className="rounded-[1.5rem] border border-line bg-white/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-navy">{step.label}</h3>
                <StatusPill kind="step" value={step.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel rounded-[2rem] p-7">
        <p className="eyebrow text-xs font-semibold text-muted">Source Versions</p>
        <h2 className="mt-3 font-serif text-3xl text-navy">Tracked provenance</h2>
        <div className="mt-6 space-y-4">
          {check.sourceVersions.map((version) => (
            <a
              key={version.id}
              href={version.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[1.5rem] border border-line bg-white/80 p-5 transition hover:border-navy/20 hover:bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-navy">
                  {version.source.toUpperCase()} ({version.sourceMode})
                </h3>
                <p className="text-sm text-muted">{formatDateTime(version.fetchedAt)}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                {version.label} • {version.entryCount.toLocaleString()} entries • checksum{" "}
                {version.checksum.slice(0, 12)}...
              </p>
            </a>
          ))}
        </div>
      </section>

      <section className="panel rounded-[2rem] p-7">
        <p className="eyebrow text-xs font-semibold text-muted">Matches</p>
        <h2 className="mt-3 font-serif text-3xl text-navy">Candidate results</h2>
        <div className="mt-6 space-y-4">
          {check.matchCandidates.length > 0 ? (
            check.matchCandidates.map((candidate) => (
              <article
                key={candidate.id}
                className="rounded-[1.5rem] border border-line bg-white/80 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      {candidate.subjectLabel} • {candidate.source.toUpperCase()} •{" "}
                      {candidate.sourceMode}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-navy">
                      {candidate.primaryName}
                    </h3>
                  </div>
                  <StatusPill
                    kind="severity"
                    value={candidate.strength === "review" ? "watch" : "high"}
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-ink">
                  {candidate.matchedField} match on {candidate.matchedValue} with score{" "}
                  {candidate.score.toFixed(2)}.
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {candidate.reasons.map((reason) => reason.detail).join(" ")}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-line bg-white/80 p-5 text-sm text-muted">
              No candidates exceeded the exact or fuzzy review thresholds in the current OFAC and EU datasets.
            </div>
          )}
        </div>
      </section>

      <section className="panel rounded-[2rem] p-7">
        <p className="eyebrow text-xs font-semibold text-muted">Findings</p>
        <h2 className="mt-3 font-serif text-3xl text-navy">Review points</h2>
        <div className="mt-6 space-y-4">
          {check.findings.map((finding) => (
            <article key={finding.id} className="rounded-[1.5rem] border border-line bg-white/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-navy">{finding.title}</h3>
                <StatusPill kind="severity" value={finding.severity} />
              </div>
              <p className="mt-3 text-sm leading-6 text-ink">{finding.summary}</p>
              <p className="mt-3 text-sm leading-6 text-muted">{finding.rationale}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel rounded-[2rem] p-7">
        <p className="eyebrow text-xs font-semibold text-muted">Vessel Intelligence</p>
        <h2 className="mt-3 font-serif text-3xl text-navy">Coverage and signals</h2>
        <p className="mt-4 text-sm leading-6 text-muted">{check.vesselIntel.summary}</p>
        {check.vesselIntel.syntheticScenario ? (
          <div className="mt-6 rounded-[1.75rem] border border-amber-300 bg-[linear-gradient(135deg,rgba(255,248,232,0.96),rgba(247,241,231,0.92))] p-6 shadow-[0_24px_60px_rgba(18,38,58,0.08)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                {check.vesselIntel.syntheticScenario.label}
              </p>
              <h3 className="mt-3 font-serif text-3xl text-navy">
                {check.vesselIntel.syntheticScenario.title}
              </h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-ink">
              {check.vesselIntel.syntheticScenario.summary}
            </p>
            <p className="mt-4 rounded-[1.25rem] border border-amber-300/80 bg-white/70 px-4 py-3 text-sm leading-6 text-amber-900">
              {check.vesselIntel.syntheticScenario.legalNotice}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {check.vesselIntel.syntheticScenario.counterparties.map((counterparty) => (
                <article
                  key={`${counterparty.vesselName}-${counterparty.imoNumber}`}
                  className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    {counterparty.role}
                  </p>
                  <h4 className="mt-2 text-xl font-semibold text-navy">
                    {counterparty.vesselName}
                  </h4>
                  <p className="mt-2 text-sm font-medium text-ink">
                    IMO {counterparty.imoNumber}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted">{counterparty.note}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {check.vesselIntel.syntheticScenario.timeline.map((event) => (
                <article
                  key={`${event.timestamp}-${event.vesselName}-${event.aisStatus}`}
                  className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                        {event.timestamp}
                      </p>
                      <h4 className="mt-2 text-lg font-semibold text-navy">
                        {event.vesselName} • IMO {event.imoNumber}
                      </h4>
                    </div>
                    <div className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-navy">
                      {event.aisStatus}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink">
                    {event.area} • Course {event.course} • {event.speedKnots} knots
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">{event.detail}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/70 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                STS assessment
              </p>
              <h4 className="mt-3 text-lg font-semibold text-navy">
                {check.vesselIntel.syntheticScenario.stsAssessment.area}
              </h4>
              <p className="mt-2 text-sm leading-6 text-ink">
                Window: {check.vesselIntel.syntheticScenario.stsAssessment.window}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">
                {check.vesselIntel.syntheticScenario.stsAssessment.narrative}
              </p>
            </div>
          </div>
        ) : null}
        <div className="mt-6 space-y-4">
          {check.vesselIntel.signals.map((signal) => (
            <article key={signal.id} className="rounded-[1.5rem] border border-line bg-white/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-navy">{signal.title}</h3>
                <StatusPill kind="severity" value={signal.severity} />
              </div>
              <p className="mt-3 text-sm leading-6 text-ink">{signal.detail}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-muted">
                {signal.sourceLabel}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-[1.5rem] border border-line bg-white/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Coverage limits
          </p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-muted">
            {check.vesselIntel.limitations.map((limitation) => (
              <p key={limitation}>{limitation}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="panel rounded-[2rem] p-7">
        <p className="eyebrow text-xs font-semibold text-muted">Draft Report</p>
        <h2 className="mt-3 font-serif text-3xl text-navy">Memo outline</h2>
        <div className="mt-6 space-y-4">
          {check.reportSections.map((section) => (
            <article key={section.title} className="rounded-[1.5rem] border border-line bg-white/80 p-5">
              <h3 className="text-lg font-semibold text-navy">{section.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel rounded-[2rem] p-7 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow text-xs font-semibold text-muted">Next run</p>
            <h2 className="mt-3 font-serif text-3xl text-navy">Screen another matter</h2>
            <p className="mt-4 max-w-4xl text-base leading-7 text-muted">
              This run now stores imported source versions, match candidates, and a presentation-ready downloadable report so we can review exact provenance rather than a prototype placeholder.
            </p>
          </div>
          <Link
            href="/checks/new"
            className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy/90"
          >
            Start Another Check
          </Link>
        </div>
      </section>
    </div>
  );
}
