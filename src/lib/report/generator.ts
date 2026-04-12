import { access } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import type {
  CheckRecord,
  ReportSection,
  VesselIntelSyntheticScenario,
} from "@/lib/checks/types";
import { dedupeStrings } from "@/lib/sanctions/normalize";
import { buildScreeningSubjects } from "@/lib/sanctions/matcher";
import { writeBuffer } from "@/lib/storage/fs-store";

const palette = {
  navy: "#12263A",
  navySoft: "#1C3C58",
  gold: "#C9A34E",
  ivory: "#F7F1E7",
  ice: "#E6F2F8",
  iceDeep: "#9FC7D8",
  mist: "#ECF3F7",
  line: "#D9E2E8",
  ink: "#203544",
  muted: "#667B8B",
  success: "#2F7D5C",
  warning: "#B9771F",
  danger: "#A13D3D",
  white: "#FFFFFF",
};

const reportFontNames = {
  sans: "ReportSans",
  sansBold: "ReportSansBold",
  serif: "ReportSerif",
} as const;

const reportFontCandidates = {
  sans: [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
  ],
  sansBold: [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
  ],
  serif: [
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
  ],
} as const;

type TableColumn<T> = {
  key: keyof T;
  header: string;
  width: number;
  align?: "left" | "center" | "right";
};

type SyntheticScenarioDatum = VesselIntelSyntheticScenario["timeline"][number] & {
  timestampMs: number;
  speedValue: number;
  courseDegrees?: number;
  latitude: number;
  longitude: number;
};

function sentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function resolveReportFont(
  candidates: readonly string[],
  label: string,
) {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(`No usable ${label} font file was found for PDF generation.`);
}

async function registerReportFonts(doc: PDFKit.PDFDocument) {
  const [sansPath, sansBoldPath, serifPath] = await Promise.all([
    resolveReportFont(reportFontCandidates.sans, "sans"),
    resolveReportFont(reportFontCandidates.sansBold, "sans-bold"),
    resolveReportFont(reportFontCandidates.serif, "serif"),
  ]);

  doc.registerFont(reportFontNames.sans, sansPath);
  doc.registerFont(reportFontNames.sansBold, sansBoldPath);
  doc.registerFont(reportFontNames.serif, serifPath);
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatTimestamp(value: string | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: CheckRecord["resultSummary"]["overallStatus"]) {
  return (
    {
      match: "Sanctions Hit",
      review: "Review Required",
      clear: "No Current Match",
    } as const
  )[status];
}

function statusColor(status: CheckRecord["resultSummary"]["overallStatus"]) {
  return (
    {
      match: palette.danger,
      review: palette.warning,
      clear: palette.success,
    } as const
  )[status];
}

function createPdfBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function lineBreak(doc: PDFKit.PDFDocument, amount = 18) {
  doc.moveDown(amount / 18);
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  const maxY = doc.page.height - doc.page.margins.bottom - 24;

  if (doc.y + height > maxY) {
    doc.addPage();
  }
}

function writeParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  options?: PDFKit.Mixins.TextOptions & { color?: string; size?: number; font?: string },
) {
  const width =
    options?.width ??
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const fontSize = options?.size ?? 11;
  const height = doc.heightOfString(text, {
    width,
    align: options?.align,
  });

  ensureSpace(doc, height + 12);
  doc
    .font(options?.font ?? "ReportSans")
    .fontSize(fontSize)
    .fillColor(options?.color ?? palette.ink)
    .text(text, {
      width,
      align: options?.align ?? "left",
      lineGap: options?.lineGap ?? 3,
    });
}

function drawSectionHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle?: string,
) {
  ensureSpace(doc, 72);
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .save()
    .rect(doc.page.margins.left, doc.y, 44, 4)
    .fill(palette.gold)
    .restore();

  doc.y += 10;
  doc.font("ReportSansBold").fontSize(20).fillColor(palette.navy).text(title, {
    width,
  });

  if (subtitle) {
    doc.moveDown(0.25);
    doc.font("ReportSans").fontSize(10).fillColor(palette.muted).text(subtitle, {
      width,
      lineGap: 2,
    });
  }

  doc.moveDown(0.8);
}

function drawMetricCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  tone: string,
) {
  doc
    .save()
    .roundedRect(x, y, width, height, 18)
    .fillAndStroke(palette.white, palette.line)
    .restore();

  doc
    .save()
    .roundedRect(x + 14, y + 14, 48, 6, 3)
    .fill(tone)
    .restore();

  doc
    .font("ReportSansBold")
    .fontSize(10)
    .fillColor(palette.muted)
    .text(label, x + 14, y + 28, {
      width: width - 28,
      lineGap: 1,
    });

  doc
    .font("ReportSansBold")
    .fontSize(24)
    .fillColor(palette.navy)
    .text(value, x + 14, y + 48, {
      width: width - 28,
      lineGap: 1,
    });
}

function drawInsightCard(
  doc: PDFKit.PDFDocument,
  {
    x,
    y,
    width,
    height,
    label,
    value,
    detail,
    tone,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    value: string;
    detail: string;
    tone: string;
  },
) {
  doc
    .save()
    .roundedRect(x, y, width, height, 18)
    .fillAndStroke(palette.white, palette.line)
    .restore();

  doc
    .save()
    .roundedRect(x + 14, y + 14, 40, 6, 3)
    .fill(tone)
    .restore();

  doc
    .font("ReportSansBold")
    .fontSize(9)
    .fillColor(palette.muted)
    .text(label, x + 14, y + 29, {
      width: width - 28,
    });

  doc
    .font("ReportSansBold")
    .fontSize(22)
    .fillColor(palette.navy)
    .text(value, x + 14, y + 46, {
      width: width - 28,
    });

  doc
    .font("ReportSans")
    .fontSize(9.5)
    .fillColor(palette.muted)
    .text(detail, x + 14, y + 74, {
      width: width - 28,
      lineGap: 2,
    });
}

