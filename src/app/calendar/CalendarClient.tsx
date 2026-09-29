"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageTitle, Card, DemoStatusBadge, EmptyState } from "@/components/ui";
import type { CalDemo } from "./page";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function CalendarClient({ demos }: { demos: CalDemo[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(dayKey(now));

  const parsed = useMemo(
    () =>
      demos.map((d) => ({
        ...d,
        from: new Date(new Date(d.checkoutDate).setHours(0, 0, 0, 0)),
        to: new Date(new Date(d.expectedReturnDate).setHours(0, 0, 0, 0)),
      })),
    [demos]
  );

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // back to Sunday
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [year, month]);

  const demosOn = (day: Date) => {
    const t = day.getTime();
    return parsed.filter((d) => d.from.getTime() <= t && t <= d.to.getTime());
  };

  const selectedDemos = useMemo(() => {
    if (!selected) return [];
    const [y, m, dd] = selected.split("-").map(Number);
    return demosOn(new Date(y, m, dd));
  }, [selected, parsed]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <div>
      <PageTitle title="Calendar" sub="What is out on any given day." />

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => move(-1)}
            className="flex min-h-[3rem] min-w-[3rem] items-center justify-center rounded-xl bg-gray-100 px-4 text-xl font-bold"
            aria-label="Previous month"
          >
            ←
          </button>
          <p className="text-lg font-bold">
            {MONTHS[month]} {year}
          </p>
          <button
            type="button"
            onClick={() => move(1)}
            className="flex min-h-[3rem] min-w-[3rem] items-center justify-center rounded-xl bg-gray-100 px-4 text-xl font-bold"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            const inMonth = day.getMonth() === month;
            const list = demosOn(day);
            const isSel = selected === dayKey(day);
            const isToday = dayKey(day) === dayKey(new Date());
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(dayKey(day))}
                className={`min-h-[4.25rem] rounded-xl border p-1 text-left align-top ${
                  isSel ? "border-orange-600 ring-2 ring-orange-200" : "border-gray-200"
                } ${inMonth ? "bg-white" : "bg-gray-50"}`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isToday ? "bg-orange-600 text-white" : inMonth ? "text-gray-700" : "text-gray-400"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {list.slice(0, 2).map((d) => (
                    <div
                      key={d.id}
                      className={`truncate rounded px-1 text-[10px] font-semibold leading-4 ${
                        d.overdue ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {d.customerCompany}
                    </div>
                  ))}
                  {list.length > 2 ? (
                    <div className="px-1 text-[10px] font-bold text-gray-500">+{list.length - 2} more</div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="mt-4">
        {selectedDemos.length === 0 ? (
          <EmptyState title="Nothing out this day" body="No demo covers the selected day." />
        ) : (
          <div className="space-y-2">
            {selectedDemos.map((d) => (
              <Link key={d.id} href={`/demos/${d.id}`}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{d.customerCompany}</p>
                    <p className="truncate text-sm text-gray-500">{d.unitName}</p>
                  </div>
                  <DemoStatusBadge status={d.status} overdue={d.overdue} />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
