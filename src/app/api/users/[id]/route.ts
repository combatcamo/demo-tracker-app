import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin, forbidden } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireApiAdmin();
  if (!admin) return forbidden();
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { active, pin, role } = body as { active?: unknown; pin?: unknown; role?: unknown };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.id === admin.id && active === false) {
    return NextResponse.json({ error: "You cannot deactivate yourself" }, { status: 400 });
  }

  const data: { active?: boolean; pinHash?: string; role?: "ADMIN" | "REP" } = {};
  if (typeof active === "boolean") data.active = active;
  if (typeof pin === "string" && pin.length > 0) {
    if (pin.length < 4) return NextResponse.json({ error: "PIN must be at least 4 characters" }, { status: 400 });
    data.pinHash = await bcrypt.hash(pin, 12);
  }
  if (role === "ADMIN" || role === "REP") {
    if (target.id === admin.id && role !== "ADMIN") {
      return NextResponse.json({ error: "You cannot demote yourself" }, { status: 400 });
    }
    data.role = role;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, role: true, active: true, createdAt: true },
  });
  const changes: string[] = [];
  if (typeof active === "boolean") changes.push(active ? "reactivated" : "deactivated");
  if (data.pinHash) changes.push("PIN reset");
  if (data.role) changes.push(`role -> ${data.role}`);
  await logAudit(admin.id, "USER_UPDATE", "User", user.id, `${user.name}: ${changes.join(", ") || "no changes"}`);
  return NextResponse.json({ user });
}
