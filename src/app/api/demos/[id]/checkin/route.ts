import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { syncUnitStatus } from "@/lib/demos";
import { parseDataUrl, MAX_PHOTO_BYTES } from "@/lib/photos";

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
  const b = body as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

  const demo = await prisma.demo.findUnique({ where: { id }, include: { unit: true } });
  if (!demo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (demo.status === "COMPLETED" || demo.status === "CANCELLED") {
    return NextResponse.json({ error: "This demo is already closed" }, { status: 400 });
  }

  let photosIn: { bytes: Buffer<ArrayBuffer>; mimeType: string }[] = [];
  try {
    const raw = Array.isArray(b.photosIn) ? b.photosIn : [];
    if (raw.length > 10) return NextResponse.json({ error: "Too many photos (max 10)" }, { status: 400 });
    photosIn = raw.map((p) => {
      const dataUrl = (p as { dataUrl?: unknown }).dataUrl;
      if (typeof dataUrl !== "string") throw new Error("Invalid photo data");
      return parseDataUrl(dataUrl, MAX_PHOTO_BYTES);
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const now = new Date();
  await prisma.demo.update({
    where: { id },
    data: {
      status: "COMPLETED",
      checkedInAt: now,
      hoursIn: str(b.hoursIn) || null,
      conditionIn: str(b.conditionIn) || null,
      returnNotes: str(b.returnNotes) || null,
      photos: {
        create: photosIn.map((p) => ({ kind: "IN" as const, data: p.bytes, mimeType: p.mimeType })),
      },
    },
  });
  await syncUnitStatus(demo.unitId);
  await logAudit(
    user.id,
    "DEMO_CHECKIN",
    "Demo",
    id,
    `${demo.customerCompany} — ${demo.unit.name} returned ${now.toLocaleDateString()}`
  );
  return NextResponse.json({ ok: true });
}
