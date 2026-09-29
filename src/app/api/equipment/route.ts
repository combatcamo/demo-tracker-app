import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const HOLDER_SELECT = {
  id: true,
  status: true,
  checkoutDate: true,
  expectedReturnDate: true,
  customerCompany: true,
  rep: { select: { name: true } },
} as const;

export async function GET() {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const units = await prisma.equipmentUnit.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      demos: {
        where: { status: { in: ["SCHEDULED", "OUT_ON_DEMO"] } },
        orderBy: { checkoutDate: "asc" },
        take: 1,
        select: HOLDER_SELECT,
      },
    },
  });
  return NextResponse.json({ units });
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
  const { name, category, serial, notes } = body as {
    name?: unknown;
    category?: unknown;
    serial?: unknown;
    notes?: unknown;
  };
  if (typeof name !== "string" || !name.trim())
    return NextResponse.json({ error: "Unit name is required" }, { status: 400 });
  if (typeof category !== "string" || !category.trim())
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  if (typeof serial !== "string" || !serial.trim())
    return NextResponse.json({ error: "Serial number is required" }, { status: 400 });

  const dup = await prisma.equipmentUnit.findUnique({ where: { serial: serial.trim() } });
  if (dup) return NextResponse.json({ error: "That serial number already exists" }, { status: 409 });

  const unit = await prisma.equipmentUnit.create({
    data: {
      name: name.trim(),
      category: category.trim(),
      serial: serial.trim(),
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    },
  });
  await logAudit(user.id, "UNIT_CREATE", "EquipmentUnit", unit.id, `${unit.name} (${unit.serial})`);
  return NextResponse.json({ unit }, { status: 201 });
}
