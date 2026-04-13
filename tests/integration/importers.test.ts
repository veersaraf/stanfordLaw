const persisted: Array<Record<string, unknown>> = [];

jest.mock("@/lib/db", () => ({
  prisma: {
    sourceVersion: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({
        id: "sv-generated",
        ...data,
        fetchedAt: new Date(),
      })),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    sanctionsEntry: {
      createMany: jest.fn().mockImplementation(async ({ data }) => {
        persisted.push(...data);
        return { count: data.length };
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation(async (callback: (tx: unknown) => unknown) => {
      const tx = {
        sourceVersion: {
          create: jest.fn().mockImplementation(({ data }) => ({
            id: "sv-generated",
            ...data,
          })),
        },
        sanctionsEntry: {
          createMany: jest.fn().mockImplementation(async ({ data }) => {
            persisted.push(...data);
            return { count: data.length };
          }),
        },
      };
      return callback(tx);
    }),
  },
}));

import { importOfacSanctions, importEuSanctions } from "@/lib/sanctions/importers";

const OFAC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sdnList>
  <publshInformation>
    <Publish_Date>2026-04-01</Publish_Date>
    <Record_Count>1</Record_Count>
  </publshInformation>
  <sdnEntry>
    <uid>12345</uid>
    <sdnType>Vessel</sdnType>
    <lastName>PACIFIC DAWN</lastName>
    <vesselInfo>
      <imoNumber>1234567</imoNumber>
      <callSign>ABCD</callSign>
      <vesselFlag>Panama</vesselFlag>
    </vesselInfo>
    <programList>
      <program>IFSR</program>
    </programList>
  </sdnEntry>
</sdnList>`;

const EU_CSV = `Logical_Id,Name,Aliases,Countries,IMO_Number,Regulation\n1001,Acme Shipping LLC,Acme Hold,Panama,,EU 269/2014\n1002,VESSEL NORTHERN LIGHT,,,7654321,EU 269/2014\n`;

describe("importOfacSanctions", () => {
  beforeEach(() => {
    persisted.length = 0;
  });

  it("parses OFAC XML and persists normalized entries with a provenance row", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(OFAC_XML, { status: 200 }));

    const version = await importOfacSanctions();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("sanctionslistservice.ofac.treas.gov"),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(version.source).toBe("ofac");
    expect(version.sourceMode).toBe("official");
    expect(persisted).toHaveLength(1);
    const [entry] = persisted as Array<{
      primaryName: string;
      normalizedName: string;
      identifiers: Array<{ type: string; value: string; normalizedValue: string }>;
      schema: string;
    }>;
    expect(entry.primaryName).toBe("PACIFIC DAWN");
    expect(entry.normalizedName).toBe("PACIFIC DAWN");
    expect(entry.schema).toBe("Vessel");
    expect(entry.identifiers.some((identifier) => identifier.type === "IMO" && identifier.value === "1234567")).toBe(true);

    fetchMock.mockRestore();
  });
});

describe("importEuSanctions", () => {
  beforeEach(() => {
    persisted.length = 0;
    delete process.env.EU_FSF_COOKIE;
    delete process.env.EU_FSF_AUTHORIZATION;
    delete process.env.EU_FSF_OFFICIAL_URL;
  });

  it("falls back to the public dataset when no official credentials are provided", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(EU_CSV, { status: 200 }));

    const version = await importEuSanctions();

    expect(version.source).toBe("eu");
    expect(version.sourceMode).toBe("fallback");
    expect(persisted.length).toBe(2);
    const names = (persisted as Array<{ primaryName: string }>).map((entry) => entry.primaryName);
    expect(names).toEqual(expect.arrayContaining(["Acme Shipping LLC", "VESSEL NORTHERN LIGHT"]));

    fetchMock.mockRestore();
  });
});
