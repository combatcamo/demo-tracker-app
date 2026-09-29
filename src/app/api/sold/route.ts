import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const { searchParams } = new URL(req.url);
  const openOnly = searchParams.get("open") === "1";
  const records = await prisma.soldRecord.findMany({
    where: openOnly ? { invoiced: false } : {},
    orderBy: { soldDate: "desc" },
    take: 200,
    include: { createdBy: { select: { name: true } } },
  });
  return NextResponse.json({
    records: records.map((r) => ({ ...r, amount: r.amount ? r.amount.toString() : null })),
  });
}

export async function POST(req: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const description = str(b.description);
  const customerCompany = str(b.customerCompany);
  if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });
  if (!customerCompany) return NextResponse.json({ error: "Customer is required" }, { status: 400 });
  const soldDate = new Date(str(b.soldDate));
  if (isNaN(soldDate.getTime())) return NextResponse.json({ error: "Sold date is required" }, { status: 400 });

  let amount: Prisma.Decimal | null = null;
  if (b.amount !== undefined && b.amount !== null && str(b.amount) !== "") {
    const n = Number(b.amount);
    if (!isFinite(n) || n < 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    amount = new Prisma.Decimal(n.toFixed(2));
  }

  const record = await prisma.soldRecord.create({
    data: {
      description,
      customerCompany,
      amount,
      soldDate,
      notes: str(b.notes) || null,
      createdById: user.id,
    },
  });
  await logAudit(user.id, "SOLD_CREATE", "SoldRecord", record.id, `${description} — ${customerCompany}`);
  return NextResponse.json({ record: { ...record, amount: record.amount?.toString() ?? null } }, { status: 201 });
}
