"use client";

import { useActionState, useState } from "react";
import { FileText, Radar, ShipWheel } from "lucide-react";
import { submitCheck } from "@/app/checks/new/actions";
import { initialIntakeActionState } from "@/lib/checks/schema";
import type { CheckMode } from "@/lib/checks/types";
import { cn } from "@/lib/utils";
import { SubmitButton } from "@/components/submit-button";

const modes: Array<{
  id: CheckMode;
  title: string;
  description: string;
  icon: typeof ShipWheel;
}> = [
  {
    id: "vessel",
    title: "Vessel + Transaction",
    description: "Manual BIMCO-style intake for a vessel deal and counterparties.",
    icon: ShipWheel,
  },
  {
    id: "entity",
    title: "Entity / Individual",
    description: "Counterparty screening for a company, director, or person.",
    icon: Radar,
  },
  {
    id: "pdf",
    title: "PDF Upload",
    description: "Upload a transaction document and let the system normalize it first.",
    icon: FileText,
  },
];

function FieldError({
  errors,
  name,
}: {
  errors: Record<string, string[]> | undefined;
  name: string;
}) {
  const fieldErrors = errors?.[name];

  if (!fieldErrors || fieldErrors.length === 0) {
    return null;
  }

  return <p className="mt-2 text-sm text-danger">{fieldErrors[0]}</p>;
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-semibold tracking-[0.02em] text-navy"
    >
      {children}
    </label>
  );
}

