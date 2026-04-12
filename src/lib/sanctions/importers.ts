import { createHash } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import type {
  Prisma,
  SanctionsEntry as PrismaSanctionsEntry,
  SanctionsSource,
  SourceMode,
  SourceVersion,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SourceVersionSummary } from "@/lib/checks/types";
import {
  cleanString,
  compactJoin,
  dedupeStrings,
  normalizeIdentifier,
  normalizeText,
  parseDateValue,
  splitMultiValue,
  toArray,
} from "@/lib/sanctions/normalize";

const OFAC_SDN_XML_URL =
  "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML";
const EU_METADATA_URL =
  "https://data.europa.eu/api/hub/search/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions?locale=en";
const EU_FALLBACK_URL =
  process.env.EU_FSF_FALLBACK_URL ??
  "https://data.opensanctions.org/datasets/latest/eu_fsf/targets.simple.csv";
const IMPORT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const INSERT_CHUNK_SIZE = 250;

interface PersistableSanctionsEntry {
  externalId: string;
  schema: string;
  primaryName: string;
  normalizedName: string;
  aliases: string[];
  normalizedAliases: string[];
  countries: string[];
  addresses: string[];
  identifiers: Array<{ type: string; value: string; normalizedValue: string }>;
  birthDates: string[];
  sanctionsPrograms: string[];
  raw: Record<string, unknown>;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function toJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function publishedAtFromUnknown(value: unknown) {
  return typeof value === "string" ? parseDateValue(value) : undefined;
}

function mapSourceVersion(version: SourceVersion): SourceVersionSummary {
  return {
    id: version.id,
    source: version.source,
    sourceMode: version.sourceMode,
    label: version.label,
    url: version.url,
    checksum: version.checksum,
    fetchedAt: version.fetchedAt.toISOString(),
    publishedAt: version.publishedAt?.toISOString(),
    entryCount: version.entryCount,
  };
}

async function persistSourceVersion({
  source,
  sourceMode,
  label,
  url,
  checksum,
  publishedAt,
  metadata,
  entries,
}: {
  source: SanctionsSource;
  sourceMode: SourceMode;
  label: string;
  url: string;
  checksum: string;
  publishedAt?: Date;
  metadata?: Record<string, unknown>;
  entries: PersistableSanctionsEntry[];
}) {
  const existing = await prisma.sourceVersion.findUnique({
    where: {
      source_sourceMode_checksum: {
        source,
        sourceMode,
        checksum,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.$transaction(async (tx) => {
    const version = await tx.sourceVersion.create({
      data: {
        source,
        sourceMode,
        label,
        url,
        checksum,
        publishedAt,
        entryCount: entries.length,
        metadata: metadata ? toJson(metadata) : undefined,
      },
    });

    for (let index = 0; index < entries.length; index += INSERT_CHUNK_SIZE) {
      const chunk = entries.slice(index, index + INSERT_CHUNK_SIZE);

      await tx.sanctionsEntry.createMany({
        data: chunk.map((entry) => ({
          sourceVersionId: version.id,
          externalId: entry.externalId,
          schema: entry.schema,
          primaryName: entry.primaryName,
          normalizedName: entry.normalizedName,
          aliases: entry.aliases,
          normalizedAliases: entry.normalizedAliases,
          countries: entry.countries,
          addresses: entry.addresses,
          identifiers: entry.identifiers,
          birthDates: entry.birthDates,
          sanctionsPrograms: entry.sanctionsPrograms,
          raw: toJson(entry.raw),
        })),
      });
    }

    return version;
  });
}

function buildOfacName(entry: Record<string, unknown>) {
  const lastName = cleanString(entry.lastName) ?? "";
  const firstName = cleanString(entry.firstName);
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || lastName || "Unnamed OFAC entry";
}

function parseOfacAliases(akaList: unknown) {
  const aliases = toArray((akaList as { aka?: unknown })?.aka).map((aka) => {
    const alias = aka as Record<string, unknown>;
    return compactJoin(
      [cleanString(alias.firstName), cleanString(alias.lastName)],
      " ",
    );
  });

  return dedupeStrings(aliases);
}

function parseOfacAddresses(addressList: unknown) {
  return dedupeStrings(
    toArray((addressList as { address?: unknown })?.address).map((address) => {
      const item = address as Record<string, unknown>;
      return compactJoin(
        [
          cleanString(item.address1),
          cleanString(item.address2),
          cleanString(item.address3),
          cleanString(item.city),
          cleanString(item.stateOrProvince),
          cleanString(item.postalCode),
          cleanString(item.country),
        ],
      );
    }),
  );
}

function parseOfacCountries(entry: Record<string, unknown>) {
  const addresses = toArray((entry.addressList as { address?: unknown })?.address);
  const addressCountries = addresses.map((address) =>
    cleanString((address as Record<string, unknown>).country),
  );
  const nationalityCountries = toArray(
    (entry.nationalityList as { nationality?: unknown })?.nationality,
  ).map((item) => cleanString((item as Record<string, unknown>).country));
  const citizenshipCountries = toArray(
    (entry.citizenshipList as { citizenship?: unknown })?.citizenship,
  ).map((item) => cleanString((item as Record<string, unknown>).country));
  const vesselFlag = cleanString(
    (entry.vesselInfo as Record<string, unknown> | undefined)?.vesselFlag,
  );

  return dedupeStrings([
    ...addressCountries,
    ...nationalityCountries,
    ...citizenshipCountries,
    vesselFlag,
  ]);
}

function parseOfacBirthDates(entry: Record<string, unknown>) {
  const items = toArray(
    (entry.dateOfBirthList as { dateOfBirthItem?: unknown; dateOfBirth?: unknown })?.dateOfBirthItem ??
      (entry.dateOfBirthList as { dateOfBirth?: unknown })?.dateOfBirth,
  );

  return dedupeStrings(
    items.map((item) =>
      cleanString(typeof item === "string" ? item : (item as Record<string, unknown>).dateOfBirth),
    ),
  );
}

function parseOfacPrograms(entry: Record<string, unknown>) {
  return dedupeStrings(
    toArray((entry.programList as { program?: unknown })?.program).map((program) =>
      cleanString(typeof program === "string" ? program : undefined),
    ),
  );
}

function parseOfacIdentifiers(entry: Record<string, unknown>) {
  const identifiers: Array<{ type: string; value: string; normalizedValue: string }> = [];

  for (const item of toArray((entry.idList as { id?: unknown })?.id)) {
    const id = item as Record<string, unknown>;
    const idType = cleanString(id.idType);
    const idNumber = cleanString(id.idNumber);

    if (!idType || !idNumber) {
      continue;
    }

    identifiers.push({
      type: idType,
      value: idNumber,
      normalizedValue: normalizeIdentifier(idNumber),
    });
  }

  const vesselInfo = (entry.vesselInfo as Record<string, unknown> | undefined) ?? {};
  const vesselFields = [
    ["Call Sign", cleanString(vesselInfo.callSign)],
    ["Vessel Flag", cleanString(vesselInfo.vesselFlag)],
    ["Vessel Owner", cleanString(vesselInfo.vesselOwner)],
    ["IMO", cleanString(vesselInfo.imoNumber)],
  ] as const;

  for (const [type, value] of vesselFields) {
    if (!value) {
      continue;
    }

    identifiers.push({
      type,
      value,
      normalizedValue: normalizeIdentifier(value),
    });
  }

  return identifiers;
}

function parseOfacXml(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: false,
    trimValues: true,
  });
  const root = parser.parse(xml).sdnList as {
    publshInformation?: Record<string, unknown>;
    sdnEntry?: Array<Record<string, unknown>> | Record<string, unknown>;
  };
  const publishedAt = publishedAtFromUnknown(root.publshInformation?.Publish_Date);
  const entries = toArray(root.sdnEntry).map((entry) => {
    const primaryName = buildOfacName(entry);
    const aliases = parseOfacAliases(entry.akaList);
    const identifiers = parseOfacIdentifiers(entry);

    return {
      externalId: cleanString(entry.uid) ?? primaryName,
      schema: cleanString(entry.sdnType) ?? "Unknown",
      primaryName,
      normalizedName: normalizeText(primaryName),
      aliases,
      normalizedAliases: dedupeStrings(aliases.map((alias) => normalizeText(alias))),
      countries: parseOfacCountries(entry),
      addresses: parseOfacAddresses(entry.addressList),
      identifiers,
      birthDates: parseOfacBirthDates(entry),
      sanctionsPrograms: parseOfacPrograms(entry),
      raw: entry,
    } satisfies PersistableSanctionsEntry;
  });

  return {
    publishedAt,
    recordCount: root.publshInformation?.Record_Count,
    entries,
  };
}

type CsvRow = Record<string, string>;

function pickField(row: CsvRow, keys: string[]) {
  const normalizedKeys = Object.keys(row).reduce<Record<string, string>>((accumulator, key) => {
    accumulator[key.toLowerCase().replace(/[^a-z0-9]+/g, "")] = key;
    return accumulator;
  }, {});

  for (const candidate of keys) {
    const key = normalizedKeys[candidate.toLowerCase().replace(/[^a-z0-9]+/g, "")];
    if (key) {
      const value = cleanString(row[key]);
      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

function pushIdentifier(
  identifiers: Array<{ type: string; value: string; normalizedValue: string }>,
  type: string,
  value: string | undefined,
) {
  if (!value) {
    return;
  }

  identifiers.push({
    type,
    value,
    normalizedValue: normalizeIdentifier(value),
  });
}

function parseEuCsv(text: string) {
  const rows = parseCsv(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as CsvRow[];

  return rows
    .map((row) => {
      const primaryName =
        pickField(row, [
          "name",
          "subject_name",
          "whole_name",
          "wholename",
          "name_alias_whole_name",
          "regulation_name",
        ]) ?? "Unnamed EU entry";
      const aliases = dedupeStrings(
        splitMultiValue(
          pickField(row, [
            "aliases",
            "alias",
            "name_aliases",
            "other_names",
          ]),
        ),
      );
      const countries = dedupeStrings(
        splitMultiValue(
          pickField(row, ["countries", "country", "nationality", "citizenship"]),
        ),
      );
      const addresses = dedupeStrings(
        splitMultiValue(pickField(row, ["addresses", "address"])),
      );
      const birthDates = dedupeStrings(
        splitMultiValue(pickField(row, ["birth_date", "date_of_birth", "dob"])),
      );
      const sanctionsPrograms = dedupeStrings(
        splitMultiValue(
          pickField(row, ["sanctions", "program_ids", "programme", "regulation"]),
        ),
      );

      const identifiers: Array<{
        type: string;
        value: string;
        normalizedValue: string;
      }> = [];
      pushIdentifier(
        identifiers,
        "Identifier",
        pickField(row, ["identifiers", "identifier"]),
      );
      pushIdentifier(
        identifiers,
        "Company Number",
        pickField(row, ["company_number", "registration_number"]),
      );
      pushIdentifier(
        identifiers,
        "Passport",
        pickField(row, ["passport_number"]),
      );
      pushIdentifier(
        identifiers,
        "National ID",
        pickField(row, ["national_id"]),
      );
      pushIdentifier(
        identifiers,
        "IMO",
        pickField(row, ["imo_number", "imo"]),
      );

      return {
        externalId:
          pickField(row, [
            "id",
            "eu_reference_number",
            "reference_number",
            "logical_id",
            "uuid",
          ]) ?? primaryName,
        schema: pickField(row, ["schema", "type", "subject_type"]) ?? "Unknown",
        primaryName,
        normalizedName: normalizeText(primaryName),
        aliases,
        normalizedAliases: dedupeStrings(aliases.map((alias) => normalizeText(alias))),
        countries,
        addresses,
        identifiers,
        birthDates,
        sanctionsPrograms,
        raw: row,
      } satisfies PersistableSanctionsEntry;
    })
    .filter((entry) => entry.normalizedName.length > 0);
}

async function fetchText(url: string, headers?: HeadersInit) {
  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}) for ${url}`);
  }

  return response.text();
}

async function resolveEuOfficialUrl() {
  if (process.env.EU_FSF_OFFICIAL_URL) {
    return process.env.EU_FSF_OFFICIAL_URL;
  }

  const metadata = await fetch(EU_METADATA_URL, { cache: "no-store" }).then((response) => {
    if (!response.ok) {
      throw new Error(`EU metadata lookup failed (${response.status}).`);
    }

    return response.json() as Promise<Record<string, unknown>>;
  });
  const distributions = (
    (metadata.result as { distributions?: Array<Record<string, unknown>> } | undefined)
      ?.distributions ?? []
  ) as Array<Record<string, unknown>>;

  for (const distribution of distributions) {
    const candidate =
      cleanString(distribution.downloadURL) ??
      cleanString(distribution.accessURL) ??
      cleanString(distribution.download_url) ??
      cleanString(distribution.access_url);

    if (candidate && candidate.toLowerCase().includes("csvfullsanctionslist")) {
      return candidate;
    }
  }

  return undefined;
}

async function tryImportEuOfficial() {
  const shouldAttemptOfficial = Boolean(
    process.env.EU_FSF_COOKIE ||
      process.env.EU_FSF_AUTHORIZATION ||
      process.env.EU_FSF_OFFICIAL_URL,
  );

  if (!shouldAttemptOfficial) {
    return null;
  }

  const url = await resolveEuOfficialUrl();

  if (!url) {
    return null;
  }

  const headers: HeadersInit = {};

  if (process.env.EU_FSF_COOKIE) {
    headers.Cookie = process.env.EU_FSF_COOKIE;
  }

  if (process.env.EU_FSF_AUTHORIZATION) {
    headers.Authorization = process.env.EU_FSF_AUTHORIZATION;
  }

  const text = await fetchText(url, headers);
  const entries = parseEuCsv(text);

  if (entries.length === 0) {
    throw new Error("EU official CSV returned zero parsable rows.");
  }

  return {
    sourceMode: "official" as const,
    url,
    label: "EU Financial Sanctions Database",
    checksum: sha256(text),
    entries,
    publishedAt: undefined,
    metadata: {
      upstream: "EU Financial Sanctions Database",
      transport: "cookie-or-authorization-backed fetch",
    },
  };
}

export async function importOfacSanctions() {
  const xml = await fetchText(OFAC_SDN_XML_URL);
  const checksum = sha256(xml);
  const parsed = parseOfacXml(xml);

  return persistSourceVersion({
    source: "ofac",
    sourceMode: "official",
    label: "OFAC SDN XML",
    url: OFAC_SDN_XML_URL,
    checksum,
    publishedAt: parsed.publishedAt,
    metadata: {
      upstream: "OFAC Sanctions List Service",
      recordCount: parsed.recordCount,
      format: "xml",
    },
    entries: parsed.entries,
  });
}

export async function importEuSanctions() {
  try {
    const official = await tryImportEuOfficial();

    if (official) {
      return persistSourceVersion({
        source: "eu",
        sourceMode: official.sourceMode,
        label: official.label,
        url: official.url,
        checksum: official.checksum,
        publishedAt: official.publishedAt,
        metadata: official.metadata,
        entries: official.entries,
      });
    }
  } catch (error) {
    console.warn("EU official import failed, falling back to public dataset.", error);
  }

  const fallbackText = await fetchText(EU_FALLBACK_URL);
  const checksum = sha256(fallbackText);
  const entries = parseEuCsv(fallbackText);

  return persistSourceVersion({
    source: "eu",
    sourceMode: "fallback",
    label: "EU Financial Sanctions Files (fallback via OpenSanctions)",
    url: EU_FALLBACK_URL,
    checksum,
    metadata: {
      upstream: "OpenSanctions EU FSF mirror",
      fallbackReason: "Official EU download endpoint requires credentialed session access.",
      format: "csv",
    },
    entries,
  });
}

async function ensureFreshSource(source: SanctionsSource) {
  const latest = await prisma.sourceVersion.findFirst({
    where: { source },
    orderBy: { fetchedAt: "desc" },
  });

  if (latest && Date.now() - latest.fetchedAt.getTime() < IMPORT_MAX_AGE_MS) {
    return latest;
  }

  if (source === "ofac") {
    return importOfacSanctions();
  }

  return importEuSanctions();
}

export async function ensureSanctionsSourceVersions() {
  const [ofac, eu] = await Promise.all([
    ensureFreshSource("ofac"),
    ensureFreshSource("eu"),
  ]);

  return [ofac, eu];
}

export async function getLatestSanctionsEntries() {
  const versions = await ensureSanctionsSourceVersions();
  const versionIds = versions.map((version) => version.id);
  const entries = await prisma.sanctionsEntry.findMany({
    where: {
      sourceVersionId: {
        in: versionIds,
      },
    },
    include: {
      sourceVersion: true,
    },
  });

  return {
    versions,
    entries,
  };
}

export function toSourceVersionSummary(version: SourceVersion) {
  return mapSourceVersion(version);
}

export type StoredSanctionsEntry = PrismaSanctionsEntry & {
  sourceVersion: SourceVersion;
};
