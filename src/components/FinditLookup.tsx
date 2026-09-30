"use client";
import { useEffect, useState } from "react";
import { inputCls } from "@/components/ui";

export type LookupRow = {
  id?: string; customer_number?: string; store_location?: string | null; name?: string;
  contact_name?: string | null; phone_number?: string | null; address?: string | null;
  stock_number?: string; serial_number?: string | null; make?: string | null; model?: string | null;
  description?: string | null; category?: string | null; branch?: string | null; machine_location?: string | null;
};
export function equipmentName(r: LookupRow) {
  return [r.make, r.model].filter(Boolean).join(" ") || r.description || r.stock_number || "";
}
export function equipmentSource(r: LookupRow) {
  return `FindIT stock ${r.stock_number}; Assigned store (CDK): ${r.branch || r.store_location || "unknown"}${r.branch && r.store_location && r.branch !== r.store_location ? `; legacy store: ${r.store_location}` : ""}${r.machine_location ? `; location: ${r.machine_location}` : ""}. Verify current location; source records may be outdated.`;
}
export default function FinditLookup({ kind, onPick }: { kind: "customers" | "equipment"; onPick: (row: LookupRow) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setRows([]);
    setMessage("");
    if (q.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setMessage("Searching FindIT…");
      try {
        const res = await fetch(`/api/lookups?${new URLSearchParams({ kind, q })}`, { signal: controller.signal, cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lookup unavailable. Enter details manually.");
        if (controller.signal.aborted) return;
        setRows(data.results);
        setMessage(data.results.length ? "Choose a match to fill the form. All fields remain editable." : "No matches. You can enter details manually.");
      } catch (e) {
        if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : "Lookup unavailable. Enter details manually.");
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, kind]);
  return <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 p-3">
    <label className="block text-sm font-semibold">{kind === "customers" ? "FindIT customer autofill — Store 03" : "FindIT equipment autofill"}
      <input className={`${inputCls} mt-2`} value={q} maxLength={100} onChange={e => setQ(e.target.value)} placeholder={kind === "customers" ? "Search company or customer number (2+ characters)" : "Search stock, serial, make or model (all stores)"} autoComplete="off" />
    </label>
    <p className="mt-2 text-xs text-gray-600">{kind === "customers" ? "Customer suggestions are limited to store 03. If not found, enter the customer and contact details manually. " : ""}Read-only lookup. Selecting a match does not change FindIT. Showing up to 20 matches; narrow your search if needed.</p>
    <p className="text-sm" role="status">{message}</p>
    <div className="max-h-64 overflow-auto">
      {rows.map(r => <button type="button" key={kind === "customers" ? JSON.stringify([r.customer_number, r.store_location]) : r.id || r.stock_number}
        className="mt-2 block w-full rounded-lg border bg-white p-3 text-left focus:ring-2 focus:ring-orange-500"
        onClick={() => { onPick(r); setQ(""); setRows([]); }}>
        <span className="block font-semibold">{kind === "customers" ? r.name : equipmentName(r)}</span>
        <span className="block text-sm">{kind === "customers" ? `Customer ${r.customer_number} · Store ${r.store_location || "unknown"} · ${r.address || "Address unavailable"}` : `Stock ${r.stock_number} · Serial ${r.serial_number || "missing"} · Assigned store ${r.branch || r.store_location || "unknown"}`}</span>
        {kind === "equipment" && r.branch && r.store_location && r.branch !== r.store_location && <span className="block text-xs text-amber-800">Legacy store {r.store_location} differs; verify current location.</span>}
      </button>)}
    </div>
  </div>;
}
