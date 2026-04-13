import Link from "next/link";
import { ArrowRight, FileText, Radar, ShipWheel } from "lucide-react";

export const dynamic = "force-dynamic";

const modes = [
  {
    title: "Vessel + Transaction",
    copy: "Manual BIMCO-style intake for a vessel deal. Provide the vessel (name or IMO), counterparties, and flag — the pipeline screens each subject and any linked parties it can derive.",
    icon: ShipWheel,
  },
  {
    title: "Entity / Individual",
    copy: "Counterparty screening for a company, director, or person. Add aliases and identifiers to strengthen matching.",
    icon: Radar,
  },
  {
    title: "PDF Upload",
    copy: "Upload a transaction document (up to 10MB). The system extracts text, normalizes vessel and party details, and feeds them into the sanctions and vessel lanes.",
    icon: FileText,
  },
];

export default function InstructionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <section className="panel rounded-[2rem] p-7 lg:p-9">
        <p className="eyebrow text-xs font-semibold text-muted">Instructions</p>
        <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-[0.95] tracking-tight text-navy">
          Three ways to start a check, one shared review pipeline.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
          Pick the intake that fits the matter. Every path writes to the same check register and produces a downloadable draft report once the run finishes.
        </p>
        <div className="mt-8">
          <Link
            href="/checks/new"
            className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy/90"
          >
            Start a new check
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="panel rounded-[2rem] p-7 lg:p-9">
        <p className="eyebrow text-xs font-semibold text-muted">New Check</p>
        <h2 className="mt-3 max-w-3xl font-serif text-5xl leading-[0.95] tracking-tight text-navy">
          Start from manual entry or a PDF, then push the matter into the sanctions workflow.
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
          Phase One now stretches through vessel intelligence, so every vessel-linked intake path prepares sanctions screening and best-effort vessel review together.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {modes.map(({ title, copy, icon: Icon }) => (
          <article key={title} className="panel rounded-[1.75rem] p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy/8 text-navy">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-5 font-serif text-2xl leading-tight text-navy">{title}</h2>
            <p className="mt-3 text-base leading-7 text-muted">{copy}</p>
          </article>
        ))}
      </section>

      <section className="panel rounded-[2rem] p-7">
        <p className="eyebrow text-xs font-semibold text-muted">What happens after submit</p>
        <h2 className="mt-3 font-serif text-3xl text-navy">The run pipeline</h2>
        <ol className="mt-6 space-y-4 text-base leading-7 text-muted">
          <li>
            <span className="font-semibold text-navy">1. Intake</span> — the submitted payload is stored and a check record is created in Postgres with status <code>queued</code>.
          </li>
          <li>
            <span className="font-semibold text-navy">2. Sources</span> — OFAC and EU source versions refresh if they are older than 24 hours. Every imported dataset is checksummed so findings are reproducible.
          </li>
          <li>
            <span className="font-semibold text-navy">3. Matching</span> — subjects are screened against normalized sanctions entries using identifier-exact, name-exact, and fuzzy strategies. Each candidate carries explainable reasons.
          </li>
          <li>
            <span className="font-semibold text-navy">4. Report</span> — a DOCX/PDF draft is generated with findings, citations, and vessel-intel coverage notes, available from the check detail page.
          </li>
        </ol>
      </section>

      <section className="panel rounded-[2rem] p-7">
        <p className="eyebrow text-xs font-semibold text-muted">Tips</p>
        <div className="mt-4 grid gap-4 text-base leading-7 text-muted md:grid-cols-2">
          <p>
            For vessel intake, providing both the vessel name and IMO strengthens linked-party derivation and reduces review-strength candidates.
          </p>
          <p>
            Use the flag combobox to pick a registry country — start typing the country name and select from the list so the value is consistent across runs.
          </p>
          <p>
            For entity intake, include known aliases and the company registration number when possible. Identifier-exact matches are the strongest signal.
          </p>
          <p>
            The run continues after the response returns. Use the live-refresh status on the check page (or the history list) to watch progress.
          </p>
        </div>
      </section>
    </div>
  );
}
