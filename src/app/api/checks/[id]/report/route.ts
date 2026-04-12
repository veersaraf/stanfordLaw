import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  getCheck,
  updateCheckReportArtifacts,
} from "@/lib/checks/repository";
import type { CheckSubmission } from "@/lib/checks/types";
import { executeCheckRun } from "@/lib/agents/orchestrator";
import {
  generateDraftReportDocument,
  generateDraftReportSections,
} from "@/lib/report/generator";
import { getStorageRoot } from "@/lib/storage/fs-store";

export const dynamic = "force-dynamic";

function toSubmission(check: NonNullable<Awaited<ReturnType<typeof getCheck>>>) {
  return {
    mode: check.mode,
    title: check.title,
    subjects: check.subjects,
    ...(check.vessel ? { vessel: check.vessel } : {}),
    ...(check.entity ? { entity: check.entity } : {}),
    ...(check.pdf ? { pdf: check.pdf } : {}),
  } satisfies CheckSubmission;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const check = await getCheck(id);

  if (!check) {
    return Response.json({ error: "Report not found" }, { status: 404 });
  }

  if (check.status === "running") {
    return Response.json(
      { error: "Report is still being generated" },
      { status: 409 },
    );
  }

  let resolvedCheck = check;

  if (check.status === "failed") {
    try {
      const repairedCheck = await executeCheckRun({
        id: check.id,
        submission: toSubmission(check),
        agentRun: check.agentRun,
      });

      resolvedCheck = repairedCheck;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "This run failed before a final report could be generated.";

      return Response.json({ error: message }, { status: 409 });
    }
  }

  const refreshedCheck = {
    ...resolvedCheck,
    reportSections: generateDraftReportSections(resolvedCheck),
  };

  const reportPath = await generateDraftReportDocument(refreshedCheck);
  await updateCheckReportArtifacts({
    id: resolvedCheck.id,
    reportPath,
    reportSections: refreshedCheck.reportSections,
  });

  const absolutePath = path.join(getStorageRoot(), reportPath);
  const buffer = await readFile(absolutePath);
  const isPdf = reportPath.endsWith(".pdf");

  return new Response(buffer, {
    headers: {
      "content-type": isPdf
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${id}${isPdf ? ".pdf" : ".docx"}"`,
    },
  });
}
