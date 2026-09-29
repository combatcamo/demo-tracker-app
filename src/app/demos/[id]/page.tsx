import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { fmtDate, fmtDateTime, isOverdue } from "@/lib/demos";
import { PageTitle, Card, DemoStatusBadge, Btn } from "@/components/ui";
import DemoActions from "./DemoActions";

export const dynamic = "force-dynamic";

export default async function DemoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePageUser();
  const { id } = await params;
  const demo = await prisma.demo.findUnique({
    where: { id },
    include: {
      unit: true,
      rep: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      photos: { select: { id: true, kind: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!demo) notFound();

  const audit = await prisma.auditLog.findMany({
    where: { entityType: "Demo", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { name: true } } },
  });

  const overdue = isOverdue(demo.status, demo.expectedReturnDate);
  const outPhotos = demo.photos.filter((p) => p.kind === "OUT");
  const inPhotos = demo.photos.filter((p) => p.kind === "IN");

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2.5 text-sm last:border-0">
      <dt className="shrink-0 font-semibold text-gray-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );

  return (
    <div>
      <PageTitle
        title={demo.customerCompany}
        sub={`${demo.unit.name} · Serial ${demo.unit.serial}`}
        action={
          <Link href="/">
            <Btn variant="secondary">← Demos</Btn>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DemoStatusBadge status={demo.status} overdue={overdue} />
        {demo.includeResponsibilityRecord ? (
          <Link href={`/demos/${demo.id}/record`} target="_blank">
            <Btn variant="secondary" className="min-h-[2.75rem] px-4 py-2 text-sm">
              Print responsibility record
            </Btn>
          </Link>
        ) : null}
      </div>

      <DemoActions
        demoId={demo.id}
        status={demo.status}
        customerCompany={demo.customerCompany}
        followUpNote={demo.followUpNote}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-lg font-bold">Schedule &amp; customer</h2>
          <dl>
            {row("Rep", demo.rep.name)}
            {row("Check-out", fmtDate(demo.checkoutDate))}
            {row("Expected return", fmtDate(demo.expectedReturnDate))}
            {row("Contact", `${demo.contactName} · ${demo.contactPhone}`)}
            {demo.deliveryAddress ? row("Delivery address", demo.deliveryAddress) : null}
            {row(
              "Logistics",
              [
                demo.pickupAtBranch && "Customer picks up at branch",
                demo.deliverToCustomer && "We deliver",
                demo.customerReturnsToBranch && "Customer returns to branch",
              ]
                .filter(Boolean)
                .join(" · ") || "—"
            )}
            {row("Created by", `${demo.createdBy.name} · ${fmtDateTime(demo.createdAt)}`)}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-2 text-lg font-bold">Unit condition</h2>
          <dl>
            {row("Condition out", demo.conditionOut.replace("_", " "))}
            {row("Hours/mileage out", demo.hoursOut)}
            {row("Customer ID verified", demo.customerIdVerified ? "Yes" : "No")}
            {demo.outNotes ? row("Out notes", demo.outNotes) : null}
            {demo.status === "COMPLETED" ? (
              <>
                {row("Checked in", demo.checkedInAt ? fmtDateTime(demo.checkedInAt) : "—")}
                {demo.hoursIn ? row("Hours/mileage in", demo.hoursIn) : null}
                {demo.conditionIn ? row("Condition in", demo.conditionIn) : null}
                {demo.returnNotes ? row("Return notes", demo.returnNotes) : null}
              </>
            ) : null}
          </dl>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 text-lg font-bold">Check-out photos ({outPhotos.length})</h2>
        {outPhotos.length === 0 ? (
          <p className="text-sm text-gray-500">No check-out photos.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {outPhotos.map((p) => (
              <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/photos/${p.id}`} alt="" className="h-28 w-full rounded-xl object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )}
        <h2 className="mb-3 mt-6 text-lg font-bold">Check-in photos ({inPhotos.length})</h2>
        {inPhotos.length === 0 ? (
          <p className="text-sm text-gray-500">No check-in photos yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {inPhotos.map((p) => (
              <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/photos/${p.id}`} alt="" className="h-28 w-full rounded-xl object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="mb-2 text-lg font-bold">History</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-gray-500">No history yet.</p>
        ) : (
          <ul className="space-y-2">
            {audit.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-semibold">{a.user.name}</span>{" "}
                <span className="text-gray-600">{a.details ?? a.action}</span>
                <span className="block text-xs text-gray-400">{fmtDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-gray-400">Viewing as {me.name}</p>
      </Card>
    </div>
  );
}
