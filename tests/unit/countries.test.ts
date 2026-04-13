import { COUNTRIES, findCountryByName, flagEmoji, searchCountries } from "@/lib/countries";

describe("countries", () => {
  it("includes a wide set of ISO 3166-1 entries with unique codes", () => {
    expect(COUNTRIES.length).toBeGreaterThan(200);
    const codes = new Set(COUNTRIES.map((country) => country.code));
    expect(codes.size).toBe(COUNTRIES.length);
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.name.length).toBeGreaterThan(0);
    }
  });

  it("builds emoji flags from regional indicator pairs", () => {
    expect(flagEmoji("US")).toBe("\u{1F1FA}\u{1F1F8}");
    expect(flagEmoji("mh")).toBe("\u{1F1F2}\u{1F1ED}");
    expect(flagEmoji("xx1")).toBe("");
    expect(flagEmoji("")).toBe("");
  });

  it("looks up countries by exact name, case-insensitive", () => {
    expect(findCountryByName("Marshall Islands")?.code).toBe("MH");
    expect(findCountryByName("  marshall islands ")?.code).toBe("MH");
    expect(findCountryByName("Not a real place")).toBeUndefined();
    expect(findCountryByName("")).toBeUndefined();
  });

  it("ranks prefix matches ahead of substring matches and respects the limit", () => {
    const results = searchCountries("uni", 5);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results[0].name.toLowerCase().startsWith("uni")).toBe(true);
    expect(results.some((country) => country.code === "GB")).toBe(true);
    expect(results.some((country) => country.code === "US")).toBe(true);
  });

  it("returns a leading slice when the query is empty", () => {
    const results = searchCountries("", 8);
    expect(results).toHaveLength(8);
    expect(results[0]).toEqual(COUNTRIES[0]);
  });
});
