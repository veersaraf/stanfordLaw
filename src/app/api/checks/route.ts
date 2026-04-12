import { listCheckSummaries } from "@/lib/checks/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = await listCheckSummaries();
  return Response.json({ data: checks });
}
