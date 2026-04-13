export const dynamic = "force-dynamic";

export default function BuildNotesPage() {
  return (
    <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="panel rounded-[2rem] p-7 lg:p-9">
        <p className="eyebrow text-xs font-semibold text-muted">Build Notes</p>
        <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-[0.95] tracking-tight text-navy">
          What this prototype does, and what it intentionally leaves out.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
          Phase One now stretches through vessel intelligence, so every vessel-linked intake path prepares sanctions screening and best-effort vessel review together.
        </p>
      </section>

      <aside className="panel rounded-[2rem] p-7">
        <p className="eyebrow text-xs font-semibold text-muted">Intake Handling</p>
        <div className="mt-4 space-y-4 text-base leading-7 text-muted">
          <p>
            PDF uploads are capped at 10MB and are stored locally under the project data directory.
          </p>
          <p>
            If Anthropic managed-agent variables are configured, a session is created automatically so the intake can be replayed in a cloud agent environment.
          </p>
          <p>
            OFAC imports are live, EU runs official-first with a fallback path, and report drafts are exported as PDF. Vessel coverage remains public-data best effort without a paid AIS provider, with clearly labeled synthetic demo scenarios available for presentation where commercial AIS data is unavailable.
          </p>
        </div>
      </aside>

      <section className="panel rounded-[2rem] p-7 xl:col-span-2">
        <p className="eyebrow text-xs font-semibold text-muted">Phase One Boundaries</p>
        <h2 className="mt-3 font-serif text-3xl text-navy">What this build covers</h2>
        <div className="mt-6 grid gap-4 text-base leading-7 text-muted md:grid-cols-2">
          <p>
            Intake assumes both manual entry and PDF uploads. Submissions are stored in Postgres, text is extracted from uploaded PDFs, sanctions source versions are imported, and explainable match candidates are saved alongside the run.
          </p>
          <p>
            Vessel intelligence remains best-effort public-data coverage without a paid AIS provider, and EU official direct automation can be upgraded as soon as a session credential is provided.
          </p>
        </div>
      </section>
    </div>
  );
}
