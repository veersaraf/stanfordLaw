jest.mock("@/lib/storage/fs-store", () => ({
  writeBuffer: jest.fn().mockResolvedValue("/tmp/fake"),
  getStorageRoot: () => "/tmp",
}));

jest.mock("pdf-parse", () => ({
  PDFParse: class {
    async getText() {
      return { text: "Vessel Name: PACIFIC DAWN\nIMO: 1234567\nOwner: Acme Holdings" };
    }
    async destroy() {}
  },
}));

import { buildSubmissionFromFormData } from "@/lib/checks/parser";

function formWith(entries: Record<string, string | File>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.append(key, value as Blob | string);
  }
  return fd;
}

describe("buildSubmissionFromFormData (vessel)", () => {
  it("builds a vessel submission from valid form data", async () => {
    const result = await buildSubmissionFromFormData(
      formWith({
        mode: "vessel",
        vesselName: "PACIFIC DAWN",
        imoNumber: "1234567",
        flag: "Panama",
        ownerName: "Acme Holdings",
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.submission.mode).toBe("vessel");
      expect(result.submission.vessel?.vesselName).toBe("PACIFIC DAWN");
      expect(result.submission.vessel?.imoNumber).toBe("1234567");
      expect(result.submission.subjects).toEqual(
        expect.arrayContaining(["PACIFIC DAWN", "1234567", "Acme Holdings"]),
      );
      expect(result.submission.title.length).toBeGreaterThan(0);
    }
  });

  it("returns a failure state when neither vessel name nor IMO is supplied", async () => {
    const result = await buildSubmissionFromFormData(formWith({ mode: "vessel" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state.mode).toBe("vessel");
      expect(result.state.fieldErrors).toBeDefined();
    }
  });

  it("rejects an IMO number that is not exactly 7 digits", async () => {
    const result = await buildSubmissionFromFormData(
      formWith({ mode: "vessel", vesselName: "Foo", imoNumber: "12345" }),
    );
    expect(result.success).toBe(false);
  });
});

describe("buildSubmissionFromFormData (entity)", () => {
  it("builds an entity submission with parsed aliases", async () => {
    const result = await buildSubmissionFromFormData(
      formWith({
        mode: "entity",
        subjectName: "Acme Holdings",
        subjectType: "company",
        aliases: "Acme Hold Co, Acme Group",
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.submission.entity?.aliases).toEqual(["Acme Hold Co", "Acme Group"]);
    }
  });

  it("rejects an empty subject name", async () => {
    const result = await buildSubmissionFromFormData(
      formWith({ mode: "entity", subjectType: "company" }),
    );
    expect(result.success).toBe(false);
  });
});

describe("buildSubmissionFromFormData (pdf)", () => {
  it("rejects a missing PDF file", async () => {
    const result = await buildSubmissionFromFormData(formWith({ mode: "pdf" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state.fieldErrors?.pdfFile).toBeDefined();
    }
  });

  it("rejects a non-PDF file extension", async () => {
    const file = new File(["hello"], "contract.txt", { type: "text/plain" });
    const result = await buildSubmissionFromFormData(formWith({ mode: "pdf", pdfFile: file }));
    expect(result.success).toBe(false);
  });

  it("accepts a valid PDF upload and extracts fields", async () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "intake.pdf", {
      type: "application/pdf",
    });
    const result = await buildSubmissionFromFormData(formWith({ mode: "pdf", pdfFile: file }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.submission.pdf?.fileName).toBe("intake.pdf");
      expect(result.submission.pdf?.parsedFields.vesselName).toBe("PACIFIC DAWN");
      expect(result.submission.pdf?.parsedFields.imoNumber).toBe("1234567");
      expect(result.submission.pdf?.parsedFields.ownerName).toBe("Acme Holdings");
    }
  });
});
