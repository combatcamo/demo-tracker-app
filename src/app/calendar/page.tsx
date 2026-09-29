import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";

export interface CalDemo {
  id: string;
  customerCompany: string;
  unitName: string;
  status: string;
  checkoutDate: string;
  expectedReturnDate: string;
  overdue: boolean;
}

export default async function CalendarPage() {
  await requirePageUser();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  const to = new Date();
  to.setDate(to.getDate() + 240);

  const demos = await prisma.demo.findMany({
    where: {
      status: { in: ["SCHEDULED", "OUT_ON_DEMO"] },
      checkoutDate: { lte: to },
      expectedReturnDate: { gte: from },
    },
    orderBy: { checkoutDate: "asc" },
    take: 500,
    include: { unit: { select: { name: true } } },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const shaped: CalDemo[] = demos.map((d) => ({
    id: d.id,
    customerCompany: d.customerCompany,
    unitName: d.unit.name,
    status: d.status,
    checkoutDate: d.checkoutDate.toISOString(),
    expectedReturnDate: d.expectedReturnDate.toISOString(),
    overdue: d.status === "OUT_ON_DEMO" && d.expectedReturnDate < today,
  }));

  return <CalendarClient demos={shaped} />;
}
