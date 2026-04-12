import { CheckIntakeForm } from "@/components/check-intake-form";

export const dynamic = "force-dynamic";

export default function NewCheckPage() {
  return (
    <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="panel rounded-[2rem] p-7 lg:p-9">
        <p className="eyebrow text-xs font-semibold text-muted">New Check</p>
        <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-[0.95] tracking-tight text-navy">
          Start from manual entry or a PDF, then push the matter into the sanctions workflow.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
          Phase One now stretches through vessel intelligence, so every vessel-linked intake path prepares sanctions screening and best-effort vessel review together.
        </p>
      </section>

      <aside className="panel rounded-[2rem] p-7">
        <p className="eyebrow text-xs font-semibold text-muted">Build Notes</p>
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

      <section className="xl:col-span-2">
        <CheckIntakeForm />
      </section>
    </div>
  );
}
