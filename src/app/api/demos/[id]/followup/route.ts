import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: Params) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const note = (body as { note?: unknown }).note;
  if (typeof note !== "string" || !note.trim()) {
    return NextResponse.json({ error: "Write a follow-up note first" }, { status: 400 });
  }

  const demo = await prisma.demo.findUnique({ where: { id } });
  if (!demo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.demo.update({ where: { id }, data: { followUpNote: note.trim() } });
  await logAudit(user.id, "DEMO_FOLLOWUP", "Demo", id, note.trim().slice(0, 200));
  return NextResponse.json({ ok: true });
}
