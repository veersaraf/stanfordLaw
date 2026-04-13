import {
  buildIdentifierVariants,
  buildNameVariants,
  cleanString,
  compactJoin,
  dedupeStrings,
  normalizeIdentifier,
  normalizeText,
  parseDateValue,
  splitMultiValue,
  toArray,
} from "@/lib/sanctions/normalize";

describe("cleanString", () => {
  it("trims and returns non-empty strings", () => {
    expect(cleanString("  hello  ")).toBe("hello");
  });

  it("returns undefined for empty, whitespace-only, or non-string values", () => {
    expect(cleanString("")).toBeUndefined();
    expect(cleanString("    ")).toBeUndefined();
    expect(cleanString(undefined)).toBeUndefined();
    expect(cleanString(null)).toBeUndefined();
    expect(cleanString(42)).toBeUndefined();
    expect(cleanString({})).toBeUndefined();
  });
});

describe("toArray", () => {
  it("wraps single values in arrays and passes arrays through", () => {
    expect(toArray("x")).toEqual(["x"]);
    expect(toArray(["x", "y"])).toEqual(["x", "y"]);
  });

  it("returns an empty array for null/undefined", () => {
    expect(toArray(undefined)).toEqual([]);
    expect(toArray(null)).toEqual([]);
  });
});

describe("normalizeText", () => {
  it("uppercases, transliterates accents, and collapses non-alphanumerics", () => {
    expect(normalizeText("Crème brûlée, LLC.")).toBe("CREME BRULEE LLC");
  });

  it("collapses multiple whitespace into a single space", () => {
    expect(normalizeText("  Alpha    Bravo  ")).toBe("ALPHA BRAVO");
  });
});

describe("normalizeIdentifier", () => {
  it("strips punctuation and uppercases alphanumerics", () => {
    expect(normalizeIdentifier("imo-1234567")).toBe("IMO1234567");
    expect(normalizeIdentifier("  ABC 123  ")).toBe("ABC123");
  });
});

describe("buildIdentifierVariants", () => {
  it("returns the normalized identifier", () => {
    expect(buildIdentifierVariants("Passport", "AB-12 34")).toEqual(["AB1234"]);
  });

  it("adds digits-only and IMO-prefixed variants for IMO identifiers", () => {
    const variants = buildIdentifierVariants("IMO", "1234567");
    expect(variants).toEqual(expect.arrayContaining(["1234567", "IMO1234567"]));
  });

  it("detects IMO-like identifiers by value prefix", () => {
    const variants = buildIdentifierVariants(undefined, "imo 7654321");
    expect(variants).toEqual(expect.arrayContaining(["IMO7654321", "7654321"]));
  });
});

describe("buildNameVariants", () => {
  it("returns the normalized name", () => {
    expect(buildNameVariants("Acme Corp")).toEqual(["ACME CORP"]);
  });

  it("strips single-token vessel prefixes when enabled", () => {
    const variants = buildNameVariants("MV Pacific Dawn", { vessel: true });
    expect(variants).toEqual(expect.arrayContaining(["MV PACIFIC DAWN", "PACIFIC DAWN"]));
  });

  it("strips multi-token vessel prefixes when enabled", () => {
    const variants = buildNameVariants("Motor Vessel Northern Light", { vessel: true });
    expect(variants).toEqual(
      expect.arrayContaining(["MOTOR VESSEL NORTHERN LIGHT", "NORTHERN LIGHT"]),
    );
  });

  it("does not strip prefixes when the vessel flag is off", () => {
    expect(buildNameVariants("MV Pacific Dawn")).toEqual(["MV PACIFIC DAWN"]);
  });
});

describe("splitMultiValue", () => {
  it("splits on ; and | and trims segments", () => {
    expect(splitMultiValue("alpha; bravo| charlie")).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("returns an empty array for undefined", () => {
    expect(splitMultiValue(undefined)).toEqual([]);
  });
});

describe("dedupeStrings", () => {
  it("removes duplicates and falsy values", () => {
    expect(dedupeStrings(["a", "b", "a", undefined, ""])).toEqual(["a", "b"]);
  });
});

describe("compactJoin", () => {
  it("joins truthy values with the given separator", () => {
    expect(compactJoin(["a", undefined, "b", ""], " / ")).toBe("a / b");
  });
});

describe("parseDateValue", () => {
  it("parses ISO dates", () => {
    const parsed = parseDateValue("2025-01-15T00:00:00Z");
    expect(parsed?.toISOString()).toBe("2025-01-15T00:00:00.000Z");
  });

  it("returns undefined for invalid or missing values", () => {
    expect(parseDateValue("not a date")).toBeUndefined();
    expect(parseDateValue(undefined)).toBeUndefined();
  });
});
