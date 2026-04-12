"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CheckStatus } from "@/lib/checks/types";

const loadingMessages = [
  "Refreshing sanctions datasets and provenance...",
  "Screening vessel identifiers and counterparties...",
  "Resolving linked parties from matched vessel records...",
  "Generating findings and assembling the draft report...",
];

export function CheckLiveRefresh({ status }: { status: CheckStatus }) {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (status !== "running") {
      return;
    }

    const refreshInterval = window.setInterval(() => {
      router.refresh();
    }, 1200);
    const messageInterval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % loadingMessages.length);
    }, 1400);

    return () => {
      window.clearInterval(refreshInterval);
      window.clearInterval(messageInterval);
    };
  }, [router, status]);

  const message = useMemo(
    () => loadingMessages[messageIndex] ?? loadingMessages[0],
    [messageIndex],
  );

  if (status !== "running") {
    return null;
  }

  return (
    <section className="panel rounded-[2rem] border border-navy/10 bg-white/90 p-6 xl:col-span-2">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy/8 text-navy">
          <LoaderCircle className="h-5 w-5 animate-spin" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
            Check In Progress
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-navy">
            Building the screening record now
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
        </div>
      </div>
    </section>
  );
}
