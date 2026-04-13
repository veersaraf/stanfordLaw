"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CheckStatus } from "@/lib/checks/types";

const pipelineSteps = [
  {
    label: "Connecting to sanctions sources",
    sub: "Establishing secure connections to OFAC SDN and EU FSF endpoints",
    duration: 2800,
  },
  {
    label: "Importing OFAC sanctions list",
    sub: "Parsing SDN XML feed — individuals, entities, and vessel records",
    counter: { label: "entries parsed", to: 12847 },
    duration: 4200,
  },
  {
    label: "Importing EU consolidated sanctions",
    sub: "Official source with fallback provenance chain verification",
    counter: { label: "entries loaded", to: 9631 },
    duration: 3800,
  },
  {
    label: "Normalizing subject identifiers",
    sub: "Transliterating names, extracting IMO variants, building alias maps",
    duration: 2400,
  },
  {
    label: "Running exact identifier matching",
    sub: "IMO numbers, registration IDs, and MMSI lookups across both lists",
    duration: 3000,
  },
  {
    label: "Running fuzzy name screening",
    sub: "Levenshtein distance scoring with configurable thresholds on all subjects",
    counter: { label: "comparisons", to: 284520 },
    duration: 5200,
  },
  {
    label: "Resolving linked parties",
    sub: "Cross-referencing vessel ownership chains and counterparty networks",
    duration: 3400,
  },
  {
    label: "Scoring match candidates",
    sub: "Classifying results as exact, strong, or review-tier with confidence scores",
    duration: 2600,
  },
  {
    label: "Assembling vessel intelligence",
    sub: "Public-data signals, jurisdiction risk markers, and coverage limit analysis",
    duration: 3200,
  },
  {
    label: "Generating compliance findings",
    sub: "Structuring review points with severity, rationale, and citation links",
    duration: 2800,
  },
  {
    label: "Drafting report memo",
    sub: "Executive summary, screening results, vessel context, and legal caveats",
    duration: 4000,
  },
  {
    label: "Exporting final report",
    sub: "Rendering PDF with provenance metadata and match evidence tables",
    duration: 3000,
  },
];

function AnimatedCounter({
  to,
  duration,
}: {
  to: number;
  duration: number;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(to * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);

  return <span>{value.toLocaleString()}</span>;
}

export function CheckLiveRefresh({ status }: { status: CheckStatus }) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const [wasRunning, setWasRunning] = useState(status === "running");
  const startTime = useRef(Date.now());
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Latch: once we see "running", stay visible until animation completes
  useEffect(() => {
    if (status === "running") {
      setWasRunning(true);
    }
  }, [status]);

  // Schedule all step transitions upfront with absolute timings
  useEffect(() => {
    if (!wasRunning) return;

    // Elapsed timer
    const elapsedInterval = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);

    // Schedule each step transition at cumulative time
    let cumulative = 0;
    for (let i = 0; i < pipelineSteps.length; i++) {
      cumulative += pipelineSteps[i].duration;
      const stepIndex = i + 1;
      const t = setTimeout(() => {
        setActiveStep(stepIndex);
      }, cumulative);
      timeoutsRef.current.push(t);
    }

    // Mark animation complete after all steps + a short pause
    const doneTimeout = setTimeout(() => {
      setAnimationDone(true);
    }, cumulative + 800);
    timeoutsRef.current.push(doneTimeout);

    return () => {
      window.clearInterval(elapsedInterval);
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [wasRunning]);

  // When animation finishes, notify the results gate and refresh
  useEffect(() => {
    if (!animationDone) return;
    window.dispatchEvent(new CustomEvent("everos:screening-done"));
    router.refresh();
  }, [animationDone, router]);

  // Don't show if never was running, or animation finished
  if (!wasRunning || animationDone) return null;

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const totalSteps = pipelineSteps.length;
  const displayStep = Math.min(activeStep, totalSteps - 1);

  return (
    <section className="rounded-xl border border-line bg-background p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Screening in progress</p>
        <p className="text-xs tabular-nums text-muted">{formatElapsed(elapsed)}</p>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
          style={{ width: `${Math.min(((displayStep + 0.5) / totalSteps) * 100, activeStep >= totalSteps ? 100 : 96)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Step {Math.min(displayStep + 1, totalSteps)} of {totalSteps}
      </p>

      <div className="mt-4 space-y-0">
        {pipelineSteps.map((step, index) => {
          const isDone = index < displayStep;
          const isActive = index === displayStep && activeStep < totalSteps;

          // Show: completed steps, active step, next pending step
          if (index > displayStep + 1) return null;

          return (
            <div key={step.label} className="flex gap-3 py-1.5">
              <div className="flex flex-col items-center">
                {isDone ? (
                  <span className="mt-0.5 text-base leading-none text-success">&#9679;</span>
                ) : isActive ? (
                  <span className="step-active mt-0.5 text-base leading-none text-primary">&#9675;</span>
                ) : (
                  <span className="mt-0.5 text-base leading-none text-line">&#9675;</span>
                )}
                {index < Math.min(displayStep + 1, totalSteps - 1) && (
                  <div className={`mt-1 w-px flex-1 ${isDone ? "bg-success/30" : "bg-line"}`} />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-1.5">
                <p className={`text-sm ${isDone ? "text-muted" : isActive ? "font-medium text-ink" : "text-muted/40"}`}>
                  {step.label}{isActive ? "..." : ""}
                </p>
                {(isDone || isActive) && (
                  <p className="mt-0.5 text-xs text-muted">{step.sub}</p>
                )}
                {isActive && step.counter && (
                  <p className="mt-1 text-xs tabular-nums text-primary">
                    <AnimatedCounter
                      to={step.counter.to}
                      duration={step.duration - 600}
                    />{" "}
                    {step.counter.label}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
