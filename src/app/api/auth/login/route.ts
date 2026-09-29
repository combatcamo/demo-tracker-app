import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureFirstAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { COOKIE_NAME, SESSION_MAX_AGE_SEC, createSessionToken } from "@/lib/session";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { name, pin } = body as { name?: unknown; pin?: unknown };
  if (typeof name !== "string" || typeof pin !== "string" || !name.trim() || !pin) {
    return NextResponse.json({ error: "Name and PIN are required" }, { status: 400 });
  }

  await ensureFirstAdmin();

  const user = await prisma.user.findUnique({ where: { name: name.trim() } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "Invalid name or PIN" }, { status: 401 });
  }
  const ok = await bcrypt.compare(pin, user.pinHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid name or PIN" }, { status: 401 });
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  const token = await createSessionToken(user.id, secret);

  await logAudit(user.id, "LOGIN", "User", user.id, `Signed in as ${user.name}`);

  const res = NextResponse.json({ ok: true, name: user.name, role: user.role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
