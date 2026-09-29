import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { startOfToday, isOverdue, fmtDate } from "@/lib/demos";
import { PageTitle, Card, DemoStatusBadge, EmptyState, Btn } from "@/components/ui";

export const dynamic = "force-dynamic";

type Filter = "all" | "scheduled" | "out" | "dueback" | "completed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "scheduled", label: "Scheduled" },
  { key: "out", label: "Out on demo" },
  { key: "dueback", label: "Due back" },
  { key: "completed", label: "Completed" },
];

export default async function DemosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string }>;
}) {
  await requirePageUser();
  const { q = "", f = "all" } = await searchParams;
  const filter = (FILTERS.some((x) => x.key === f) ? f : "all") as Filter;
  const query = q.trim();

  const all = await prisma.demo.findMany({
    where: query
      ? {
          OR: [
            { customerCompany: { contains: query, mode: "insensitive" } },
            { contactName: { contains: query, mode: "insensitive" } },
            { contactPhone: { contains: query, mode: "insensitive" } },
            { unit: { serial: { contains: query, mode: "insensitive" } } },
            { unit: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {},
    orderBy: { checkoutDate: "desc" },
    take: 200,
    include: {
      unit: { select: { name: true, serial: true } },
      rep: { select: { name: true } },
      photos: { select: { id: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  const today = startOfToday();
  const withFlags = all.map((d) => ({
    ...d,
    overdue: isOverdue(d.status, d.expectedReturnDate),
    dueToday:
      d.status === "OUT_ON_DEMO" &&
      d.expectedReturnDate >= today &&
      d.expectedReturnDate < new Date(today.getTime() + 24 * 60 * 60 * 1000),
  }));

  const active = withFlags.filter((d) => d.status === "SCHEDULED" || d.status === "OUT_ON_DEMO");
  const stats = {
    active: active.length,
    dueToday: withFlags.filter((d) => d.dueToday).length,
    overdue: withFlags.filter((d) => d.overdue).length,
    completed: withFlags.filter((d) => d.status === "COMPLETED").length,
  };

  const visible = withFlags.filter((d) => {
    switch (filter) {
      case "scheduled":
        return d.status === "SCHEDULED";
      case "out":
        return d.status === "OUT_ON_DEMO";
      case "dueback":
        return d.dueToday || d.overdue;
      case "completed":
        return d.status === "COMPLETED";
      default:
        return true;
    }
  });

  const chip = (key: Filter, label: string) => {
    const on = filter === key;
    return (
      <Link
        key={key}
        href={`/?f=${key}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
        className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold ${
          on ? "bg-gray-900 text-white" : "bg-white text-gray-700 ring-1 ring-gray-300"
        }`}
      >
        {label}
      </Link>
    );
  };

  const statCard = (label: string, value: number, key: Filter, alert?: boolean) => (
    <Link
      key={label}
      href={`/?f=${key}`}
      className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow ${
        alert && value > 0 ? "border-red-300" : "border-gray-200"
      }`}
    >
      <p className={`text-3xl font-bold ${alert && value > 0 ? "text-red-600" : ""}`}>{value}</p>
      <p className="mt-1 text-sm font-semibold text-gray-500">{label}</p>
    </Link>
  );

  return (
    <div>
      <PageTitle
        title="Demos"
        sub="Know who has what, when it is due, and who needs a follow-up."
        action={
          <Link href="/demos/new">
            <Btn>+ New Demo</Btn>
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCard("Active", stats.active, "all")}
        {statCard("Due today", stats.dueToday, "dueback")}
        {statCard("Overdue", stats.overdue, "dueback", true)}
        {statCard("Completed", stats.completed, "completed")}
      </div>

      <form method="GET" className="mb-3 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Search demos"
          className="min-h-[3rem] w-full rounded-xl border border-gray-300 bg-white px-4 text-base outline-none focus:border-orange-500"
        />
        <input type="hidden" name="f" value={filter} />
        <button
          type="submit"
          className="min-h-[3rem] shrink-0 rounded-xl bg-gray-900 px-5 font-semibold text-white"
        >
          Search
        </button>
      </form>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((x) => chip(x.key, x.label))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={query ? "No demos match your search" : "No demos yet"}
          body={
            query
              ? "Try a different customer name, phone number, or unit serial."
              : "Tap “New Demo” to check a unit out to a customer."
          }
          action={
            !query ? (
              <Link href="/demos/new">
                <Btn>+ New Demo</Btn>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((d) => (
            <Link key={d.id} href={`/demos/${d.id}`}>
              <Card className="flex gap-3 transition hover:shadow-md">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  {d.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/photos/${d.photos[0].id}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      No photo
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-bold">{d.customerCompany}</p>
                    <DemoStatusBadge status={d.status} overdue={d.overdue} />
                  </div>
                  <p className="truncate text-sm text-gray-600">
                    {d.unit.name} · {d.unit.serial}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Rep: {d.rep.name} · {fmtDate(d.checkoutDate)} → {fmtDate(d.expectedReturnDate)}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
