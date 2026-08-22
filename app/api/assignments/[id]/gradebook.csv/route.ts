import { gradebookCsv } from "@/app/actions/gradebook";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let csv: string;
  try {
    csv = await gradebookCsv(id);
  } catch {
    return new Response("Not authorized", { status: 401 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="frq-gradebook-${id.slice(0, 8)}.csv"`,
    },
  });
}