function parseScenarioTimestamp(value: string) {
  const normalized = value.replace(" UTC", ":00Z").replace(" ", "T");
  const timestamp = Date.parse(normalized);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function parseCourseDegrees(value: string) {
  const match = value.match(/(\d{1,3})/);

  return match ? Number(match[1]) : undefined;
}

function shortestCourseDelta(left?: number, right?: number) {
  if (left === undefined || right === undefined) {
    return undefined;
  }

  const delta = Math.abs(left - right) % 360;
  return delta > 180 ? 360 - delta : delta;
}

function formatDuration(milliseconds: number | undefined) {
  if (milliseconds === undefined || !Number.isFinite(milliseconds) || milliseconds <= 0) {
    return "N/A";
  }

  const totalMinutes = Math.round(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function haversineDistanceNm(
  latitudeOne: number,
  longitudeOne: number,
  latitudeTwo: number,
  longitudeTwo: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const radiusNm = 3440.065;
  const latitudeDelta = toRadians(latitudeTwo - latitudeOne);
  const longitudeDelta = toRadians(longitudeTwo - longitudeOne);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeOne)) *
      Math.cos(toRadians(latitudeTwo)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * radiusNm * Math.asin(Math.sqrt(a));
}

function getScenarioData(scenario: VesselIntelSyntheticScenario) {
  return scenario.timeline
    .filter(
      (event): event is typeof event & { latitude: number; longitude: number } =>
        typeof event.latitude === "number" && typeof event.longitude === "number",
    )
    .map((event) => ({
      ...event,
      timestampMs: parseScenarioTimestamp(event.timestamp),
      speedValue: Number.parseFloat(event.speedKnots),
      courseDegrees: parseCourseDegrees(event.course),
      latitude: event.latitude,
      longitude: event.longitude,
    }))
    .sort((left, right) => left.timestampMs - right.timestampMs);
}

function getPrimaryVesselName(scenario: VesselIntelSyntheticScenario) {
  return (
    scenario.counterparties.find((counterparty) =>
      counterparty.role.toLowerCase().includes("primary"),
    )?.vesselName ?? scenario.timeline[0]?.vesselName
  );
}

function drawPanelShell(
  doc: PDFKit.PDFDocument,
  {
    x,
    y,
    width,
    height,
    title,
    subtitle,
    fill = palette.white,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    subtitle?: string;
    fill?: string;
  },
) {
  doc
    .save()
    .roundedRect(x, y, width, height, 22)
    .fillAndStroke(fill, palette.line)
    .restore();

  doc
    .font("ReportSansBold")
    .fontSize(12)
    .fillColor(palette.navy)
    .text(title, x + 18, y + 16, {
      width: width - 36,
    });

  if (subtitle) {
    doc
      .font("ReportSans")
      .fontSize(9)
      .fillColor(palette.muted)
      .text(subtitle, x + 18, y + 33, {
        width: width - 36,
        lineGap: 1,
      });
  }

  return {
    x: x + 18,
    y: y + 58,
    width: width - 36,
    height: height - 74,
  };
}

function drawLegendItem(
  doc: PDFKit.PDFDocument,
  {
    x,
    y,
    color,
    label,
    dashed,
  }: {
    x: number;
    y: number;
    color: string;
    label: string;
    dashed?: boolean;
  },
) {
  doc.save();
  if (dashed) {
    doc.dash(5, { space: 3 });
  }
  doc
    .moveTo(x, y + 5)
    .lineTo(x + 20, y + 5)
    .lineWidth(2)
    .strokeColor(color)
    .stroke();
  doc.undash().restore();

  doc
    .font("ReportSans")
    .fontSize(8.5)
    .fillColor(palette.muted)
    .text(label, x + 26, y, {
      width: 120,
    });
}

function drawCalloutBox(
  doc: PDFKit.PDFDocument,
  {
    eyebrow,
    title,
    body,
    fill,
    stroke,
    titleColor = palette.navy,
    bodyColor = palette.ink,
  }: {
    eyebrow: string;
    title: string;
    body: string;
    fill: string;
    stroke: string;
    titleColor?: string;
    bodyColor?: string;
  },
) {
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const textWidth = width - 32;
  const eyebrowHeight = doc.heightOfString(eyebrow, {
    width: textWidth,
  });
  const titleHeight = doc.heightOfString(title, {
    width: textWidth,
    lineGap: 2,
  });
  const bodyHeight = doc.heightOfString(body, {
    width: textWidth,
    lineGap: 3,
  });
  const boxHeight = 28 + eyebrowHeight + titleHeight + bodyHeight + 30;

  ensureSpace(doc, boxHeight + 12);
  const y = doc.y;

  doc
    .save()
    .roundedRect(doc.page.margins.left, y, width, boxHeight, 18)
    .fillAndStroke(fill, stroke)
    .restore();

  doc
    .font("ReportSansBold")
    .fontSize(9)
    .fillColor(palette.muted)
    .text(eyebrow, doc.page.margins.left + 16, y + 16, {
      width: textWidth,
    });

  doc
    .font("ReportSansBold")
    .fontSize(17)
    .fillColor(titleColor)
    .text(title, doc.page.margins.left + 16, y + 32, {
      width: textWidth,
      lineGap: 2,
    });

  doc
    .font("ReportSans")
    .fontSize(10.5)
    .fillColor(bodyColor)
    .text(body, doc.page.margins.left + 16, y + 58, {
      width: textWidth,
      lineGap: 3,
    });

  doc.y = y + boxHeight + 12;
}

function drawCoverPage(doc: PDFKit.PDFDocument, check: CheckRecord) {
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - doc.page.margins.left - doc.page.margins.right;
  const statusTone = statusColor(check.resultSummary.overallStatus);

  doc
    .save()
    .rect(0, 0, pageWidth, 235)
    .fill(palette.navy)
    .restore();

  doc
    .save()
    .rect(0, 206, pageWidth, 29)
    .fill(palette.navySoft)
    .restore();

  doc
    .save()
    .roundedRect(doc.page.margins.left, 48, 158, 28, 14)
    .fill(palette.gold)
    .restore();

  doc
    .font("ReportSansBold")
    .fontSize(11)
    .fillColor(palette.navy)
    .text("Sanctions Screening", doc.page.margins.left + 18, 57);

  doc
    .font("ReportSans")
    .fontSize(11)
    .fillColor("#D5E3ED")
    .text("Stanford Law Maritime Sanctions Desk", doc.page.margins.left, 98);

  doc
    .font("ReportSansBold")
    .fontSize(28)
    .fillColor(palette.white)
    .text("Maritime Sanctions Screening Report", doc.page.margins.left, 120, {
      width: contentWidth * 0.78,
      lineGap: 6,
    });

  doc
    .font("ReportSans")
    .fontSize(13)
    .fillColor("#D5E3ED")
    .text(
      "Screening memo with sanctions evidence, source provenance, and vessel-context disclosures.",
      doc.page.margins.left,
      188,
      {
        width: contentWidth * 0.82,
        lineGap: 4,
      },
    );

  const chipY = 270;

  doc
    .save()
    .roundedRect(doc.page.margins.left, chipY, 150, 34, 17)
    .fill(statusTone)
    .restore();
  doc
    .font("ReportSansBold")
    .fontSize(11)
    .fillColor(palette.white)
    .text(statusLabel(check.resultSummary.overallStatus), doc.page.margins.left + 18, chipY + 11);

  doc
    .font("ReportSansBold")
    .fontSize(10)
    .fillColor(palette.muted)
    .text("Matter", doc.page.margins.left, 326);
  doc
    .font("ReportSansBold")
    .fontSize(24)
    .fillColor(palette.navy)
    .text(check.title, doc.page.margins.left, 342, {
      width: contentWidth * 0.82,
      lineGap: 4,
    });

  doc
    .font("ReportSans")
    .fontSize(11)
    .fillColor(palette.muted)
    .text(
      `Generated ${formatTimestamp(check.createdAt)} • ${sentenceCase(check.mode)} workflow • Subjects: ${check.subjects.join(" • ")}`,
      doc.page.margins.left,
      406,
      {
        width: contentWidth,
        lineGap: 3,
      },
    );

  const cardY = 458;
  const gap = 14;
  const cardWidth = (contentWidth - gap * 3) / 4;

  drawMetricCard(
    doc,
    doc.page.margins.left,
    cardY,
    cardWidth,
    118,
    "Confirmed / Strong",
    String(check.resultSummary.confirmedMatches),
    palette.danger,
  );
  drawMetricCard(
    doc,
    doc.page.margins.left + (cardWidth + gap),
    cardY,
    cardWidth,
    118,
    "Review Matches",
    String(check.resultSummary.reviewMatches),
    palette.warning,
  );
  drawMetricCard(
    doc,
    doc.page.margins.left + (cardWidth + gap) * 2,
    cardY,
    cardWidth,
    118,
    "Lists Cleared",
    check.resultSummary.clearSources.length > 0
      ? check.resultSummary.clearSources.map((source) => source.toUpperCase()).join(", ")
      : "None",
    palette.success,
  );
  drawMetricCard(
    doc,
    doc.page.margins.left + (cardWidth + gap) * 3,
    cardY,
    cardWidth,
    118,
    "Vessel Coverage",
    check.vesselIntel.confidence === "medium" ? "Medium" : "Low",
    palette.navySoft,
  );

  doc
    .font("ReportSansBold")
    .fontSize(11)
    .fillColor(palette.muted)
    .text("Executive signal", doc.page.margins.left, 612);
  doc
    .font("ReportSerif")
    .fontSize(14)
    .fillColor(palette.ink)
    .text(
      check.findings[0]?.summary ??
        "The screening run completed successfully and is ready for legal review.",
      doc.page.margins.left,
      630,
      {
        width: contentWidth,
        lineGap: 5,
      },
    );

  doc
    .font("ReportSans")
    .fontSize(9)
    .fillColor(palette.muted)
    .text(
      "This report does not constitute legal advice and is not a substitute for independent legal judgment.",
      doc.page.margins.left,
      doc.page.height - 42,
      {
        width: contentWidth,
        align: "center",
      },
    );
}

function drawTable<T extends Record<string, string>>(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
  columns: Array<TableColumn<T>>,
  rows: T[],
  options?: {
    rowTone?: (row: T) => string | undefined;
  },
) {
  drawSectionHeader(doc, title, subtitle);
  const startX = doc.page.margins.left;
  const rowPaddingX = 9;
  const rowPaddingY = 8;
  const availableWidth = columns.reduce((total, column) => total + column.width, 0);

  const drawHeader = () => {
    ensureSpace(doc, 34);
    let x = startX;
    const y = doc.y;

    for (const column of columns) {
      doc
        .save()
        .rect(x, y, column.width, 34)
        .fill(palette.navy)
        .restore();
      doc
        .font("ReportSansBold")
        .fontSize(9)
        .fillColor(palette.white)
        .text(column.header, x + rowPaddingX, y + 11, {
          width: column.width - rowPaddingX * 2,
          align: column.align ?? "left",
        });
      x += column.width;
    }

    doc.y += 34;
  };

  drawHeader();

  if (rows.length === 0) {
    doc
      .save()
      .rect(startX, doc.y, availableWidth, 36)
      .fillAndStroke(palette.white, palette.line)
      .restore();
    doc
      .font("ReportSans")
      .fontSize(10)
      .fillColor(palette.muted)
      .text("No rows to display.", startX + rowPaddingX, doc.y + 11, {
        width: availableWidth - rowPaddingX * 2,
      });
    doc.y += 48;
    return;
  }

  rows.forEach((row, rowIndex) => {
    const height = Math.max(
      30,
      ...columns.map((column) =>
        doc.heightOfString(String(row[column.key] ?? "—"), {
          width: column.width - rowPaddingX * 2,
          align: column.align,
        }) +
          rowPaddingY * 2,
      ),
    );

    if (doc.y + height > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
      drawHeader();
    }

    let x = startX;
    const y = doc.y;
    const backgroundTone =
      options?.rowTone?.(row) ?? (rowIndex % 2 === 0 ? palette.white : palette.mist);

    doc
      .save()
      .rect(startX, y, availableWidth, height)
      .fillAndStroke(backgroundTone, palette.line)
      .restore();

    for (const column of columns) {
      doc
        .font("ReportSans")
        .fontSize(9.5)
        .fillColor(palette.ink)
        .text(String(row[column.key] ?? "—"), x + rowPaddingX, y + rowPaddingY, {
          width: column.width - rowPaddingX * 2,
          align: column.align ?? "left",
          lineGap: 2,
        });
      x += column.width;
    }

    doc.y += height;
  });

  doc.moveDown(0.8);
}

function buildScreeningSchemaRows(check: CheckRecord) {
  if (check.mode === "entity") {
    return [
      ["Matter Title", check.title, "Internal screening reference"],
      ["Subject Name", check.entity?.subjectName ?? "Not supplied", "Primary entity or individual"],
      ["Subject Type", check.entity?.subjectType ?? "Not supplied", "Entity classification"],
      ["Company Number", check.entity?.companyNumber ?? "Not supplied", "Strong identifier if available"],
      ["Address", check.entity?.address ?? "Not supplied", "Context for matching"],
      ["Aliases", check.entity?.aliases?.join(", ") ?? "Not supplied", "Alternative names screened"],
    ];
  }

  if (check.mode === "pdf") {
    const pdfOperator = check.pdf?.parsedFields.operatorName;
    const pdfManager = check.pdf?.parsedFields.managerName;
    const pdfOperatorManagerValue =
      pdfOperator && pdfManager && pdfOperator.toLowerCase() === pdfManager.toLowerCase()
        ? pdfOperator
        : [pdfOperator, pdfManager].filter(Boolean).join(" / ") || "Not supplied";

    return [
      ["Matter Title", check.title, "Document-led screening reference"],
      ["Uploaded File", check.pdf?.fileName ?? "Not supplied", "Source document"],
      ["Resolved Vessel", check.pdf?.parsedFields.vesselName ?? "Not supplied", "Parsed from upload"],
      ["Resolved IMO", check.pdf?.parsedFields.imoNumber ?? "Not supplied", "Strong vessel identifier"],
      ["Resolved Owner", check.pdf?.parsedFields.ownerName ?? "Not supplied", "Parsed control-party name"],
      ["Operator / Manager", pdfOperatorManagerValue, "Operating and management party"],
      ["Resolved Seller", check.pdf?.parsedFields.sellerName ?? "Not supplied", "Parsed counterparty"],
      ["Resolved Buyer", check.pdf?.parsedFields.buyerName ?? "Not supplied", "Parsed counterparty"],
    ];
  }

  const operator = check.vessel?.operatorName;
  const manager = check.vessel?.managerName;
  const operatorManagerValue =
    operator && manager && operator.toLowerCase() === manager.toLowerCase()
      ? operator
      : [operator, manager].filter(Boolean).join(" / ") || "Not supplied";

  return [
    ["Matter Title", check.title, "Internal screening reference"],
    ["Vessel Name", check.vessel?.vesselName ?? "Not supplied", "Optional when IMO is available"],
    ["IMO Number", check.vessel?.imoNumber ?? "Not supplied", "Primary maritime identifier"],
    ["Owner", check.vessel?.ownerName ?? "Not supplied", "Registered or beneficial owner screened when present"],
    ["Operator / Manager", operatorManagerValue, "Operating and management party screened when present"],
    ["Flag", check.vessel?.flag ?? "Not supplied", "Jurisdictional context"],
    ["Registry", check.vessel?.registry ?? "Not supplied", "Registration context"],
    ["Seller", check.vessel?.sellerName ?? "Not supplied", "Counterparty screened when present"],
    ["Buyer", check.vessel?.buyerName ?? "Not supplied", "Counterparty screened when present"],
  ];
}

function isIndirectConnection(candidate: CheckRecord["matchCandidates"][number]) {
  return (
    candidate.subjectLabel.startsWith("Linked Party from") ||
    candidate.reasons.some((reason) => reason.code === "linked_party_derivation")
  );
}

function formatMatchBasis(candidate: CheckRecord["matchCandidates"][number]) {
  const field = candidate.matchedField.replace(/_/g, " ");
  return `${field}: ${candidate.matchedValue}`;
}

function buildScreenedSubjectRows(check: CheckRecord) {
  return buildScreeningSubjects(check).map((subject) => {
    const subjectMatches = check.matchCandidates.filter(
      (candidate) => candidate.subjectLabel === subject.label,
    );
    const confirmed = subjectMatches.filter((candidate) => candidate.strength !== "review");
    const review = subjectMatches.filter((candidate) => candidate.strength === "review");

    return {
      role: subject.label,
      screened:
        dedupeStrings([
          ...subject.names,
          ...subject.identifiers.map((identifier) => `${identifier.type} ${identifier.value}`),
        ]).join("; ") || "Not supplied",
      context:
        dedupeStrings([...subject.countries, ...subject.addresses]).join("; ") || "No extra context",
      outcome:
        confirmed.length > 0
          ? `${confirmed.length} factual match${confirmed.length === 1 ? "" : "es"}`
          : review.length > 0
            ? `${review.length} review candidate${review.length === 1 ? "" : "s"}`
            : "No match surfaced",
    };
  });
}

function buildConnectionFactRows(check: CheckRecord) {
  return check.matchCandidates
    .filter((candidate) => candidate.strength !== "review")
    .map((candidate) => ({
      connection: isIndirectConnection(candidate) ? "Indirect" : "Direct",
      subject: candidate.subjectLabel,
      matched: `${candidate.primaryName} (${candidate.source.toUpperCase()})`,
      fact: isIndirectConnection(candidate)
        ? `${candidate.subjectLabel} connected through linked-party data on the matched record; basis ${formatMatchBasis(candidate)}.`
        : `${candidate.subjectLabel} matched the sanctions record by ${formatMatchBasis(candidate)}.`,
    }));
}

function buildConnectionNarrative(check: CheckRecord) {
  const confirmed = check.matchCandidates.filter((candidate) => candidate.strength !== "review");
  const directMatches = confirmed.filter((candidate) => !isIndirectConnection(candidate));
  const indirectMatches = confirmed.filter((candidate) => isIndirectConnection(candidate));

  if (confirmed.length === 0) {
    return "No direct or indirect sanctions connection was surfaced across the screened vessel, owner/operator names, transaction parties, and derived linked-party names in this run.";
  }

  const directLine =
    directMatches.length > 0
      ? `Direct connections: ${directMatches
          .map(
            (candidate) =>
              `${candidate.subjectLabel} matched ${candidate.primaryName} on ${candidate.source.toUpperCase()} by ${formatMatchBasis(candidate)}`,
          )
          .join(". ")}.`
      : "Direct connections: none recorded.";
  const indirectLine =
    indirectMatches.length > 0
      ? `Indirect connections: ${indirectMatches
          .map(
            (candidate) =>
              `${candidate.subjectLabel} linked to ${candidate.primaryName} on ${candidate.source.toUpperCase()} by ${formatMatchBasis(candidate)}`,
          )
          .join(". ")}.`
      : "Indirect connections: none recorded.";

  return `${directLine} ${indirectLine}`;
}

function buildSanctionsRows(check: CheckRecord) {
  return check.matchCandidates.map((candidate) => ({
    status: candidate.strength === "review" ? "REVIEW" : "MATCH",
    source: `${candidate.source.toUpperCase()} / ${candidate.sourceMode.toUpperCase()}`,
    subject: candidate.subjectLabel,
    record: candidate.primaryName,
    basis: `${candidate.matchedField}: ${candidate.matchedValue}`,
    score: candidate.score.toFixed(2),
  }));
}

function buildClearedRows(check: CheckRecord) {
  return check.sourceVersions.map((version) => ({
    source: version.source.toUpperCase(),
    mode: version.sourceMode.toUpperCase(),
    fetched: formatTimestamp(version.fetchedAt),
    entries: version.entryCount.toLocaleString(),
    outcome: check.resultSummary.clearSources.includes(version.source)
      ? "No current match"
      : "One or more hits",
  }));
}

function buildCitationRows(check: CheckRecord) {
  return check.citations.map((citation) => ({
    label: citation.label,
    kind: citation.kind.toUpperCase(),
    accessed: citation.accessedAt ? formatTimestamp(citation.accessedAt) : "Stored artifact",
    location: citation.url,
  }));
}

function buildSyntheticCounterpartyRows(scenario: VesselIntelSyntheticScenario) {
  return scenario.counterparties.map((counterparty) => ({
    vessel: counterparty.vesselName,
    imo: counterparty.imoNumber,
    role: counterparty.role,
    note: counterparty.note,
  }));
}

function buildSyntheticTimelineRows(scenario: VesselIntelSyntheticScenario) {
  return scenario.timeline.map((event) => ({
    timestamp: event.timestamp,
    vessel: `${event.vesselName} (${event.imoNumber})`,
    area: event.area,
    observation: `${event.aisStatus.toUpperCase()} • ${event.course} • ${event.speedKnots} kn • ${event.detail}`,
  }));
}

function drawSyntheticDashboard(doc: PDFKit.PDFDocument, scenario: VesselIntelSyntheticScenario) {
  const data = getScenarioData(scenario);
  const primaryVesselName = getPrimaryVesselName(scenario);
  const primaryData = data.filter((event) => event.vesselName === primaryVesselName);
  const darkEvent = primaryData.find((event) => event.aisStatus === "dark");
  const reappearedEvent = primaryData.find((event) => event.aisStatus === "reappeared");
  const darkGap =
    darkEvent && reappearedEvent
      ? formatDuration(reappearedEvent.timestampMs - darkEvent.timestampMs)
      : "N/A";
  const courseShift = shortestCourseDelta(
    darkEvent?.courseDegrees,
    reappearedEvent?.courseDegrees,
  );
  const displacement =
    darkEvent && reappearedEvent
      ? `${Math.round(
          haversineDistanceNm(
            darkEvent.latitude,
            darkEvent.longitude,
            reappearedEvent.latitude,
            reappearedEvent.longitude,
          ),
        )} nm`
      : "N/A";
  const lowSpeedSignals = `${data.filter((event) => event.speedValue < 4).length} events`;
  const panelWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;
  const gap = 12;
  const cardHeight = 106;
  const cardWidth = (panelWidth - gap * 3) / 4;
  const routeHeight = 272;
  const chartHeight = 196;
  const bottomWidth = (panelWidth - gap) / 2;

  doc.addPage();
  drawSectionHeader(
    doc,
    "Maritime Activity Dashboard",
    "Analytics rendered from the scenario sequence",
  );

  const cardY = doc.y;
  drawInsightCard(doc, {
    x: startX,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    label: "AIS Dark Gap",
    value: darkGap,
    detail: "Primary vessel silent between last eastbound ping and westbound reappearance.",
    tone: palette.danger,
  });
  drawInsightCard(doc, {
    x: startX + cardWidth + gap,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    label: "Course Swing",
    value: `${Math.round(courseShift ?? 0)}°`,
    detail: "Directional reversal highlighted between the last dark ping and recovery point.",
    tone: palette.warning,
  });
  drawInsightCard(doc, {
    x: startX + (cardWidth + gap) * 2,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    label: "Reappearance Shift",
    value: displacement,
    detail: "Displacement between the dark waypoint and the later transmitted position.",
    tone: palette.navySoft,
  });
  drawInsightCard(doc, {
    x: startX + (cardWidth + gap) * 3,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    label: "Low-Speed Cluster",
    value: lowSpeedSignals,
    detail: "Events below 4 knots during the rendezvous phase.",
    tone: palette.success,
  });

  const routeY = cardY + cardHeight + 16;
  const routePanel = drawPanelShell(doc, {
    x: startX,
    y: routeY,
    width: panelWidth,
    height: routeHeight,
    title: "Arctic Route Plot",
    subtitle: "Plotted from waypoint coordinates in the scenario analysis",
    fill: "#F9FCFE",
  });
  const minLongitude = Math.min(...data.map((event) => event.longitude)) - 1.5;
  const maxLongitude = Math.max(...data.map((event) => event.longitude)) + 1.5;
  const minLatitude = Math.min(...data.map((event) => event.latitude)) - 0.4;
  const maxLatitude = Math.max(...data.map((event) => event.latitude)) + 0.4;
  const plotX = routePanel.x + 8;
  const plotY = routePanel.y + 8;
  const plotWidth = routePanel.width - 16;
  const plotHeight = routePanel.height - 34;
  const projectPoint = (event: SyntheticScenarioDatum) => ({
    x:
      plotX +
      ((event.longitude - minLongitude) / (maxLongitude - minLongitude || 1)) * plotWidth,
    y:
      plotY +
      plotHeight -
      ((event.latitude - minLatitude) / (maxLatitude - minLatitude || 1)) * plotHeight,
  });

  doc
    .save()
    .roundedRect(plotX, plotY, plotWidth, plotHeight, 18)
    .fillAndStroke(palette.ice, "#C9DCE6")
    .restore();

  for (let index = 1; index < 6; index += 1) {
    const verticalX = plotX + (plotWidth / 6) * index;
    const horizontalY = plotY + (plotHeight / 5) * index;

    doc
      .save()
      .moveTo(verticalX, plotY)
      .lineTo(verticalX, plotY + plotHeight)
      .lineWidth(0.6)
      .strokeColor("#CFE0E8")
      .stroke()
      .moveTo(plotX, horizontalY)
      .lineTo(plotX + plotWidth, horizontalY)
      .stroke()
      .restore();
  }

  doc
    .font("ReportSansBold")
    .fontSize(10)
    .fillColor(palette.navy)
    .text("Laptev Sea", plotX + plotWidth - 104, plotY + 18);
  doc
    .font("ReportSansBold")
    .fontSize(10)
    .fillColor(palette.navy)
    .text("Severnaya Zemlya", plotX + plotWidth / 2 - 52, plotY + 54);
  doc
    .font("ReportSansBold")
    .fontSize(10)
    .fillColor(palette.navy)
    .text("Kara Sea", plotX + 18, plotY + plotHeight - 32);

  const vessels = Array.from(new Set(data.map((event) => event.vesselName)));
  vessels.forEach((vesselName) => {
    const vesselEvents = data.filter((event) => event.vesselName === vesselName);
    const tone = vesselName === primaryVesselName ? palette.danger : palette.navySoft;

    vesselEvents.forEach((event, index) => {
      const point = projectPoint(event);
      const next = vesselEvents[index + 1];

      if (next) {
        const nextPoint = projectPoint(next);
        doc.save();
        if (event.aisStatus === "dark" || next.aisStatus === "reappeared") {
          doc.dash(6, { space: 4 });
        }
        doc
          .moveTo(point.x, point.y)
          .lineTo(nextPoint.x, nextPoint.y)
          .lineWidth(2)
          .strokeColor(tone)
          .stroke();
        doc.undash().restore();
      }

      const markerTone =
        event.aisStatus === "dark"
          ? palette.danger
          : event.aisStatus === "reappeared"
            ? palette.warning
            : tone;
      doc
        .save()
        .circle(point.x, point.y, 4.5)
        .fillAndStroke(markerTone, palette.white)
        .restore();

      doc
        .font("ReportSansBold")
        .fontSize(7.5)
        .fillColor(palette.navy)
        .text(String(index + 1), point.x + 6, point.y - 10, {
          width: 16,
        });
    });

    const lastEvent = vesselEvents[vesselEvents.length - 1];
    if (lastEvent) {
      const lastPoint = projectPoint(lastEvent);
      doc
        .font("ReportSansBold")
        .fontSize(8.5)
        .fillColor(tone)
        .text(vesselName, lastPoint.x + 8, lastPoint.y - 4, {
          width: 80,
        });
    }
  });

  drawLegendItem(doc, {
    x: plotX + 10,
    y: plotY + plotHeight - 18,
    color: palette.danger,
    label: `${primaryVesselName} track`,
  });
  drawLegendItem(doc, {
    x: plotX + 122,
    y: plotY + plotHeight - 18,
    color: palette.navySoft,
    label: `${scenario.counterparties.find((counterparty) => counterparty.vesselName !== primaryVesselName)?.vesselName ?? "Counterparty"} track`,
  });
  drawLegendItem(doc, {
    x: plotX + 244,
    y: plotY + plotHeight - 18,
    color: palette.warning,
    label: "AIS gap segment",
    dashed: true,
  });

  const bottomY = routeY + routeHeight + 16;
  const ribbonPanel = drawPanelShell(doc, {
    x: startX,
    y: bottomY,
    width: bottomWidth,
    height: chartHeight,
    title: "AIS Activity Ribbon",
    subtitle: "Dark gap is shaded across the scenario event window",
    fill: "#FCFDFC",
  });
  const minTime = Math.min(...data.map((event) => event.timestampMs));
  const maxTime = Math.max(...data.map((event) => event.timestampMs));
  const centerLineY = ribbonPanel.y + ribbonPanel.height / 2;
  const primaryLaneY = centerLineY - 34;
  const counterpartyLaneY = centerLineY + 34;
  const toTimeX = (event: SyntheticScenarioDatum) =>
    ribbonPanel.x +
    ((event.timestampMs - minTime) / (maxTime - minTime || 1)) * ribbonPanel.width;

  if (darkEvent && reappearedEvent) {
    const gapX = toTimeX(darkEvent);
    const gapWidth = Math.max(toTimeX(reappearedEvent) - gapX, 24);

    doc
      .save()
      .roundedRect(gapX, ribbonPanel.y + 8, gapWidth, ribbonPanel.height - 16, 12)
      .fillAndStroke("#FFF2F0", "#F1C4BC")
      .restore();
  }

  doc
    .save()
    .moveTo(ribbonPanel.x, primaryLaneY)
    .lineTo(ribbonPanel.x + ribbonPanel.width, primaryLaneY)
    .moveTo(ribbonPanel.x, counterpartyLaneY)
    .lineTo(ribbonPanel.x + ribbonPanel.width, counterpartyLaneY)
    .lineWidth(1)
    .strokeColor("#D7E2E8")
    .stroke()
    .restore();

  data.forEach((event) => {
    const x = toTimeX(event);
    const laneY = event.vesselName === primaryVesselName ? primaryLaneY : counterpartyLaneY;
    const tone =
      event.aisStatus === "dark"
        ? palette.danger
        : event.aisStatus === "reappeared"
          ? palette.warning
          : event.vesselName === primaryVesselName
            ? palette.danger
            : palette.navySoft;

    doc
      .save()
      .moveTo(x, laneY)
      .lineTo(x, centerLineY)
      .lineWidth(1.2)
      .strokeColor(tone)
      .stroke()
      .circle(x, laneY, 5)
      .fillAndStroke(tone, palette.white)
      .restore();

    doc
      .font("ReportSansBold")
      .fontSize(8)
      .fillColor(palette.navy)
      .text(event.timestamp.slice(11, 16), x - 16, laneY - 20, {
        width: 32,
        align: "center",
      });

    doc
      .font("ReportSans")
      .fontSize(7.5)
      .fillColor(palette.muted)
      .text(event.aisStatus.toUpperCase(), x - 22, laneY + 10, {
        width: 44,
        align: "center",
      });
  });

  doc
    .font("ReportSansBold")
    .fontSize(8.5)
    .fillColor(palette.danger)
    .text(primaryVesselName, ribbonPanel.x, primaryLaneY - 34, {
      width: 100,
    });
  doc
    .font("ReportSansBold")
    .fontSize(8.5)
    .fillColor(palette.navySoft)
    .text(
      scenario.counterparties.find((counterparty) => counterparty.vesselName !== primaryVesselName)
        ?.vesselName ?? "Counterparty",
      ribbonPanel.x,
      counterpartyLaneY + 18,
      {
        width: 100,
      },
    );

  const speedPanel = drawPanelShell(doc, {
    x: startX + bottomWidth + gap,
    y: bottomY,
    width: bottomWidth,
    height: chartHeight,
    title: "Speed Profile",
    subtitle: "Low-speed cluster highlighted below the 4-knot line",
    fill: "#FCFBF7",
  });
  const yMax = Math.max(14, ...data.map((event) => event.speedValue + 1));
  const xLeft = speedPanel.x + 8;
  const yBottom = speedPanel.y + speedPanel.height - 16;
  const chartWidth = speedPanel.width - 16;
  const chartHeightInner = speedPanel.height - 24;
  const toChartY = (speed: number) => yBottom - (speed / yMax) * chartHeightInner;
  const lowSpeedBandHeight = (4 / yMax) * chartHeightInner;

  doc
    .save()
    .roundedRect(xLeft, yBottom - lowSpeedBandHeight, chartWidth, lowSpeedBandHeight, 12)
    .fill("#FFF6E7")
    .restore();

  [0, 4, 8, 12].forEach((tick) => {
    const y = toChartY(tick);

    doc
      .save()
      .moveTo(xLeft, y)
      .lineTo(xLeft + chartWidth, y)
      .lineWidth(tick === 0 ? 1.2 : 0.8)
      .strokeColor("#D7E2E8")
      .stroke()
      .restore();

    doc
      .font("ReportSans")
      .fontSize(7.5)
      .fillColor(palette.muted)
      .text(`${tick}`, speedPanel.x - 4, y - 4, {
        width: 20,
        align: "right",
      });
  });

  vessels.forEach((vesselName) => {
    const vesselEvents = data.filter((event) => event.vesselName === vesselName);
    const tone = vesselName === primaryVesselName ? palette.danger : palette.navySoft;

    vesselEvents.forEach((event, index) => {
      const x = xLeft + ((event.timestampMs - minTime) / (maxTime - minTime || 1)) * chartWidth;
      const y = toChartY(event.speedValue);
      const next = vesselEvents[index + 1];

      if (next) {
        const nextX =
          xLeft + ((next.timestampMs - minTime) / (maxTime - minTime || 1)) * chartWidth;
        const nextY = toChartY(next.speedValue);

        doc
          .save()
          .moveTo(x, y)
          .lineTo(nextX, nextY)
          .lineWidth(2)
          .strokeColor(tone)
          .stroke()
          .restore();
      }

      doc
        .save()
        .circle(x, y, 4)
        .fillAndStroke(tone, palette.white)
        .restore();
    });
  });

  drawLegendItem(doc, {
    x: speedPanel.x + 8,
    y: yBottom + 6,
    color: palette.danger,
    label: primaryVesselName,
  });
  drawLegendItem(doc, {
    x: speedPanel.x + 122,
    y: yBottom + 6,
    color: palette.navySoft,
    label:
      scenario.counterparties.find((counterparty) => counterparty.vesselName !== primaryVesselName)
        ?.vesselName ?? "Counterparty",
  });

  doc.y = bottomY + chartHeight + 12;
}

function drawSyntheticScenarioSection(doc: PDFKit.PDFDocument, check: CheckRecord) {
  const scenario = check.vesselIntel.syntheticScenario;

  if (!scenario) {
    return;
  }

  drawSectionHeader(
    doc,
    scenario.label,
    "Vessel-intelligence scenario analysis",
  );

  drawCalloutBox(doc, {
    eyebrow: "Scenario narrative",
    title: scenario.title,
    body: `${scenario.summary} ${scenario.legalNotice}`,
    fill: palette.ivory,
    stroke: palette.gold,
    titleColor: palette.navy,
    bodyColor: palette.ink,
  });

  drawSyntheticDashboard(doc, scenario);

  drawTable(
    doc,
    "Counterparty Matrix",
    "Vessels involved in the scenario analysis",
    [
      { key: "vessel", header: "Vessel", width: 88 },
      { key: "imo", header: "IMO", width: 64 },
      { key: "role", header: "Role", width: 118 },
      { key: "note", header: "Analyst Note", width: 217 },
    ],
    buildSyntheticCounterpartyRows(scenario),
  );

  drawTable(
    doc,
    "AIS Timeline",
    "Timeline showing rendezvous, AIS dark activity, and directional reversal",
    [
      { key: "timestamp", header: "Timestamp", width: 86 },
      { key: "vessel", header: "Vessel", width: 92 },
      { key: "area", header: "Area", width: 111 },
      { key: "observation", header: "Observation", width: 198 },
    ],
    buildSyntheticTimelineRows(scenario),
    {
      rowTone: (row) =>
        row.observation.includes("DARK")
          ? "#FFF2F0"
          : row.observation.includes("REAPPEARED")
            ? "#FFF8E8"
            : undefined,
    },
  );

  drawSectionHeader(
    doc,
    "STS Assessment",
    "Assessment narrative paired with scenario provenance",
  );

  drawCalloutBox(doc, {
    eyebrow: `${scenario.stsAssessment.area} • ${scenario.stsAssessment.window}`,
    title: "Rendezvous narrative",
    body: `${scenario.stsAssessment.narrative} Confidence: ${scenario.stsAssessment.confidence.toUpperCase()}.`,
    fill: "#FFF7E3",
    stroke: palette.warning,
    titleColor: palette.navy,
    bodyColor: palette.ink,
  });
}

function drawNarrativeSections(doc: PDFKit.PDFDocument, sections: ReportSection[]) {
  sections.forEach((section) => {
    drawSectionHeader(doc, section.title);
    writeParagraph(doc, section.body, {
      font: "ReportSerif",
      size: 12,
      lineGap: 4,
      color: palette.ink,
    });
    lineBreak(doc, 8);
  });
}

export function generateDraftReportSections(check: CheckRecord): ReportSection[] {
  const subjects = check.subjects.join(", ");
  const sourceLine = check.sourceVersions
    .map(
      (version) =>
        `${version.source.toUpperCase()} ${version.sourceMode} import fetched ${formatTimestamp(
          version.fetchedAt,
        )}`,
    )
    .join("; ");
  const syntheticScenario = check.vesselIntel.syntheticScenario;
  const syntheticLine = syntheticScenario
    ? ` A vessel-intelligence scenario titled "${syntheticScenario.title}" is included. ${syntheticScenario.stsAssessment.narrative} Note: ${syntheticScenario.legalNotice}`
    : "";

  return [
    {
      title: "Executive Summary",
      body: `This ${check.mode} screening run was prepared for ${subjects}. Overall status: ${sentenceCase(check.resultSummary.overallStatus)}. ${check.findings[0]?.summary ?? "The screening run completed successfully."}`,
    },
    {
      title: "Formal Sanctions Check",
      body:
        check.matchCandidates.length > 0
          ? check.matchCandidates
              .map(
                (candidate) =>
                  `${candidate.subjectLabel} matched ${candidate.primaryName} on ${candidate.source.toUpperCase()} (${candidate.strength}, ${candidate.matchedField}, score ${candidate.score.toFixed(2)}). ${candidate.reasons.map((reason) => reason.detail).join(" ")}`,
              )
              .join(" ")
          : `No current OFAC or EU match candidate cleared the review thresholds in this run. Source coverage: ${sourceLine}. Lists cleared with no match: ${check.resultSummary.clearSources.length > 0 ? check.resultSummary.clearSources.map((source) => source.toUpperCase()).join(", ") : "none"}.`,
    },
    {
      title: "Connection Facts",
      body: buildConnectionNarrative(check),
    },
    {
      title: "Vessel Intelligence",
      body:
        check.mode === "entity"
          ? "This run was entity-led, so vessel intelligence is not applicable."
          : `${check.vesselIntel.summary}${syntheticLine} Signals: ${check.vesselIntel.signals.map((signal) => `${signal.title} (${signal.severity})`).join("; ") || "none"}.`,
    },
    {
      title: "Coverage and Provenance",
      body: `Source coverage: ${sourceLine}. Coverage limits: ${check.vesselIntel.limitations.join(" ")}`,
    },
  ];
}

export async function generateDraftReportDocument(check: CheckRecord) {
  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 56,
      bottom: 56,
      left: 54,
      right: 54,
    },
    info: {
      Title: check.title,
      Author: "Stanford Law Maritime Sanctions Desk",
      Subject: "Maritime sanctions screening report",
      Keywords: "sanctions, vessel intelligence, maritime compliance",
    },
    autoFirstPage: false,
  });
  await registerReportFonts(doc);
  doc.addPage();
  doc.font(reportFontNames.sans);
  const pdfBufferPromise = createPdfBuffer(doc);
  drawCoverPage(doc, check);
  doc.addPage();

  drawTable(
    doc,
    "Screening Schema",
    "Field-by-field intake summary used to drive the sanctions workflow",
    [
      { key: "field", header: "Field", width: 120 },
      { key: "value", header: "Value", width: 155 },
      { key: "notes", header: "Notes", width: 212 },
    ],
    buildScreeningSchemaRows(check).map(([field, value, notes]) => ({
      field,
      value,
      notes,
    })),
  );

  drawTable(
    doc,
    "Screened Subject Matrix",
    "Every vessel, control-party, and transaction subject normalized into the screening run",
    [
      { key: "role", header: "Role", width: 90 },
      { key: "screened", header: "Screened Data", width: 192 },
      { key: "context", header: "Context", width: 105 },
      { key: "outcome", header: "Outcome", width: 100 },
    ],
    buildScreenedSubjectRows(check),
    {
      rowTone: (row) =>
        row.outcome.includes("factual match")
          ? "#FFF2F0"
          : row.outcome.includes("review")
            ? "#FFF8E8"
            : "#F9FCFE",
    },
  );

  if (check.vesselIntel.syntheticScenario) {
    doc.addPage();
    drawSyntheticScenarioSection(doc, check);
  }
  drawNarrativeSections(doc, check.reportSections);

  drawTable(
    doc,
    "Connection Facts",
    check.matchCandidates.some((candidate) => candidate.strength !== "review")
      ? "Direct and indirect sanctions linkages stated as screening facts"
      : "No factual sanctions linkage was surfaced across the screened subjects",
    [
      { key: "connection", header: "Link Type", width: 76 },
      { key: "subject", header: "Screened Subject", width: 106 },
      { key: "matched", header: "Matched Record", width: 126 },
      { key: "fact", header: "Fact", width: 179 },
    ],
    buildConnectionFactRows(check),
    {
      rowTone: (row) =>
        row.connection === "Indirect" ? "#FFF8E8" : "#FFF2F0",
    },
  );

  drawTable(
    doc,
    "Sanctions Decision Matrix",
    check.matchCandidates.length > 0
      ? "Matched records and the exact basis for the result"
      : "No match candidates exceeded the review threshold in the current source set",
    [
      { key: "status", header: "Status", width: 62, align: "center" },
      { key: "source", header: "Source", width: 84 },
      { key: "subject", header: "Subject", width: 92 },
      { key: "record", header: "Record", width: 122 },
      { key: "basis", header: "Match Basis", width: 92 },
      { key: "score", header: "Score", width: 35, align: "right" },
    ],
    buildSanctionsRows(check),
    {
      rowTone: (row) =>
        row.status === "MATCH"
          ? "#FFF2F0"
          : row.status === "REVIEW"
            ? "#FFF8E8"
            : undefined,
    },
  );

  drawTable(
    doc,
    "Source Coverage Matrix",
    "Every imported source version used for the run, including outcomes",
    [
      { key: "source", header: "Source", width: 70 },
      { key: "mode", header: "Mode", width: 70 },
      { key: "fetched", header: "Fetched", width: 120 },
      { key: "entries", header: "Entries", width: 70, align: "right" },
      { key: "outcome", header: "Outcome", width: 157 },
    ],
    buildClearedRows(check),
    {
      rowTone: (row) =>
        row.outcome === "No current match" ? "#F2FBF6" : "#FFF2F0",
    },
  );

  if (check.matchCandidates.length > 0) {
    drawSectionHeader(
      doc,
      "Evidence Notes",
      "Narrative rationale attached to each hit or derived linked-party result",
    );
    check.matchCandidates.forEach((candidate) => {
      ensureSpace(doc, 84);
      const y = doc.y;
      const cardWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc
        .save()
        .roundedRect(doc.page.margins.left, y, cardWidth, 72, 16)
        .fillAndStroke(candidate.strength === "review" ? "#FFF8E8" : "#FFF2F0", palette.line)
        .restore();

      doc
        .font("ReportSansBold")
        .fontSize(11)
        .fillColor(palette.navy)
        .text(
          `${candidate.subjectLabel} -> ${candidate.primaryName}`,
          doc.page.margins.left + 16,
          y + 14,
        );

      doc
        .font("ReportSans")
        .fontSize(10)
        .fillColor(palette.ink)
        .text(
          `${candidate.source.toUpperCase()} ${candidate.sourceMode.toUpperCase()} • ${candidate.matchedField} • score ${candidate.score.toFixed(2)}`,
          doc.page.margins.left + 16,
          y + 34,
        );

      doc
        .font("ReportSans")
        .fontSize(9.5)
        .fillColor(palette.muted)
        .text(
          candidate.reasons.map((reason) => reason.detail).join(" "),
          doc.page.margins.left + 16,
          y + 50,
          {
            width: cardWidth - 32,
            lineGap: 2,
          },
        );

      doc.y += 86;
    });
  }

  drawTable(
    doc,
    "Tracked Sources and Artifacts",
    "Citations, supporting sources, and stored workflow artifacts",
    [
      { key: "label", header: "Label", width: 118 },
      { key: "kind", header: "Kind", width: 70 },
      { key: "accessed", header: "Accessed", width: 120 },
      { key: "location", header: "Location", width: 179 },
    ],
    buildCitationRows(check),
  );
  doc.end();

  const buffer = await pdfBufferPromise;
  const relativePath = path.join(
    "reports",
    `${check.id}-${sanitizeFileName(check.title || "screening-report")}.pdf`,
  );

  await writeBuffer(relativePath, buffer);

  return relativePath;
}
