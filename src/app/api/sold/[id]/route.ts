import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const existing = await prisma.soldRecord.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: {
    description?: string;
    customerCompany?: string;
    amount?: Prisma.Decimal | null;
    soldDate?: Date;
    invoiced?: boolean;
    notes?: string | null;
  } = {};
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  if (typeof b.description === "string" && str(b.description)) data.description = str(b.description);
  if (typeof b.customerCompany === "string" && str(b.customerCompany)) data.customerCompany = str(b.customerCompany);
  if (typeof b.soldDate === "string") {
    const d = new Date(b.soldDate);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid sold date" }, { status: 400 });
    data.soldDate = d;
  }
  if (typeof b.invoiced === "boolean") data.invoiced = b.invoiced;
  if (typeof b.notes === "string") data.notes = str(b.notes) || null;
  if (b.amount !== undefined) {
    if (b.amount === null || str(b.amount) === "") data.amount = null;
    else {
      const n = Number(b.amount);
      if (!isFinite(n) || n < 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      data.amount = new Prisma.Decimal(n.toFixed(2));
    }
  }

  const record = await prisma.soldRecord.update({ where: { id }, data });
  const action = typeof b.invoiced === "boolean" && b.invoiced && !existing.invoiced ? "SOLD_INVOICED" : "SOLD_UPDATE";
  await logAudit(user.id, action, "SoldRecord", id, `${record.description} — ${record.customerCompany}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Params) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const existing = await prisma.soldRecord.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.soldRecord.delete({ where: { id } });
  await logAudit(user.id, "SOLD_DELETE", "SoldRecord", id, `${existing.description} — ${existing.customerCompany}`);
  return NextResponse.json({ ok: true });
}
