import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireApiAdmin, forbidden } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const me = await requireApiAdmin();
  if (!me) return forbidden();
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json({ users, me: { id: me.id, name: me.name, role: me.role } });
}

export async function POST(req: Request) {
  const admin = await requireApiAdmin();
  if (!admin) return forbidden();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { name, pin, role } = body as { name?: unknown; pin?: unknown; role?: unknown };
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (typeof pin !== "string" || pin.length < 4) {
    return NextResponse.json({ error: "PIN must be at least 4 characters" }, { status: 400 });
  }
  if (role !== "ADMIN" && role !== "REP") {
    return NextResponse.json({ error: "Role must be ADMIN or REP" }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { name: name.trim() } });
  if (exists) return NextResponse.json({ error: "That name is already taken" }, { status: 409 });

  const pinHash = await bcrypt.hash(pin, 12);
  const user = await prisma.user.create({
    data: { name: name.trim(), pinHash, role, active: true },
    select: { id: true, name: true, role: true, active: true, createdAt: true },
  });
  await logAudit(admin.id, "USER_CREATE", "User", user.id, `Added ${user.name} (${user.role})`);
  return NextResponse.json({ user }, { status: 201 });
}
