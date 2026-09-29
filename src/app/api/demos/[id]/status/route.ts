import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { syncUnitStatus } from "@/lib/demos";
import type { DemoStatus } from "@prisma/client";

interface Params {
  params: Promise<{ id: string }>;
}

// Allowed manual transitions. Check-in has its own endpoint.
const ALLOWED: Record<DemoStatus, DemoStatus[]> = {
  SCHEDULED: ["OUT_ON_DEMO", "CANCELLED"],
  OUT_ON_DEMO: ["CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

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
  const to = (body as { to?: unknown }).to as DemoStatus;
  if (to !== "OUT_ON_DEMO" && to !== "CANCELLED") {
    return NextResponse.json({ error: "Invalid transition" }, { status: 400 });
  }

  const demo = await prisma.demo.findUnique({ where: { id } });
  if (!demo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!ALLOWED[demo.status].includes(to)) {
    return NextResponse.json(
      { error: `Cannot move a ${demo.status} demo to ${to}` },
      { status: 400 }
    );
  }

  await prisma.demo.update({ where: { id }, data: { status: to } });
  await syncUnitStatus(demo.unitId);
  const label = to === "OUT_ON_DEMO" ? "marked out on demo" : "cancelled";
  await logAudit(user.id, "DEMO_STATUS", "Demo", id, `${demo.customerCompany}: ${label}`);
  return NextResponse.json({ ok: true, status: to });
}
