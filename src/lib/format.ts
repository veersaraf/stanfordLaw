import type { CheckMode, CheckSeverity, PipelineStepStatus } from "@/lib/checks/types";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatMode(mode: CheckMode) {
  return (
    {
      vessel: "Vessel Transaction",
      entity: "Entity / Individual",
      pdf: "PDF Intake",
    } satisfies Record<CheckMode, string>
  )[mode];
}

export function formatSeverityLabel(severity: CheckSeverity) {
  return (
    {
      clear: "Clear",
      watch: "Watch",
      high: "High Risk",
    } satisfies Record<CheckSeverity, string>
  )[severity];
}

export function formatStepStatus(status: PipelineStepStatus) {
  return (
    {
      complete: "Complete",
      attention: "Attention",
      pending: "Pending",
      not_applicable: "N/A",
    } satisfies Record<PipelineStepStatus, string>
  )[status];
}
