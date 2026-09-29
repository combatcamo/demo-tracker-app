import { prisma } from "./prisma";

/** A demo blocks a unit when it is SCHEDULED or OUT_ON_DEMO. */
const BLOCKING = ["SCHEDULED", "OUT_ON_DEMO"] as const;

/** True when [aStart,aEnd] overlaps [bStart,bEnd] (inclusive). */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Find an existing demo that would double-book the unit for the given range.
 * Returns the conflicting demo (id, dates, customer) or null.
 */
export async function findBookingConflict(
  unitId: string,
  from: Date,
  to: Date,
  excludeDemoId?: string
): Promise<{ id: string; checkoutDate: Date; expectedReturnDate: Date; customerCompany: string } | null> {
  const existing = await prisma.demo.findMany({
    where: {
      unitId,
      status: { in: [...BLOCKING] },
      ...(excludeDemoId ? { id: { not: excludeDemoId } } : {}),
    },
    select: { id: true, checkoutDate: true, expectedReturnDate: true, customerCompany: true },
  });
  for (const d of existing) {
    if (rangesOverlap(from, to, d.checkoutDate, d.expectedReturnDate)) return d;
  }
  return null;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isOverdue(status: string, expectedReturnDate: Date): boolean {
  return status === "OUT_ON_DEMO" && expectedReturnDate < startOfToday();
}

export function isDueToday(expectedReturnDate: Date): boolean {
  const d = new Date(expectedReturnDate);
  const t = startOfToday();
  return d >= t && d < new Date(t.getTime() + 24 * 60 * 60 * 1000);
}

export function fmtDate(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Recompute a unit's stored status from its blocking demos.
 * Never touches IN_SERVICE (that's a manual flag).
 */
export async function syncUnitStatus(unitId: string): Promise<void> {
  const unit = await prisma.equipmentUnit.findUnique({
    where: { id: unitId },
    select: { status: true },
  });
  if (!unit || unit.status === "IN_SERVICE") return;
  const blocking = await prisma.demo.findMany({
    where: { unitId, status: { in: ["SCHEDULED", "OUT_ON_DEMO"] } },
    select: { status: true },
  });
  let next: "AVAILABLE" | "SCHEDULED" | "OUT_ON_DEMO" = "AVAILABLE";
  if (blocking.some((d) => d.status === "OUT_ON_DEMO")) next = "OUT_ON_DEMO";
  else if (blocking.some((d) => d.status === "SCHEDULED")) next = "SCHEDULED";
  if (next !== unit.status) {
    await prisma.equipmentUnit.update({ where: { id: unitId }, data: { status: next } });
  }
}
