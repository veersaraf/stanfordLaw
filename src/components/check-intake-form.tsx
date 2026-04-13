"use client";

import { useActionState, useState } from "react";
import { FileText, Radar, ShipWheel } from "lucide-react";
import { submitCheck } from "@/app/checks/new/actions";
import {
  IMO_NUMBER_ERROR,
  initialIntakeActionState,
  isValidImoNumber,
} from "@/lib/checks/schema";
import type { CheckMode } from "@/lib/checks/types";
import { cn } from "@/lib/utils";
import { CountryCombobox } from "@/components/country-combobox";
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
    description: "BIMCO-style intake with counterparties",
    icon: ShipWheel,
  },
  {
    id: "entity",
    title: "Entity / Individual",
    description: "Screen a company, director, or person",
    icon: Radar,
  },
  {
    id: "pdf",
    title: "PDF Upload",
    description: "Upload and extract from a document",
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
  if (!fieldErrors || fieldErrors.length === 0) return null;
  return <p className="mt-1.5 text-sm text-danger">{fieldErrors[0]}</p>;
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
      className="mb-1.5 block text-sm font-medium text-ink"
    >
      {children}
    </label>
  );
}

export function CheckIntakeForm() {
  const [state, formAction] = useActionState(submitCheck, initialIntakeActionState);
  const [mode, setMode] = useState<CheckMode>(state.mode);
  const [imoError, setImoError] = useState<string | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="mode" value={mode} />

      {/* Mode selector */}
      <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
        {modes.map(({ id, title, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              "p-4 text-left transition",
              mode === id
                ? "bg-primary text-white"
                : "bg-background text-ink hover:bg-surface",
            )}
          >
            <Icon className={cn("h-4 w-4", mode === id ? "text-white/70" : "text-muted")} />
            <h3 className="mt-2.5 text-sm font-semibold">{title}</h3>
            <p className={cn("mt-1 text-xs leading-5", mode === id ? "text-white/60" : "text-muted")}>
              {description}
            </p>
          </button>
        ))}
      </div>

      {/* Title field */}
      <div className="rounded-xl border border-line bg-background p-4">
        <Label htmlFor="title">Matter title</Label>
        <input
          id="title"
          name="title"
          className="field"
          placeholder="e.g. M/T Baltic Dawn acquisition review"
        />
        <p className="mt-1.5 text-xs text-muted">Optional. Auto-generated if left blank.</p>
      </div>

      {state.message ? (
        <div className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.message}
        </div>
      ) : null}

      {/* Vessel mode fields */}
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
            <input
              id="imoNumber"
              name="imoNumber"
              className="field"
              placeholder="1234567"
              inputMode="numeric"
              aria-invalid={imoError ? true : undefined}
              aria-describedby={imoError ? "imoNumber-error" : undefined}
              onBlur={(event) => {
                setImoError(isValidImoNumber(event.target.value) ? null : IMO_NUMBER_ERROR);
              }}
              onChange={(event) => {
                if (imoError && isValidImoNumber(event.target.value)) {
                  setImoError(null);
                }
              }}
            />
            {imoError ? (
              <p id="imoNumber-error" className="mt-2 text-sm text-danger">
                {imoError}
              </p>
            ) : (
              <FieldError errors={state.fieldErrors} name="imoNumber" />
            )}
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
            <CountryCombobox id="flag" name="flag" placeholder="Marshall Islands" />
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

      {/* Entity mode fields */}
      {mode === "entity" ? (
        <section className="rounded-xl border border-line bg-background p-4">
          <p className="mb-4 text-sm font-semibold text-ink">Entity details</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="subjectName">Name</Label>
              <input id="subjectName" name="subjectName" className="field" />
              <FieldError errors={state.fieldErrors} name="subjectName" />
            </div>
            <div>
              <Label htmlFor="subjectType">Type</Label>
              <select id="subjectType" name="subjectType" className="field" defaultValue="company">
                <option value="company">Company</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            <div>
              <Label htmlFor="companyNumber">Registration number</Label>
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
              <input id="aliases" name="aliases" className="field" placeholder="Comma-separated" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="field resize-none"
                placeholder="Ownership, sector, or known connections."
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* PDF mode fields */}
      {mode === "pdf" ? (
        <section className="rounded-xl border border-line bg-background p-4">
          <p className="mb-1 text-sm font-semibold text-ink">Upload document</p>
          <p className="mb-4 text-xs leading-5 text-muted">
            PDF is stored, text extracted, and fields normalized into the screening pipeline.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pdfFile">PDF file</Label>
              <input
                id="pdfFile"
                name="pdfFile"
                type="file"
                accept=".pdf,application/pdf"
                className="field text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
              />
              <FieldError errors={state.fieldErrors} name="pdfFile" />
            </div>
            <div>
              <Label htmlFor="pdfNote">Reviewer note</Label>
              <textarea
                id="pdfNote"
                name="pdfNote"
                rows={3}
                className="field resize-none"
                placeholder="What to pay attention to in this document."
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* Submit */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-background px-4 py-3">
        <p className="text-xs leading-5 text-muted">
          Imports live sanctions data, screens all subjects, and generates a PDF report.
        </p>
        <SubmitButton label="Run check" />
      </div>
    </form>
  );
}
