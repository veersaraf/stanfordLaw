import { prisma } from "@/lib/db";
import { ensureSanctionsSourceVersions } from "@/lib/sanctions/importers";

async function main() {
  const versions = await ensureSanctionsSourceVersions();

  for (const version of versions) {
    console.log(
      `${version.source.toUpperCase()} ${version.sourceMode} | ${version.entryCount} entries | ${version.fetchedAt.toISOString()} | ${version.checksum.slice(0, 12)}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
