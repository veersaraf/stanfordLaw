"use client";

import { useState, useEffect } from "react";
import type { CheckStatus } from "@/lib/checks/types";

/**
 * Hides children while the screening animation is playing.
 * Once the animation finishes (all steps complete), fades results in.
 * If the check was never "running" (e.g. visiting a completed check), shows immediately.
 */
export function CheckResultsGate({
  status,
  children,
}: {
  status: CheckStatus;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(status !== "running");

  useEffect(() => {
    if (status !== "running" && !visible) {
      // The animation component handles its own timing.
      // Listen for custom event dispatched when animation completes.
      const handler = () => setVisible(true);
      window.addEventListener("everos:screening-done", handler);

      // Fallback: if no event fires within 50s, show results anyway
      const fallback = setTimeout(() => setVisible(true), 50000);

      return () => {
        window.removeEventListener("everos:screening-done", handler);
        clearTimeout(fallback);
      };
    }
  }, [status, visible]);

  if (!visible) return null;

  return (
    <div className="animate-fade-in flex flex-col gap-4">
      {children}
    </div>
  );
}
