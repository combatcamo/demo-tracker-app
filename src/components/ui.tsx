import type { ReactNode } from "react";

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub ? <p className="mt-1 text-sm text-gray-500">{sub}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
    </label>
  );
}

export const inputCls =
  "w-full min-h-[3rem] rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200";

export function Btn({
  children,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const base =
    "inline-flex min-h-[3rem] items-center justify-center rounded-xl px-5 py-3 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50";
  const styles: Record<string, string> = {
    primary: "bg-orange-600 text-white hover:bg-orange-700",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-orange-700 hover:bg-orange-50",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

const DEMO_STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  OUT_ON_DEMO: "bg-amber-100 text-amber-900",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-200 text-gray-600",
};

const DEMO_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  OUT_ON_DEMO: "Out on demo",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function DemoStatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
        Overdue
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${DEMO_STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {DEMO_STATUS_LABELS[status] ?? status}
    </span>
  );
}

const UNIT_STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  OUT_ON_DEMO: "bg-amber-100 text-amber-900",
  SCHEDULED: "bg-blue-100 text-blue-800",
  IN_SERVICE: "bg-purple-100 text-purple-800",
};

const UNIT_STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  OUT_ON_DEMO: "Out on demo",
  SCHEDULED: "Scheduled",
  IN_SERVICE: "In service",
};

export function UnitStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${UNIT_STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {UNIT_STATUS_LABELS[status] ?? status}
    </span>
  );
}
