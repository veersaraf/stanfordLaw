import Link from "next/link";
import {
  ArrowRight,
  FileUp,
  Gavel,
  Radar,
  Scale,
  ShipWheel,
} from "lucide-react";
import { formatDateTime, formatMode } from "@/lib/format";
import { listChecks } from "@/lib/checks/repository";

export const dynamic = "force-dynamic";

const laneCards = [
  {
    title: "Formal Sanctions",
    copy: "OFAC is imported from the official source and EU runs official-first with fallback-ready provenance.",
    icon: Scale,
  },
  {
    title: "Vessel Intelligence",
    copy: "Best-effort public-data vessel context, linked-party checks, and explicit coverage limits for legal review.",
    icon: ShipWheel,
  },
  {
    title: "PDF-Led Intake",
    copy: "Upload transaction documents, extract text, and normalize vessel and party details into the workflow.",
    icon: FileUp,
  },
];

export default async function Home() {
  const checks = await listChecks();
  const recent = checks.slice(0, 4);
  const vesselCount = checks.filter(
    (check) => check.mode === "vessel" || check.mode === "pdf",
  ).length;

  return (
    <div className="flex flex-col gap-10">
      <section className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="panel rich-card rounded-[2rem] p-8 lg:p-10">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <span className="eyebrow rounded-full border border-navy/15 bg-white/70 px-4 py-2 text-[11px] font-semibold text-navy/75">
              Phase One In Build
            </span>
            <span className="eyebrow rounded-full bg-accent-soft px-4 py-2 text-[11px] font-semibold text-accent">
              PDF Upload Included
            </span>
          </div>
          <div className="max-w-3xl">
            <p className="eyebrow mb-4 text-xs font-semibold text-navy/70">
              Maritime due diligence workspace
            </p>
            <h1 className="max-w-4xl font-serif text-5xl leading-[0.95] tracking-tight text-navy sm:text-6xl lg:text-7xl">
              Sanctions checks, vessel intelligence, and transaction intake in one legal workflow.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
              This build now covers the Phase One span you set: formal sanctions through vessel intelligence, with manual entry and PDF-led intake feeding the same review pipeline.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/checks/new"
              className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy/90"
            >
              Start A Check
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white/75 px-6 py-3 text-sm font-semibold text-navy transition hover:border-navy/25 hover:bg-white"
            >
              Review Prior Runs
            </Link>
          </div>
        </div>
        <div className="panel rounded-[2rem] p-6 lg:p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow text-xs font-semibold text-muted">Workspace Pulse</p>
              <h2 className="mt-3 font-serif text-3xl text-navy">Live Prototype Snapshot</h2>
            </div>
            <Radar className="h-8 w-8 text-accent" />
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-line/90 bg-white/85 p-5">
              <p className="text-sm text-muted">Checks Logged</p>
              <p className="mt-2 text-4xl font-semibold text-navy">{checks.length}</p>
            </div>
            <div className="rounded-[1.5rem] border border-line/90 bg-white/85 p-5">
              <p className="text-sm text-muted">Vessel Lanes</p>
              <p className="mt-2 text-4xl font-semibold text-navy">{vesselCount}</p>
            </div>
            <div className="rounded-[1.5rem] border border-line/90 bg-white/85 p-5 sm:col-span-2">
              <p className="text-sm text-muted">Current orchestration</p>
              <p className="mt-2 text-lg leading-7 text-ink">
                Live sanctions ingestion is active now, and Anthropic Managed Agents can be turned on with environment credentials for session-backed runs.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {laneCards.map(({ title, copy, icon: Icon }) => (
          <article key={title} className="panel rounded-[1.75rem] p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy/8 text-navy">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-5 font-serif text-3xl leading-tight text-navy">{title}</h2>
            <p className="mt-3 text-base leading-7 text-muted">{copy}</p>
          </article>
        ))}
      </section>

      <section>
        <article className="panel rounded-[2rem] p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-xs font-semibold text-muted">Recent Activity</p>
              <h2 className="mt-3 font-serif text-3xl text-navy">Check Register</h2>
            </div>
            <Gavel className="h-8 w-8 text-accent" />
          </div>
          <div className="mt-6 space-y-4">
            {recent.length > 0 ? (
              recent.map((check) => (
                <Link
                  key={check.id}
                  href={`/checks/${check.id}`}
                  className="block rounded-[1.5rem] border border-line/90 bg-white/80 p-5 transition hover:border-navy/25 hover:bg-white"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        {formatMode(check.mode)}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-navy">{check.title}</h3>
                    </div>
                    <p className="text-sm text-muted">{formatDateTime(check.createdAt)}</p>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">
                    {check.subjects.join(" • ")}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-line bg-white/55 p-6 text-muted">
                No checks yet. Start with a vessel transaction, an entity screen, or a PDF upload.
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
