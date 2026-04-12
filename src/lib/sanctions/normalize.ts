import { transliterate } from "transliteration";

export function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toArray<T>(value: T | T[] | undefined | null) {
  if (value == null) {
    return [] as T[];
  }

  return Array.isArray(value) ? value : [value];
}

export function normalizeText(value: string) {
  return transliterate(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeIdentifier(value: string) {
  return transliterate(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function buildIdentifierVariants(type: string | undefined, value: string) {
  const normalized = normalizeIdentifier(value);
  const variants = new Set<string>();

  if (normalized.length > 0) {
    variants.add(normalized);
  }

  const digitsOnly = normalized.replace(/[^0-9]/g, "");
  const upperType = normalizeText(type ?? "");
  const isImoLike =
    upperType.includes("IMO") ||
    upperType.includes("VESSEL REGISTRATION IDENTIFICATION") ||
    normalized.startsWith("IMO");

  if (isImoLike && digitsOnly.length > 0) {
    variants.add(digitsOnly);
    variants.add(`IMO${digitsOnly}`);
  }

  return [...variants];
}

const vesselPrefixes = new Set([
  "B",
  "M",
  "MT",
  "M T",
  "MV",
  "M V",
  "MOTOR VESSEL",
  "MOTOR TANKER",
  "TANKER",
]);

export function buildNameVariants(value: string, options?: { vessel?: boolean }) {
  const normalized = normalizeText(value);
  const variants = new Set<string>();

  if (normalized.length > 0) {
    variants.add(normalized);
  }

  if (options?.vessel) {
    const tokens = normalized.split(" ").filter(Boolean);

    if (tokens.length > 1) {
      const joinedPrefix = tokens.slice(0, 2).join(" ");

      if (vesselPrefixes.has(tokens[0])) {
        variants.add(tokens.slice(1).join(" "));
      }

      if (vesselPrefixes.has(joinedPrefix)) {
        variants.add(tokens.slice(2).join(" "));
      }
    }
  }

  return [...variants].filter(Boolean);
}

export function splitMultiValue(value: string | undefined) {
  if (!value) {
    return [] as string[];
  }

  return value
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function dedupeStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.length > 0)))];
}

export function compactJoin(values: Array<string | undefined>, separator = ", ") {
  return values.filter(Boolean).join(separator).trim();
}

export function parseDateValue(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
