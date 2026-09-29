import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import SoldClient from "./SoldClient";

export const dynamic = "force-dynamic";

export interface SoldView {
  id: string;
  description: string;
  customerCompany: string;
  amount: string | null;
  soldDate: string;
  invoiced: boolean;
  notes: string | null;
  createdByName: string;
}

export default async function SoldPage() {
  await requirePageUser();
  const records = await prisma.soldRecord.findMany({
    orderBy: [{ invoiced: "asc" }, { soldDate: "desc" }],
    take: 200,
    include: { createdBy: { select: { name: true } } },
  });
  const views: SoldView[] = records.map((r) => ({
    id: r.id,
    description: r.description,
    customerCompany: r.customerCompany,
    amount: r.amount ? r.amount.toString() : null,
    soldDate: r.soldDate.toISOString().slice(0, 10),
    invoiced: r.invoiced,
    notes: r.notes,
    createdByName: r.createdBy.name,
  }));
  return <SoldClient initialRecords={views} />;
}
