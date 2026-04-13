import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDateTime, formatMode } from "@/lib/format";
import { listChecks } from "@/lib/checks/repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const checks = await listChecks();
  const recent = checks.slice(0, 5);
  const vesselCount = checks.filter(
    (check) => check.mode === "vessel" || check.mode === "pdf",
  ).length;

  return (
    <div className="flex flex-col gap-12">
      {/* Hero */}
      <section className="flex flex-col items-center pt-8 text-center">
        <svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-6">
          <path d="M6 8L16 4L26 8V18C26 23.5 21.5 28 16 28C10.5 28 6 23.5 6 18V8Z" stroke="#1C1C1C" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M12 16L15 19L21 13" stroke="#1C1C1C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h1 className="font-serif text-[2.75rem] leading-[1] tracking-[-0.02em] text-ink">
          Everos
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-muted">
          Screen vessels, entities, and transaction documents against live sanctions data. Generate compliance reports in minutes.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/checks/new"
            className="inline-flex items-center gap-2 rounded-lg border border-primary bg-white px-5 py-2.5 text-sm font-medium text-primary shadow-sm transition hover:bg-primary hover:text-white"
          >
            Start a check
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/history"
            className="inline-flex items-center gap-2 rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-surface"
          >
            View history
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
        <div className="bg-background p-5">
          <p className="text-sm text-muted">Checks run</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{checks.length}</p>
        </div>
        <div className="bg-background p-5">
          <p className="text-sm text-muted">Vessel screens</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{vesselCount}</p>
        </div>
        <div className="bg-background p-5">
          <p className="text-sm text-muted">Sources</p>
          <p className="mt-1 text-2xl font-semibold text-ink">OFAC + EU</p>
        </div>
      </section>

      {/* Recent checks */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Recent checks</h2>
          {checks.length > 5 && (
            <Link href="/history" className="text-sm text-muted hover:text-ink">
              View all
            </Link>
          )}
        </div>

        {recent.length > 0 ? (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {recent.map((check) => (
              <Link
                key={check.id}
                href={`/checks/${check.id}`}
                className="flex items-center justify-between gap-4 bg-background px-5 py-4 transition hover:bg-surface"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                      {formatMode(check.mode)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-ink">{check.title}</p>
                  <p className="mt-1 truncate text-sm text-muted">
                    {check.subjects.join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-muted">{formatDateTime(check.createdAt)}</p>
                  {(check.confirmedMatches > 0 || check.reviewMatches > 0) && (
                    <p className="mt-1 text-xs text-muted">
                      {check.confirmedMatches} confirmed · {check.reviewMatches} review
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
            No checks yet. Start with a vessel transaction, entity screen, or PDF upload.
          </div>
        )}
      </section>

      {/* Capabilities */}
      <section className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
        <div className="bg-background p-5">
          <h3 className="text-sm font-semibold text-ink">Sanctions screening</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            OFAC official source, EU official-first with fallback provenance. Exact, fuzzy, and linked-party matching.
          </p>
        </div>
        <div className="bg-background p-5">
          <h3 className="text-sm font-semibold text-ink">Vessel intelligence</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Best-effort public-data vessel context with coverage limits clearly disclosed for legal review.
          </p>
        </div>
        <div className="bg-background p-5">
          <h3 className="text-sm font-semibold text-ink">PDF intake</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Upload transaction documents. Text extraction, field normalization, and automated subject resolution.
          </p>
        </div>
      </section>
    </div>
  );
}
