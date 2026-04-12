import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ZodError } from "zod";
import { entityFormSchema, type IntakeActionState, vesselFormSchema } from "@/lib/checks/schema";
import type {
  CheckSubmission,
  EntityCheckInput,
  PdfParsedFields,
  VesselCheckInput,
} from "@/lib/checks/types";
import { writeBuffer } from "@/lib/storage/fs-store";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function zodErrors(error: ZodError) {
  return error.flatten().fieldErrors;
}

function cleanOptional(value: string | undefined) {
  return value && value.length > 0 ? value : undefined;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

function collectSubjects(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value && value.length > 0));
}

function extractLabel(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function parsePdfFields(extractedText: string): PdfParsedFields {
  return {
    vesselName: extractLabel(extractedText, [
      /vessel(?: name)?\s*[:\-]\s*([^\n]+)/i,
      /name of vessel\s*[:\-]\s*([^\n]+)/i,
    ]),
    imoNumber: extractLabel(extractedText, [/imo(?: number)?\s*[:#\-]?\s*(\d{7})/i]),
    ownerName: extractLabel(extractedText, [
      /(?:registered |beneficial )?owner(?: name)?\s*[:\-]\s*([^\n]+)/i,
    ]),
    operatorName: extractLabel(extractedText, [
      /operator(?: name)?\s*[:\-]\s*([^\n]+)/i,
      /commercial operator\s*[:\-]\s*([^\n]+)/i,
    ]),
    managerName: extractLabel(extractedText, [
      /manager(?: name)?\s*[:\-]\s*([^\n]+)/i,
      /technical manager\s*[:\-]\s*([^\n]+)/i,
    ]),
    sellerName: extractLabel(extractedText, [/seller(?:'s)? name\s*[:\-]\s*([^\n]+)/i]),
    buyerName: extractLabel(extractedText, [/buyer(?:'s)? name\s*[:\-]\s*([^\n]+)/i]),
  };
}

async function extractPdfText(buffer: Buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    return parsed.text.replace(/\0/g, "").trim().slice(0, 20000);
  } catch {
    return "";
  }
}

export async function buildSubmissionFromFormData(
  formData: FormData,
): Promise<{ success: true; submission: CheckSubmission } | { success: false; state: IntakeActionState }> {
  const mode = (asString(formData.get("mode")) || "vessel") as IntakeActionState["mode"];

  if (mode === "entity") {
    const validated = entityFormSchema.safeParse({
      title: asString(formData.get("title")),
      subjectName: asString(formData.get("subjectName")),
      subjectType: asString(formData.get("subjectType")) || "company",
      address: asString(formData.get("address")),
      companyNumber: asString(formData.get("companyNumber")),
      nationality: asString(formData.get("nationality")),
      aliases: asString(formData.get("aliases")),
      notes: asString(formData.get("notes")),
    });

    if (!validated.success) {
      return {
        success: false,
        state: {
          mode,
          message: "Please complete the entity intake fields before continuing.",
          fieldErrors: zodErrors(validated.error),
        },
      };
    }

    const entity: EntityCheckInput = {
      subjectName: validated.data.subjectName,
      subjectType: validated.data.subjectType,
      address: cleanOptional(validated.data.address),
      companyNumber: cleanOptional(validated.data.companyNumber),
      nationality: cleanOptional(validated.data.nationality),
      aliases: cleanOptional(validated.data.aliases)
        ?.split(",")
        .map((alias) => alias.trim())
        .filter(Boolean),
      notes: cleanOptional(validated.data.notes),
    };

    return {
      success: true,
      submission: {
        mode,
        title:
          cleanOptional(validated.data.title) ??
          `${entity.subjectName} entity screening`,
        subjects: collectSubjects([
          entity.subjectName,
          entity.companyNumber,
          entity.address,
        ]),
        entity,
      },
    };
  }

  if (mode === "pdf") {
    const title = asString(formData.get("title"));
    const note = asString(formData.get("pdfNote"));
    const fileValue = formData.get("pdfFile");

    if (!(fileValue instanceof File) || fileValue.size === 0) {
      return {
        success: false,
        state: {
          mode,
          message: "Please attach a PDF before submitting the check.",
          fieldErrors: {
            pdfFile: ["A PDF upload is required."],
          },
        },
      };
    }

    if (!fileValue.name.toLowerCase().endsWith(".pdf")) {
      return {
        success: false,
        state: {
          mode,
          message: "Only PDF files are accepted for document-led intake.",
          fieldErrors: {
            pdfFile: ["Upload a `.pdf` file."],
          },
        },
      };
    }

    if (fileValue.size > MAX_UPLOAD_BYTES) {
      return {
        success: false,
        state: {
          mode,
          message: "The PDF is larger than the current 10MB intake limit.",
          fieldErrors: {
            pdfFile: ["Use a PDF under 10MB for the prototype build."],
          },
        },
      };
    }

    const bytes = Buffer.from(await fileValue.arrayBuffer());
    const safeName = sanitizeFileName(fileValue.name);
    const relativePath = path.join("uploads", `${randomUUID()}-${safeName}`);
    await writeBuffer(relativePath, bytes);
    const extractedText = await extractPdfText(bytes);
    const parsedFields = parsePdfFields(extractedText);
    const subjects = collectSubjects([
      parsedFields.vesselName,
      parsedFields.imoNumber,
      parsedFields.ownerName,
      parsedFields.operatorName,
      parsedFields.managerName,
      parsedFields.sellerName,
      parsedFields.buyerName,
      fileValue.name,
    ]);

    return {
      success: true,
      submission: {
        mode,
        title: title || `${fileValue.name} document intake`,
        subjects,
        pdf: {
          fileName: fileValue.name,
          storedPath: relativePath,
          sizeBytes: fileValue.size,
          extractedText,
          note: cleanOptional(note),
          parsedFields,
        },
      },
    };
  }

  const validated = vesselFormSchema.safeParse({
    title: asString(formData.get("title")),
    vesselName: asString(formData.get("vesselName")),
    imoNumber: asString(formData.get("imoNumber")),
    flag: asString(formData.get("flag")),
    registry: asString(formData.get("registry")),
    ownerName: asString(formData.get("ownerName")),
    operatorName: asString(formData.get("operatorName")),
    managerName: asString(formData.get("managerName")),
    sellerName: asString(formData.get("sellerName")),
    buyerName: asString(formData.get("buyerName")),
    guarantor: asString(formData.get("guarantor")),
    depositHolder: asString(formData.get("depositHolder")),
    deliveryPlace: asString(formData.get("deliveryPlace")),
    notes: asString(formData.get("notes")),
  });

  if (!validated.success) {
    return {
      success: false,
      state: {
        mode: "vessel",
        message: "Please fill in the core vessel transaction details.",
        fieldErrors: zodErrors(validated.error),
      },
    };
  }

  const vessel: VesselCheckInput = {
    vesselName: cleanOptional(validated.data.vesselName),
    imoNumber: cleanOptional(validated.data.imoNumber),
    flag: cleanOptional(validated.data.flag),
    registry: cleanOptional(validated.data.registry),
    ownerName: cleanOptional(validated.data.ownerName),
    operatorName: cleanOptional(validated.data.operatorName),
    managerName: cleanOptional(validated.data.managerName),
    sellerName: cleanOptional(validated.data.sellerName),
    buyerName: cleanOptional(validated.data.buyerName),
    guarantor: cleanOptional(validated.data.guarantor),
    depositHolder: cleanOptional(validated.data.depositHolder),
    deliveryPlace: cleanOptional(validated.data.deliveryPlace),
    notes: cleanOptional(validated.data.notes),
  };

  return {
    success: true,
    submission: {
      mode: "vessel",
      title:
        cleanOptional(validated.data.title) ??
        (vessel.vesselName
          ? `${vessel.vesselName} transaction screening`
          : `IMO ${vessel.imoNumber} transaction screening`),
      subjects: collectSubjects([
        vessel.vesselName,
        vessel.imoNumber,
        vessel.ownerName,
        vessel.operatorName,
        vessel.managerName,
        vessel.sellerName,
        vessel.buyerName,
        vessel.guarantor,
        vessel.depositHolder,
      ]),
      vessel,
    },
  };
}
