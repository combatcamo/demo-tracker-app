import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { startOfToday, isOverdue, fmtDate } from "@/lib/demos";
import { PageTitle, Card, DemoStatusBadge, EmptyState, Btn } from "@/components/ui";
import MarkInvoicedButton from "./MarkInvoicedButton";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  await requirePageUser();
  const today = startOfToday();

  const outDemos = await prisma.demo.findMany({
    where: { status: "OUT_ON_DEMO" },
    orderBy: { expectedReturnDate: "asc" },
    include: {
      unit: { select: { name: true, serial: true } },
      rep: { select: { name: true } },
    },
  });
  const overdue = outDemos.filter((d) => isOverdue(d.status, d.expectedReturnDate));
  const dueSoon = outDemos.filter((d) => {
    const reminder = new Date(d.expectedReturnDate);
    reminder.setDate(reminder.getDate() - d.reminderDaysBefore);
    return !isOverdue(d.status, d.expectedReturnDate) && reminder <= today;
  });

  const openSold = await prisma.soldRecord.findMany({
    where: { invoiced: false },
    orderBy: { soldDate: "asc" },
    include: { createdBy: { select: { name: true } } },
  });

  const nothing = overdue.length === 0 && dueSoon.length === 0 && openSold.length === 0;

  return (
    <div>
      <PageTitle title="Weekly Review" sub="Overdue demos plus every open sold-not-invoiced record." />

      {nothing ? (
        <EmptyState
          title="All clear"
          body="Nothing is overdue and every sold record is invoiced. Nice work."
        />
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 ? (
            <section>
              <h2 className="mb-2 text-lg font-bold text-red-700">Overdue demos ({overdue.length})</h2>
              <div className="space-y-2">
                {overdue.map((d) => (
                  <Link key={d.id} href={`/demos/${d.id}`}>
                    <Card className="flex items-center justify-between gap-3 border-red-200">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{d.customerCompany}</p>
                        <p className="truncate text-sm text-gray-500">
                          {d.unit.name} · {d.unit.serial} · Rep: {d.rep.name}
                        </p>
                        <p className="text-sm font-semibold text-red-600">Due back {fmtDate(d.expectedReturnDate)}</p>
                      </div>
                      <DemoStatusBadge status={d.status} overdue />
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {dueSoon.length > 0 ? (
            <section>
              <h2 className="mb-2 text-lg font-bold">Coming due ({dueSoon.length})</h2>
              <div className="space-y-2">
                {dueSoon.map((d) => (
                  <Link key={d.id} href={`/demos/${d.id}`}>
                    <Card className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{d.customerCompany}</p>
                        <p className="truncate text-sm text-gray-500">
                          {d.unit.name} · Rep: {d.rep.name} · Due back {fmtDate(d.expectedReturnDate)}
                        </p>
                      </div>
                      <DemoStatusBadge status={d.status} />
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {openSold.length > 0 ? (
            <section>
              <h2 className="mb-2 text-lg font-bold">Sold — not invoiced ({openSold.length})</h2>
              <div className="space-y-2">
                {openSold.map((r) => (
                  <Card key={r.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{r.description}</p>
                      <p className="truncate text-sm text-gray-500">
                        {r.customerCompany} · Sold {fmtDate(r.soldDate)}
                        {r.amount ? ` · $${Number(r.amount).toLocaleString()}` : ""}
                      </p>
                    </div>
                    <MarkInvoicedButton id={r.id} label={r.description} />
                  </Card>
                ))}
              </div>
              <div className="mt-3">
                <Link href="/sold">
                  <Btn variant="secondary">Manage sold records</Btn>
                </Link>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
