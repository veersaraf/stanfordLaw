import {
  formatDateTime,
  formatMode,
  formatSeverityLabel,
  formatStepStatus,
} from "@/lib/format";

describe("formatMode", () => {
  it("returns human labels for every check mode", () => {
    expect(formatMode("vessel")).toBe("Vessel Transaction");
    expect(formatMode("entity")).toBe("Entity / Individual");
    expect(formatMode("pdf")).toBe("PDF Intake");
  });
});

describe("formatSeverityLabel", () => {
  it("returns human labels for each severity", () => {
    expect(formatSeverityLabel("clear")).toBe("Clear");
    expect(formatSeverityLabel("watch")).toBe("Watch");
    expect(formatSeverityLabel("high")).toBe("High Risk");
  });
});

describe("formatStepStatus", () => {
  it("returns human labels for each pipeline step status", () => {
    expect(formatStepStatus("complete")).toBe("Complete");
    expect(formatStepStatus("attention")).toBe("Attention");
    expect(formatStepStatus("pending")).toBe("Pending");
    expect(formatStepStatus("not_applicable")).toBe("N/A");
  });
});

describe("formatDateTime", () => {
  it("produces a non-empty string for valid ISO input", () => {
    const output = formatDateTime("2026-04-12T13:45:00Z");
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });
});
