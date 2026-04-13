import { entityFormSchema, isValidImoNumber, vesselFormSchema } from "@/lib/checks/schema";

describe("isValidImoNumber", () => {
  it("accepts exactly 7 digits", () => {
    expect(isValidImoNumber("1234567")).toBe(true);
  });

  it("accepts empty strings (field is optional)", () => {
    expect(isValidImoNumber("")).toBe(true);
    expect(isValidImoNumber("   ")).toBe(true);
  });

  it("rejects short, long, and non-digit values", () => {
    expect(isValidImoNumber("12345")).toBe(false);
    expect(isValidImoNumber("12345678")).toBe(false);
    expect(isValidImoNumber("abc4567")).toBe(false);
    expect(isValidImoNumber("123-456")).toBe(false);
  });
});

describe("vesselFormSchema", () => {
  it("accepts a vessel with a valid 7-digit IMO number", () => {
    const result = vesselFormSchema.safeParse({
      vesselName: "PACIFIC DAWN",
      imoNumber: "1234567",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-7-digit IMO number", () => {
    const result = vesselFormSchema.safeParse({
      vesselName: "PACIFIC DAWN",
      imoNumber: "12345",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => issue.path.join("."));
      expect(issues).toContain("imoNumber");
    }
  });

  it("requires either a vessel name or an IMO number", () => {
    const result = vesselFormSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toEqual(expect.arrayContaining(["vesselName", "imoNumber"]));
    }
  });

  it("accepts a vessel identified only by IMO", () => {
    const result = vesselFormSchema.safeParse({ imoNumber: "7654321" });
    expect(result.success).toBe(true);
  });
});

describe("entityFormSchema", () => {
  it("requires a subject name", () => {
    const result = entityFormSchema.safeParse({
      subjectName: "",
      subjectType: "company",
    });
    expect(result.success).toBe(false);
  });

  it("requires subjectType to be 'company' or 'individual'", () => {
    const result = entityFormSchema.safeParse({
      subjectName: "Acme",
      // @ts-expect-error testing invalid enum value at runtime
      subjectType: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid entity submission", () => {
    const result = entityFormSchema.safeParse({
      subjectName: "Acme Holdings",
      subjectType: "company",
      nationality: "Cyprus",
    });
    expect(result.success).toBe(true);
  });
});
