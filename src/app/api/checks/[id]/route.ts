import { getCheck } from "@/lib/checks/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const check = await getCheck(id);

  if (!check) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: check });
}
