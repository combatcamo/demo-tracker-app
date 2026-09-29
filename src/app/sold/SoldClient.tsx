"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageTitle, Card, Field, inputCls, Btn, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/demos";
import type { SoldView } from "./page";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SoldClient({ initialRecords }: { initialRecords: SoldView[] }) {
  const router = useRouter();
  const records = initialRecords;
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SoldView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [description, setDescription] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [amount, setAmount] = useState("");
  const [soldDate, setSoldDate] = useState(todayStr());
  const [notes, setNotes] = useState("");

  const openAdd = () => {
    setEditing(null);
    setDescription("");
    setCustomerCompany("");
    setAmount("");
    setSoldDate(todayStr());
    setNotes("");
    setShowForm(true);
  };

  const openEdit = (r: SoldView) => {
    setEditing(r);
    setDescription(r.description);
    setCustomerCompany(r.customerCompany);
    setAmount(r.amount ?? "");
    setSoldDate(r.soldDate);
    setNotes(r.notes ?? "");
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const url = editing ? `/api/sold/${editing.id}` : "/api/sold";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, customerCompany, amount, soldDate, notes }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setShowForm(false);
      setEditing(null);
      router.refresh();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: SoldView) => {
    if (!confirm(`Delete the sold record “${r.description}”?`)) return;
    await fetch(`/api/sold/${r.id}`, { method: "DELETE" });
    router.refresh();
  };

  const toggleInvoiced = async (r: SoldView) => {
    await fetch(`/api/sold/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiced: !r.invoiced }),
    });
    router.refresh();
  };

  return (
    <div>
      <PageTitle
        title="Sold — Not Invoiced"
        sub="Units sold that still need an invoice."
        action={<Btn onClick={openAdd}>+ Add sold record</Btn>}
      />
      {error ? <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

      {showForm ? (
        <Card className="mb-4">
          <h2 className="mb-3 text-lg font-bold">{editing ? "Edit sold record" : "Add sold record"}</h2>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Description">
                <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} required placeholder="e.g. UTG T5 — Serial 8573204" />
              </Field>
            </div>
            <Field label="Customer">
              <input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} className={inputCls} required />
            </Field>
            <Field label="Amount (optional)">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} inputMode="decimal" placeholder="e.g. 42500" />
            </Field>
            <Field label="Sold date">
              <input type="date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)} className={inputCls} required />
            </Field>
            <Field label="Notes">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Btn type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add record"}</Btn>
              <Btn variant="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Btn>
            </div>
          </form>
        </Card>
      ) : null}

      {records.length === 0 ? (
        <EmptyState
          title="No sold records"
          body="When a demo unit sells, add it here so invoicing never slips through the cracks."
          action={<Btn onClick={openAdd}>+ Add sold record</Btn>}
        />
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <Card key={r.id} className={r.invoiced ? "opacity-70" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{r.description}</p>
                  <p className="text-sm text-gray-500">
                    {r.customerCompany} · Sold {fmtDate(r.soldDate)}
                    {r.amount ? ` · $${Number(r.amount).toLocaleString()}` : ""}
                  </p>
                  {r.notes ? <p className="mt-1 text-sm text-gray-600">{r.notes}</p> : null}
                  <p className="mt-1 text-xs text-gray-400">Added by {r.createdByName}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    r.invoiced ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {r.invoiced ? "Invoiced" : "Awaiting invoice"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn
                  variant="secondary"
                  onClick={() => void toggleInvoiced(r)}
                  className="min-h-[2.75rem] px-4 py-2 text-sm"
                >
                  {r.invoiced ? "Reopen" : "Mark invoiced"}
                </Btn>
                <Btn variant="secondary" onClick={() => openEdit(r)} className="min-h-[2.75rem] px-4 py-2 text-sm">
                  Edit
                </Btn>
                <Btn variant="ghost" onClick={() => void remove(r)} className="min-h-[2.75rem] px-4 py-2 text-sm">
                  Delete
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
