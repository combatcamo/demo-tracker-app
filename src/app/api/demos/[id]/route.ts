import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { findBookingConflict, syncUnitStatus } from "@/lib/demos";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const demo = await prisma.demo.findUnique({
    where: { id },
    include: {
      unit: true,
      rep: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      photos: { select: { id: true, kind: true, mimeType: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!demo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const audit = await prisma.auditLog.findMany({
    where: { entityType: "Demo", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true } } },
  });
  return NextResponse.json({ demo, audit });
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const demo = await prisma.demo.findUnique({ where: { id } });
  if (!demo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (demo.status === "COMPLETED" || demo.status === "CANCELLED") {
    return NextResponse.json({ error: "Completed or cancelled demos cannot be edited" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const newUnitId = typeof b.unitId === "string" && b.unitId.trim() ? b.unitId.trim() : demo.unitId;
  const newFrom = typeof b.checkoutDate === "string" ? new Date(b.checkoutDate) : demo.checkoutDate;
  const newTo = typeof b.expectedReturnDate === "string" ? new Date(b.expectedReturnDate) : demo.expectedReturnDate;
  if (isNaN(newFrom.getTime()) || isNaN(newTo.getTime()))
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  if (newTo < newFrom)
    return NextResponse.json({ error: "Return date cannot be before checkout date" }, { status: 400 });

  const unit = await prisma.equipmentUnit.findUnique({ where: { id: newUnitId } });
  if (!unit) return NextResponse.json({ error: "Selected unit is not valid" }, { status: 400 });
  if (unit.status === "IN_SERVICE" && newUnitId !== demo.unitId)
    return NextResponse.json({ error: `${unit.name} is marked in-service` }, { status: 409 });

  const conflict = await findBookingConflict(newUnitId, newFrom, newTo, id);
  if (conflict) {
    return NextResponse.json(
      { error: `Double-booking: ${unit.name} is already out ${conflict.checkoutDate.toLocaleDateString()} – ${conflict.expectedReturnDate.toLocaleDateString()}` },
      { status: 409 }
    );
  }

  if (typeof b.repId === "string" && b.repId.trim()) {
    const rep = await prisma.user.findUnique({ where: { id: b.repId.trim() } });
    if (!rep || !rep.active) return NextResponse.json({ error: "Selected rep is not valid" }, { status: 400 });
  }

  const data: Prisma.DemoUpdateInput = {};
  const setStr = (key: "customerCompany" | "contactName" | "contactPhone" | "deliveryAddress" | "outNotes" | "hoursOut", nullable: boolean) => {
    const v = b[key];
    if (typeof v === "string") {
      const t = v.trim();
      (data as Record<string, unknown>)[key] = t === "" && nullable ? null : t;
    }
  };
  setStr("customerCompany", false);
  setStr("contactName", false);
  setStr("contactPhone", false);
  setStr("deliveryAddress", true);
  setStr("outNotes", true);
  setStr("hoursOut", false);
  if (typeof b.pickupAtBranch === "boolean") data.pickupAtBranch = b.pickupAtBranch;
  if (typeof b.deliverToCustomer === "boolean") data.deliverToCustomer = b.deliverToCustomer;
  if (typeof b.customerReturnsToBranch === "boolean") data.customerReturnsToBranch = b.customerReturnsToBranch;
  if (typeof b.customerIdVerified === "boolean") data.customerIdVerified = b.customerIdVerified;
  if (typeof b.includeResponsibilityRecord === "boolean") data.includeResponsibilityRecord = b.includeResponsibilityRecord;
  if (typeof b.reminderDaysBefore === "number" && b.reminderDaysBefore >= 0)
    data.reminderDaysBefore = Math.floor(b.reminderDaysBefore);
  if (typeof b.conditionOut === "string") {
    const c = b.conditionOut.toUpperCase();
    if (c === "NEW" || c === "USED" || c === "DAMAGED" || c === "FOR_SALE") data.conditionOut = c;
  }
  data.checkoutDate = newFrom;
  data.expectedReturnDate = newTo;
  if (newUnitId !== demo.unitId) data.unit = { connect: { id: newUnitId } };
  if (typeof b.repId === "string" && b.repId.trim() && b.repId.trim() !== demo.repId)
    data.rep = { connect: { id: b.repId.trim() } };

  const oldUnitId = demo.unitId;
  const updated = await prisma.demo.update({ where: { id }, data });
  await syncUnitStatus(oldUnitId);
  if (newUnitId !== oldUnitId) await syncUnitStatus(newUnitId);
  await logAudit(user.id, "DEMO_UPDATE", "Demo", id, `Edited demo for ${updated.customerCompany}`);
  return NextResponse.json({ ok: true });
}
