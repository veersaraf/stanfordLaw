"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-5 py-2.5 text-sm font-medium text-primary shadow-sm transition hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
      {pending ? "Running..." : label}
    </button>
  );
}
