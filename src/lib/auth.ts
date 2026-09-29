import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { COOKIE_NAME, verifySessionToken } from "./session";
import type { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

/** Create the first admin from env vars when the DB has no users yet. */
export async function ensureFirstAdmin(): Promise<void> {
  const count = await prisma.user.count();
  if (count > 0) return;
  const name = (process.env.ADMIN_NAME ?? "").trim();
  const pin = (process.env.ADMIN_PIN ?? "").trim();
  if (!name || !pin) return;
  const pinHash = await bcrypt.hash(pin, 12);
  await prisma.user.create({
    data: { name, pinHash, role: "ADMIN", active: true },
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token, secret);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: { id: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, role: user.role };
}

/** For server components/layouts: redirect to /login when not signed in. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For route handlers: returns the user, or null when not signed in. */
export async function requireApiUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

/** For route handlers: returns the user when admin, or null otherwise. */
export async function requireApiAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Admins only" }, { status: 403 });
}
