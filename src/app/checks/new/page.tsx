import { CheckIntakeForm } from "@/components/check-intake-form";

export const dynamic = "force-dynamic";

export default function NewCheckPage() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="font-serif text-[2rem] leading-[1.1] tracking-[-0.02em] text-ink">
          New check
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
          Enter vessel details, screen an entity, or upload a PDF. The system imports live sanctions data, screens all subjects, and generates a compliance report.
        </p>
      </section>

      <CheckIntakeForm />
    </div>
  );
}
