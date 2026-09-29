import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { findBookingConflict } from "@/lib/demos";

/**
 * Units free for a date range: not IN_SERVICE and no overlapping
 * SCHEDULED/OUT_ON_DEMO demo for the same unit.
 */
export async function GET(req: Request) {
  const user = await requireApiUser();
  if (!user) return unauthorized();
  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const units = await prisma.equipmentUnit.findMany({
    where: {
      status: { not: "IN_SERVICE" },
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { serial: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  const free: typeof units = [];
  for (const u of units) {
    const conflict = await findBookingConflict(u.id, from, to);
    if (!conflict) free.push(u);
  }
  return NextResponse.json({ units: free });
}
