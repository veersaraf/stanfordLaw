import { cn } from "@/lib/utils";
import { formatSeverityLabel, formatStepStatus } from "@/lib/format";
import type { CheckSeverity, PipelineStepStatus } from "@/lib/checks/types";

type StatusPillProps =
  | { kind: "severity"; value: CheckSeverity }
  | { kind: "step"; value: PipelineStepStatus };

const severityStyles = {
  clear: "bg-success/10 text-success",
  watch: "bg-warning/10 text-warning",
  high: "bg-danger/10 text-danger",
} satisfies Record<CheckSeverity, string>;

const stepStyles = {
  complete: "bg-success/10 text-success",
  attention: "bg-warning/10 text-warning",
  pending: "bg-surface text-muted",
  not_applicable: "bg-surface text-muted",
} satisfies Record<PipelineStepStatus, string>;

export function StatusPill(props: StatusPillProps) {
  const label =
    props.kind === "severity"
      ? formatSeverityLabel(props.value)
      : formatStepStatus(props.value);

  const tone =
    props.kind === "severity"
      ? severityStyles[props.value]
      : stepStyles[props.value];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        tone,
      )}
    >
      {label}
    </span>
  );
}