export function CheckIntakeForm() {
  const [state, formAction] = useActionState(submitCheck, initialIntakeActionState);
  const [mode, setMode] = useState<CheckMode>(state.mode);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="mode" value={mode} />

      <div className="grid gap-3 lg:grid-cols-3">
        {modes.map(({ id, title, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              "rounded-[1.6rem] border p-5 text-left transition",
              mode === id
                ? "border-navy bg-navy text-white shadow-[0_20px_40px_rgba(22,61,83,0.16)]"
                : "border-line bg-white/70 text-navy hover:border-navy/20 hover:bg-white",
            )}
          >
            <Icon className="h-5 w-5" />
            <h3 className="mt-4 font-serif text-2xl leading-tight">{title}</h3>
            <p
              className={cn(
                "mt-2 text-sm leading-6",
                mode === id ? "text-white/75" : "text-muted",
              )}
            >
              {description}
            </p>
          </button>
        ))}
      </div>

      <div className="rounded-[1.8rem] border border-line bg-white/75 p-6">
        <Label htmlFor="title">Internal matter title</Label>
        <input
          id="title"
          name="title"
          className="field"
          placeholder="Example: M/T Baltic Dawn acquisition review"
        />
        <p className="mt-2 text-sm text-muted">
          Optional, but useful if you want a more readable check title in history.
        </p>
      </div>

      {state.message ? (
        <div className="rounded-[1.6rem] border border-danger/20 bg-danger/8 px-5 py-4 text-sm text-danger">
          {state.message}
        </div>
      ) : null}

      {mode === "vessel" ? (
        <section className="grid gap-5 rounded-[2rem] border border-line bg-white/75 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="eyebrow text-xs font-semibold text-muted">Vessel Intake</p>
            <h2 className="mt-2 font-serif text-3xl text-navy">
              Capture the transaction and counterparties
            </h2>
          </div>

          <div>
            <Label htmlFor="vesselName">Vessel name (optional if IMO provided)</Label>
            <input
              id="vesselName"
              name="vesselName"
              className="field"
              placeholder="Luminosa"
            />
            <FieldError errors={state.fieldErrors} name="vesselName" />
          </div>

          <div>
            <Label htmlFor="imoNumber">IMO number (optional if vessel name provided)</Label>
            <input id="imoNumber" name="imoNumber" className="field" placeholder="1234567" />
            <FieldError errors={state.fieldErrors} name="imoNumber" />
          </div>

          <div>
            <Label htmlFor="sellerName">Seller (optional)</Label>
            <input id="sellerName" name="sellerName" className="field" />
            <FieldError errors={state.fieldErrors} name="sellerName" />
          </div>

          <div>
            <Label htmlFor="buyerName">Buyer (optional)</Label>
            <input id="buyerName" name="buyerName" className="field" />
            <FieldError errors={state.fieldErrors} name="buyerName" />
          </div>

          <div>
            <Label htmlFor="ownerName">Registered / beneficial owner</Label>
            <input id="ownerName" name="ownerName" className="field" />
          </div>

          <div>
            <Label htmlFor="operatorName">Operator</Label>
            <input id="operatorName" name="operatorName" className="field" />
          </div>

          <div>
            <Label htmlFor="managerName">Manager</Label>
            <input id="managerName" name="managerName" className="field" />
          </div>

          <div>
            <Label htmlFor="flag">Flag</Label>
            <input id="flag" name="flag" className="field" placeholder="Marshall Islands" />
          </div>

          <div>
            <Label htmlFor="registry">Registry</Label>
            <input id="registry" name="registry" className="field" />
          </div>

          <div>
            <Label htmlFor="guarantor">Seller guarantor</Label>
            <input id="guarantor" name="guarantor" className="field" />
          </div>

          <div>
            <Label htmlFor="depositHolder">Deposit holder</Label>
            <input id="depositHolder" name="depositHolder" className="field" />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="deliveryPlace">Delivery place and range</Label>
            <input id="deliveryPlace" name="deliveryPlace" className="field" />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={5}
              className="field resize-none"
              placeholder="Any special context, financing notes, or red-flag facts already known."
            />
          </div>
        </section>
      ) : null}

      {mode === "entity" ? (
        <section className="grid gap-5 rounded-[2rem] border border-line bg-white/75 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="eyebrow text-xs font-semibold text-muted">Entity Intake</p>
            <h2 className="mt-2 font-serif text-3xl text-navy">
              Screen a company or individual
            </h2>
          </div>

          <div>
            <Label htmlFor="subjectName">Name</Label>
            <input id="subjectName" name="subjectName" className="field" />
            <FieldError errors={state.fieldErrors} name="subjectName" />
          </div>

          <div>
            <Label htmlFor="subjectType">Subject type</Label>
            <select id="subjectType" name="subjectType" className="field" defaultValue="company">
              <option value="company">Company</option>
              <option value="individual">Individual</option>
            </select>
          </div>

          <div>
            <Label htmlFor="companyNumber">Company registration number</Label>
            <input id="companyNumber" name="companyNumber" className="field" />
          </div>

          <div>
            <Label htmlFor="nationality">Country / nationality</Label>
            <input id="nationality" name="nationality" className="field" />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <input id="address" name="address" className="field" />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="aliases">Known aliases</Label>
            <input
              id="aliases"
              name="aliases"
              className="field"
              placeholder="Comma-separated aliases"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={5}
              className="field resize-none"
              placeholder="Anything already known about ownership, sector, or possible connections."
            />
          </div>
        </section>
      ) : null}

      {mode === "pdf" ? (
        <section className="grid gap-5 rounded-[2rem] border border-line bg-white/75 p-6">
          <div>
            <p className="eyebrow text-xs font-semibold text-muted">PDF Intake</p>
            <h2 className="mt-2 font-serif text-3xl text-navy">
              Upload a transaction document first
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
              The app stores the PDF, extracts text, resolves obvious fields like vessel name and IMO where possible, and feeds the normalized payload into the sanctions and vessel lanes.
            </p>
          </div>

          <div>
            <Label htmlFor="pdfFile">PDF file</Label>
            <input
              id="pdfFile"
              name="pdfFile"
              type="file"
              accept=".pdf,application/pdf"
              className="field file:mr-4 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <FieldError errors={state.fieldErrors} name="pdfFile" />
          </div>

          <div>
            <Label htmlFor="pdfNote">Reviewer note</Label>
            <textarea
              id="pdfNote"
              name="pdfNote"
              rows={4}
              className="field resize-none"
              placeholder="What matters most in this upload, or what we should pay attention to first."
            />
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.8rem] border border-line bg-white/75 px-6 py-5">
        <p className="max-w-2xl text-sm leading-6 text-muted">
          This run imports current sanctions data as needed, stores structured results in Postgres, and creates a presentation-ready PDF automatically. Managed-agent session creation is optional when the Anthropic credentials are present.
        </p>
        <SubmitButton label="Create check" />
      </div>
    </form>
  );
}
