import Link from "next/link";
import { listChecks } from "@/lib/checks/repository";
import { formatDateTime, formatMode } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const checks = await listChecks();

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-serif text-[2rem] leading-[1.1] tracking-[-0.02em] text-ink">
          History
        </h1>
        <p className="mt-2 text-sm text-muted">
          All completed and in-progress screening checks.
        </p>
      </section>

      {checks.length > 0 ? (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {checks.map((check) => (
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
                  {(check.confirmedMatches > 0 || check.reviewMatches > 0) && (
                    <>
                      <span className="text-[11px] text-muted">·</span>
                      <span className="text-[11px] text-muted">
                        {check.confirmedMatches} confirmed · {check.reviewMatches} review
                      </span>
                    </>
                  )}
                </div>
                <p className="mt-1 truncate text-sm font-medium text-ink">{check.title}</p>
                <p className="mt-1 truncate text-sm text-muted">
                  {check.subjects.join(" · ")}
                </p>
              </div>
              <p className="shrink-0 text-sm text-muted">{formatDateTime(check.createdAt)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
          No checks yet. Start with a vessel transaction, entity screen, or PDF upload.
        </div>
      )}
    </div>
  );
}
