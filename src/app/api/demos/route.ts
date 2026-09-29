import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  findBookingConflict,
  syncUnitStatus,
  startOfToday,
  isOverdue,
} from "@/lib/demos";
import { parseDataUrl, MAX_PHOTO_BYTES, MAX_SIGNATURE_BYTES } from "@/lib/photos";
import type { ConditionOut, DemoStatus } from "@prisma/client";

const VALID_CONDITIONS: ConditionOut[] = ["NEW", "USED", "DAMAGED", "FOR_SALE"];

interface PhotoInput {
  dataUrl?: unknown;
}

function asPhotos(input: unknown): { bytes: Buffer<ArrayBuffer>; mimeType: string }[] {
  if (!Array.isArray(input)) return [];
  return input.map((p) => {
    const { dataUrl } = (p ?? {}) as PhotoInput;
    if (typeof dataUrl !== "string") throw new Error("Invalid photo data");
    return parseDataUrl(dataUrl, MAX_PHOTO_BYTES);
  });
}

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const statusParam = searchParams.get("status")?.trim() ?? "";
  const status = ["SCHEDULED", "OUT_ON_DEMO", "COMPLETED", "CANCELLED"].includes(statusParam)
    ? (statusParam as DemoStatus)
    : undefined;

  const demos = await prisma.demo.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { customerCompany: { contains: q, mode: "insensitive" } },
              { contactName: { contains: q, mode: "insensitive" } },
              { contactPhone: { contains: q, mode: "insensitive" } },
              { unit: { serial: { contains: q, mode: "insensitive" } } },
              { unit: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { checkoutDate: "desc" },
    take: 200,
    include: {
      unit: { select: { id: true, name: true, serial: true, category: true } },
      rep: { select: { id: true, name: true } },
      photos: { select: { id: true, kind: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  const today = startOfToday();
  const shaped = demos.map((d) => ({
    id: d.id,
    status: d.status,
    customerCompany: d.customerCompany,
    contactName: d.contactName,
    contactPhone: d.contactPhone,
    checkoutDate: d.checkoutDate,
    expectedReturnDate: d.expectedReturnDate,
    overdue: isOverdue(d.status, d.expectedReturnDate),
    dueToday:
      d.status === "OUT_ON_DEMO" &&
      d.expectedReturnDate >= today &&
      d.expectedReturnDate < new Date(today.getTime() + 24 * 60 * 60 * 1000),
    unit: d.unit,
    rep: d.rep,
    firstPhotoId: d.photos[0]?.id ?? null,
  }));
  return NextResponse.json({ demos: shaped });
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
  const repId = str(b.repId);
  const customerCompany = str(b.customerCompany);
  const contactName = str(b.contactName);
  const contactPhone = str(b.contactPhone);
  const unitId = str(b.unitId);
  const hoursOut = str(b.hoursOut);
  const conditionOut = str(b.conditionOut).toUpperCase() as ConditionOut;

  if (!repId) return NextResponse.json({ error: "Select a rep" }, { status: 400 });
  if (!customerCompany) return NextResponse.json({ error: "Customer company is required" }, { status: 400 });
  if (!contactName) return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
  if (!contactPhone) return NextResponse.json({ error: "Contact phone is required" }, { status: 400 });
  if (!unitId) return NextResponse.json({ error: "Select a unit" }, { status: 400 });
  if (!hoursOut) return NextResponse.json({ error: "Hours/mileage is required" }, { status: 400 });
  if (!VALID_CONDITIONS.includes(conditionOut))
    return NextResponse.json({ error: "Select a condition" }, { status: 400 });

  const checkoutDate = new Date(str(b.checkoutDate));
  const expectedReturnDate = new Date(str(b.expectedReturnDate));
  if (isNaN(checkoutDate.getTime()) || isNaN(expectedReturnDate.getTime()))
    return NextResponse.json({ error: "Checkout and return dates are required" }, { status: 400 });
  if (expectedReturnDate < checkoutDate)
    return NextResponse.json({ error: "Return date cannot be before checkout date" }, { status: 400 });

  const rep = await prisma.user.findUnique({ where: { id: repId } });
  if (!rep || !rep.active) return NextResponse.json({ error: "Selected rep is not valid" }, { status: 400 });
  const unit = await prisma.equipmentUnit.findUnique({ where: { id: unitId } });
  if (!unit) return NextResponse.json({ error: "Selected unit is not valid" }, { status: 400 });
  if (unit.status === "IN_SERVICE")
    return NextResponse.json({ error: `${unit.name} is marked in-service and cannot go out` }, { status: 409 });

  // Server-side double-booking guard (the picker already filters, this enforces).
  const conflict = await findBookingConflict(unitId, checkoutDate, expectedReturnDate);
  if (conflict) {
    return NextResponse.json(
      {
        error: `${unit.name} is already booked ${conflict.checkoutDate.toLocaleDateString()} – ${conflict.expectedReturnDate.toLocaleDateString()} (${conflict.customerCompany})`,
      },
      { status: 409 }
    );
  }

  const signatureData = typeof b.signatureData === "string" ? b.signatureData : "";
  if (!signatureData)
    return NextResponse.json({ error: "Customer signature is required" }, { status: 400 });
  parseDataUrl(signatureData, MAX_SIGNATURE_BYTES); // validates format + size; the data URL itself is stored

  let photosOut: { bytes: Buffer<ArrayBuffer>; mimeType: string }[];
  try {
    photosOut = asPhotos(b.photosOut);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  if (photosOut.length > 6)
    return NextResponse.json({ error: "Too many condition photos (max 6)" }, { status: 400 });

  // Optional serial-plate photo, saved as the first OUT photo on the demo.
  let platePhoto: { bytes: Buffer<ArrayBuffer>; mimeType: string } | null = null;
  if (typeof b.serialPlatePhoto === "string" && b.serialPlatePhoto.trim() !== "") {
    try {
      platePhoto = parseDataUrl(b.serialPlatePhoto, MAX_PHOTO_BYTES);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  const today = startOfToday();
  const initialStatus: DemoStatus =
    checkoutDate <= new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) ? "OUT_ON_DEMO" : "SCHEDULED";

  const demo = await prisma.demo.create({
    data: {
      repId,
      customerCompany,
      contactName,
      contactPhone,
      deliveryAddress: str(b.deliveryAddress) || null,
      pickupAtBranch: b.pickupAtBranch === true,
      deliverToCustomer: b.deliverToCustomer === true,
      customerReturnsToBranch: b.customerReturnsToBranch === true,
      checkoutDate,
      expectedReturnDate,
      unitId,
      conditionOut,
      hoursOut,
      customerIdVerified: b.customerIdVerified === true,
      outNotes: str(b.outNotes) || null,
      reminderDaysBefore:
        typeof b.reminderDaysBefore === "number" && b.reminderDaysBefore >= 0 ? Math.floor(b.reminderDaysBefore) : 3,
      includeResponsibilityRecord: b.includeResponsibilityRecord !== false,
      signatureData,
      signatureDate: new Date(),
      status: initialStatus,
      createdById: user.id,
      photos: {
        create: [
          ...(platePhoto ? [{ kind: "OUT" as const, data: platePhoto.bytes, mimeType: platePhoto.mimeType }] : []),
          ...photosOut.map((p) => ({ kind: "OUT" as const, data: p.bytes, mimeType: p.mimeType })),
        ],
      },
    },
    include: { unit: true, rep: true },
  });

  await syncUnitStatus(unitId);
  await logAudit(
    user.id,
    "DEMO_CREATE",
    "Demo",
    demo.id,
    `${demo.customerCompany} — ${demo.unit.name} (${demo.unit.serial}), ${checkoutDate.toLocaleDateString()} → ${expectedReturnDate.toLocaleDateString()}`
  );
  return NextResponse.json({ demo: { id: demo.id, status: demo.status } }, { status: 201 });
}
