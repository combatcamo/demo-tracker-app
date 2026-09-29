import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const photo = await prisma.demoPhoto.findUnique({ where: { id } });
  if (!photo) return new Response("Not found", { status: 404 });
  const body = new Uint8Array(photo.data);
  return new Response(body, {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "private, max-age=86400",
      "Content-Length": String(body.byteLength),
    },
  });
}
