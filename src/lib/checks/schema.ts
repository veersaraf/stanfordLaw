import { z } from "zod";
import type { CheckMode } from "@/lib/checks/types";

const optionalString = z.string().trim().optional().or(z.literal(""));

export const IMO_NUMBER_ERROR = "IMO number should be a 7-digit value.";

export function isValidImoNumber(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || /^\d{7}$/.test(trimmed);
}

export const vesselFormSchema = z.object({
  title: optionalString,
  vesselName: optionalString,
  imoNumber: optionalString.refine((value) => isValidImoNumber(value ?? ""), IMO_NUMBER_ERROR),
  flag: optionalString,
  registry: optionalString,
  ownerName: optionalString,
  operatorName: optionalString,
  managerName: optionalString,
  sellerName: optionalString,
  buyerName: optionalString,
  guarantor: optionalString,
  depositHolder: optionalString,
  deliveryPlace: optionalString,
  notes: optionalString,
}).superRefine((data, context) => {
  if (!data.vesselName && !data.imoNumber) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["vesselName"],
      message: "Enter a vessel name or an IMO number.",
    });
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["imoNumber"],
      message: "Enter an IMO number or a vessel name.",
    });
  }
});

export const entityFormSchema = z.object({
  title: optionalString,
  subjectName: z.string().trim().min(1, "Subject name is required."),
  subjectType: z.enum(["company", "individual"]),
  address: optionalString,
  companyNumber: optionalString,
  nationality: optionalString,
  aliases: optionalString,
  notes: optionalString,
});

export type IntakeActionState = {
  mode: CheckMode;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialIntakeActionState: IntakeActionState = {
  mode: "vessel",
  fieldErrors: {},
};
