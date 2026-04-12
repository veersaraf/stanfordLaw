import type {
  CheckSubmission,
  VesselIntelSyntheticScenario,
} from "@/lib/checks/types";
import { buildNameVariants } from "@/lib/sanctions/normalize";

type DemoVessel = {
  name: string;
  imoNumber: string;
  aliases?: string[];
};

const luminosa: DemoVessel = {
  name: "Luminosa",
  imoNumber: "9256016",
};

const samsun: DemoVessel = {
  name: "Samsun",
  imoNumber: "9436006",
  aliases: ["Samsung"],
};

function vesselMatches(
  submission: CheckSubmission,
  vessel: DemoVessel,
) {
  const submittedImo =
    submission.vessel?.imoNumber ?? submission.pdf?.parsedFields.imoNumber;
  const submittedName =
    submission.vessel?.vesselName ?? submission.pdf?.parsedFields.vesselName;

  if (submittedImo === vessel.imoNumber) {
    return true;
  }

  if (!submittedName) {
    return false;
  }

  const variants = buildNameVariants(submittedName, { vessel: true });
  const targetVariants = [
    vessel.name,
    ...(vessel.aliases ?? []),
  ].flatMap((name) => buildNameVariants(name, { vessel: true }));

  return variants.some((variant) => targetVariants.includes(variant));
}

function buildArcticStsScenario(
  primary: DemoVessel,
  counterparty: DemoVessel,
): VesselIntelSyntheticScenario {
  return {
    isSynthetic: true,
    label: "Scenario Analysis",
    title: "Arctic STS Sequence",
    summary:
      "Illustrative vessel-intelligence scenario showing a same-course rendezvous, AIS dark activity, and a reappearance pattern consistent with a staged STS narrative for presentation purposes.",
    legalNotice:
      "This vessel-intelligence sequence is an illustrative scenario prepared for presentation. It is not derived from commercial AIS or independently verified vessel movement evidence.",
    counterparties: [
      {
        vesselName: primary.name,
        imoNumber: primary.imoNumber,
        role: "Primary screened vessel",
        note: "Seed vessel for the demo narrative.",
      },
      {
        vesselName: counterparty.name,
        imoNumber: counterparty.imoNumber,
        role: "Scenario counterparty vessel",
        note: "Inserted as a counterpart to show a suspicious STS pattern. Accepts the alias Samsung in intake for presentation resilience.",
      },
    ],
    timeline: [
      {
        timestamp: "2026-02-17 04:10 UTC",
        vesselName: primary.name,
        imoNumber: primary.imoNumber,
        area: "Laptev Sea western approach",
        course: "082° E",
        speedKnots: "11.8",
        aisStatus: "transmitting",
        latitude: 77.85,
        longitude: 110.4,
        detail:
          `${primary.name} and ${counterparty.name} are both shown on broadly parallel eastbound tracks inside the Arctic corridor.`,
      },
      {
        timestamp: "2026-02-17 04:40 UTC",
        vesselName: counterparty.name,
        imoNumber: counterparty.imoNumber,
        area: "Laptev Sea western approach",
        course: "079° E",
        speedKnots: "11.1",
        aisStatus: "transmitting",
        latitude: 77.73,
        longitude: 111.9,
        detail:
          `${counterparty.name} closes the gap and stabilizes on a near-matching course and speed profile with ${primary.name}.`,
      },
      {
        timestamp: "2026-02-17 05:05 UTC",
        vesselName: primary.name,
        imoNumber: primary.imoNumber,
        area: "North of Severnaya Zemlya waypoint",
        course: "081° E",
        speedKnots: "3.2",
        aisStatus: "dark",
        latitude: 78.96,
        longitude: 101.7,
        detail:
          `${primary.name} stops transmitting AIS while the plotted track suggests a coordinated speed reduction at the convergence point.`,
      },
      {
        timestamp: "2026-02-17 05:20 UTC",
        vesselName: counterparty.name,
        imoNumber: counterparty.imoNumber,
        area: "North of Severnaya Zemlya waypoint",
        course: "078° E",
        speedKnots: "2.7",
        aisStatus: "transmitting",
        latitude: 78.88,
        longitude: 101.2,
        detail:
          `${counterparty.name} remains visible with a low-speed drift profile at the same waypoint during the ${primary.name} AIS gap.`,
      },
      {
        timestamp: "2026-02-17 08:55 UTC",
        vesselName: primary.name,
        imoNumber: primary.imoNumber,
        area: "Kara Sea northeastern exit",
        course: "247° WSW",
        speedKnots: "12.5",
        aisStatus: "reappeared",
        latitude: 76.92,
        longitude: 82.4,
        detail:
          `${primary.name} reappears several hours later on an opposite-direction outbound track inconsistent with the last transmitted eastbound vector.`,
      },
      {
        timestamp: "2026-02-17 09:15 UTC",
        vesselName: counterparty.name,
        imoNumber: counterparty.imoNumber,
        area: "Kara Sea northeastern exit",
        course: "245° WSW",
        speedKnots: "11.9",
        aisStatus: "transmitting",
        latitude: 76.81,
        longitude: 83.1,
        detail:
          `${counterparty.name} is then shown departing on a similar outbound heading, completing the staged STS-style sequence.`,
      },
    ],
    stsAssessment: {
      area: "Arctic corridor between the Laptev Sea approach and Kara Sea exit",
      window: "2026-02-17 05:05 UTC to 2026-02-17 08:55 UTC",
      narrative:
        `${primary.name} and ${counterparty.name} are shown converging on a common heading, after which ${primary.name} enters an AIS-dark period and later reappears on an opposing outbound route. In this illustrative scenario, that sequence is presented as a staged indicator of a suspected ship-to-ship transfer in Arctic waters.`,
      confidence: "demo",
    },
  };
}

export function buildSyntheticVesselScenario(submission: CheckSubmission) {
  if (vesselMatches(submission, luminosa)) {
    return buildArcticStsScenario(luminosa, samsun);
  }

  if (vesselMatches(submission, samsun)) {
    return buildArcticStsScenario(samsun, luminosa);
  }

  return undefined;
}
