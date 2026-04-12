import Link from "next/link";
import { listChecks } from "@/lib/checks/repository";
import { formatDateTime, formatMode } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const checks = await listChecks();

  return (
    <div className="space-y-6">
      <section className="panel rounded-[2rem] p-7 lg:p-9">
        <p className="eyebrow text-xs font-semibold text-muted">History</p>
        <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight text-navy">
          Saved checks and reusable matter context.
        </h1>
      </section>

      <section className="space-y-4">
        {checks.length > 0 ? (
          checks.map((check) => (
            <Link
              key={check.id}
              href={`/checks/${check.id}`}
              className="panel block rounded-[1.8rem] p-6 transition hover:border-navy/25 hover:bg-white/80"
            >
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    {formatMode(check.mode)}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-navy">{check.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {check.subjects.join(" • ")}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    {check.confirmedMatches} confirmed / {check.reviewMatches} review
                  </p>
                </div>
                <p className="text-sm text-muted">{formatDateTime(check.createdAt)}</p>
              </div>
            </Link>
          ))
        ) : (
          <div className="panel rounded-[1.8rem] p-6 text-muted">
            No saved checks yet. Once you submit a vessel, entity, or PDF intake, it will show up here.
          </div>
        )}
      </section>
    </div>
  );
}
