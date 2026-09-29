import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { parseDataUrl, MAX_PHOTO_BYTES } from "@/lib/photos";
import type { PhotoKind } from "@prisma/client";

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
  const { kind, dataUrl } = body as { kind?: unknown; dataUrl?: unknown };
  if (kind !== "OUT" && kind !== "IN") return NextResponse.json({ error: "Invalid photo kind" }, { status: 400 });
  if (typeof dataUrl !== "string") return NextResponse.json({ error: "Photo is required" }, { status: 400 });

  const demo = await prisma.demo.findUnique({ where: { id } });
  if (!demo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let parsed: { bytes: Buffer<ArrayBuffer>; mimeType: string };
  try {
    parsed = parseDataUrl(dataUrl, MAX_PHOTO_BYTES);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const photo = await prisma.demoPhoto.create({
    data: { demoId: id, kind: kind as PhotoKind, data: parsed.bytes, mimeType: parsed.mimeType },
    select: { id: true },
  });
  await logAudit(user.id, "PHOTO_ADD", "Demo", id, `Added a ${kind === "OUT" ? "check-out" : "check-in"} photo`);
  return NextResponse.json({ photo }, { status: 201 });
}
