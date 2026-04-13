import { CheckIntakeForm } from "@/components/check-intake-form";

export const dynamic = "force-dynamic";

export default function NewCheckPage() {
  return (
    <div className="flex flex-col gap-8">
      <CheckIntakeForm />
    </div>
  );
}
