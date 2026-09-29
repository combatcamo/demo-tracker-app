import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { UnitStatus } from "@prisma/client";

const VALID_STATUSES: UnitStatus[] = ["AVAILABLE", "OUT_ON_DEMO", "SCHEDULED", "IN_SERVICE"];

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
  const { name, category, serial, notes, status } = body as {
    name?: unknown;
    category?: unknown;
    serial?: unknown;
    notes?: unknown;
    status?: unknown;
  };

  const existing = await prisma.equipmentUnit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: { name?: string; category?: string; serial?: string; notes?: string | null; status?: UnitStatus } = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof category === "string" && category.trim()) data.category = category.trim();
  if (typeof serial === "string" && serial.trim() && serial.trim() !== existing.serial) {
    const dup = await prisma.equipmentUnit.findUnique({ where: { serial: serial.trim() } });
    if (dup) return NextResponse.json({ error: "That serial number already exists" }, { status: 409 });
    data.serial = serial.trim();
  }
  if (typeof notes === "string") data.notes = notes.trim() ? notes.trim() : null;
  if (typeof status === "string") {
    if (!VALID_STATUSES.includes(status as UnitStatus))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    data.status = status as UnitStatus;
  }

  const unit = await prisma.equipmentUnit.update({ where: { id }, data });
  await logAudit(user.id, "UNIT_UPDATE", "EquipmentUnit", unit.id, `${unit.name}: updated`);
  return NextResponse.json({ unit });
}
