import { NextResponse } from "next/server";
import { requireApiUser, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!(await requireApiUser())) return unauthorized();
  const params = new URL(req.url).searchParams;
  const kind = params.get("kind");
  const q = (params.get("q") ?? "").trim();
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
  if (kind !== "customers" && kind !== "equipment") return reply({ error: "Invalid lookup" }, 400);
  if (q.length < 2) return reply({ results: [] });
  if (q.length > 100) return reply({ error: "Search is too long" }, 400);
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  try {
    // Explicit read-only columns; values are parameterized, never interpolated SQL.
    const results = kind === "customers"
      ? await prisma.$queryRaw`SELECT customer_number, store_location, name, contact_name, phone_number, address
          FROM public.customers WHERE store_location = '03'
            AND (name ILIKE ${pattern} OR customer_number ILIKE ${pattern})
          ORDER BY name, customer_number, store_location LIMIT 20`
      : await prisma.$queryRaw`SELECT id, stock_number, serial_number, make, model, description, category,
          branch, store_location, machine_location
          FROM public.equipment WHERE stock_number ILIKE ${pattern} OR serial_number ILIKE ${pattern}
            OR model ILIKE ${pattern} OR description ILIKE ${pattern} OR make ILIKE ${pattern}
          ORDER BY stock_number, id LIMIT 20`;
    return reply({ results });
  } catch {
    return reply({ error: "FindIT lookup is unavailable. You can still enter details manually." }, 503);
  }
}
