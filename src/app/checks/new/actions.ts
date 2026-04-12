"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { executeCheckRun, startCheckRun } from "@/lib/agents/orchestrator";
import { buildSubmissionFromFormData } from "@/lib/checks/parser";
import type { IntakeActionState } from "@/lib/checks/schema";

export async function submitCheck(
  _prevState: IntakeActionState,
  formData: FormData,
) {
  const parsed = await buildSubmissionFromFormData(formData);

  if (!parsed.success) {
    return parsed.state;
  }

  const started = await startCheckRun(parsed.submission);

  after(async () => {
    await executeCheckRun({
      id: started.id,
      submission: parsed.submission,
      agentRun: started.agentRun,
    });
  });

  redirect(`/checks/${started.id}`);
}
