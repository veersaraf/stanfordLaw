import { cn } from "@/lib/utils";
import { formatSeverityLabel, formatStepStatus } from "@/lib/format";
import type { CheckSeverity, PipelineStepStatus } from "@/lib/checks/types";

type StatusPillProps =
  | {
      kind: "severity";
      value: CheckSeverity;
    }
  | {
      kind: "step";
      value: PipelineStepStatus;
    };

const severityStyles = {
  clear: "bg-success/10 text-success border-success/15",
  watch: "bg-warning/10 text-warning border-warning/15",
  high: "bg-danger/10 text-danger border-danger/15",
} satisfies Record<CheckSeverity, string>;

const stepStyles = {
  complete: "bg-success/10 text-success border-success/15",
  attention: "bg-warning/10 text-warning border-warning/15",
  pending: "bg-navy/8 text-navy/70 border-navy/10",
  not_applicable: "bg-muted/10 text-muted border-muted/10",
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
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]",
        tone,
      )}
    >
      {label}
    </span>
  );
}
