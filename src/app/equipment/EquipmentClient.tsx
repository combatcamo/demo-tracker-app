"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageTitle, Card, Field, inputCls, Btn, UnitStatusBadge, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/demos";
import type { UnitView } from "./page";

export default function EquipmentClient({
  initialUnits,
  categories,
}: {
  initialUnits: UnitView[];
  categories: string[];
}) {
  const router = useRouter();
  const units = initialUnits;
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<UnitView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Add / edit form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [serial, setSerial] = useState("");
  const [notes, setNotes] = useState("");

  const openAdd = () => {
    setEditing(null);
    setName("");
    setCategory(categories[0] ?? "");
    setNewCategory("");
    setSerial("");
    setNotes("");
    setShowAdd(true);
  };

  const openEdit = (u: UnitView) => {
    setShowAdd(false);
    setEditing(u);
    setName(u.name);
    setCategory(u.category);
    setNewCategory("");
    setSerial(u.serial);
    setNotes(u.notes ?? "");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const finalCategory = category === "__new" ? newCategory.trim() : category.trim();
    if (!name.trim() || !finalCategory || !serial.trim()) {
      setError("Name, category, and serial number are required.");
      return;
    }
    setBusy(true);
    try {
      const url = editing ? `/api/equipment/${editing.id}` : "/api/equipment";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category: finalCategory, serial: serial.trim(), notes: notes.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save the unit");
      setShowAdd(false);
      setEditing(null);
      router.refresh();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not save the unit");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (u: UnitView, status: string) => {
    const label = status === "IN_SERVICE" ? "mark in-service" : "mark available";
    if (!confirm(`Are you sure you want to ${label} for ${u.name} (${u.serial})?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/equipment/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update status");
      router.refresh();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  };

  const visible = units.filter((u) => {
    if (statusFilter && u.status !== statusFilter) return false;
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      return u.name.toLowerCase().includes(needle) || u.serial.toLowerCase().includes(needle);
    }
    return true;
  });

  return (
    <div>
      <PageTitle
        title="Equipment"
        sub="Every unit, where it is, and when it is due back."
        action={
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => window.print()}>
              Print QR tags
            </Btn>
            <Btn onClick={openAdd}>+ Add unit</Btn>
          </div>
        }
      />

      {error ? <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

      {(showAdd || editing) && (
        <Card className="mb-4">
          <h2 className="mb-3 text-lg font-bold">{editing ? "Edit unit" : "Add unit"}</h2>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="Unit name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. UTG T5" />
            </Field>
            <Field label="Serial number">
              <input value={serial} onChange={(e) => setSerial(e.target.value)} className={inputCls} placeholder="e.g. 8573204" />
            </Field>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__new">+ New category…</option>
              </select>
            </Field>
            {category === "__new" ? (
              <Field label="New category name">
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className={inputCls} />
              </Field>
            ) : null}
            <div className="sm:col-span-2">
              <Field label="Notes">
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Btn type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add unit"}</Btn>
              <Btn variant="secondary" onClick={() => { setShowAdd(false); setEditing(null); }}>
                Cancel
              </Btn>
            </div>
          </form>
        </Card>
      )}

      <div className="mb-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or serial"
          className="min-h-[3rem] w-full rounded-xl border border-gray-300 bg-white px-4 text-base outline-none focus:border-orange-500"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="min-h-[3rem] rounded-xl border border-gray-300 bg-white px-3 text-base">
          <option value="">All statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="OUT_ON_DEMO">Out on demo</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="IN_SERVICE">In service</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No units found"
          body="Add your first unit with the “Add unit” button — name, category, and serial number."
          action={<Btn onClick={openAdd}>+ Add unit</Btn>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((u) => (
            <Card key={u.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{u.name}</p>
                  <p className="text-sm text-gray-500">{u.category} · Serial {u.serial}</p>
                </div>
                <UnitStatusBadge status={u.status} />
              </div>
              {u.holder ? (
                <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm">
                  <span className="font-bold">{u.holder.customerCompany}</span>
                  <span className="block text-gray-600">
                    Rep: {u.holder.repName} · Due back {fmtDate(u.holder.expectedReturnDate)}
                    {u.holder.status === "SCHEDULED" ? " (scheduled)" : ""}
                  </span>
                </p>
              ) : u.status === "AVAILABLE" ? (
                <p className="mt-2 text-sm font-semibold text-green-700">Ready to go out</p>
              ) : null}
              {u.notes ? <p className="mt-2 text-sm text-gray-600">{u.notes}</p> : null}
              <div className="mt-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.qrDataUrl} alt={`QR code for ${u.name}`} className="h-20 w-20 rounded-lg border border-gray-200" />
                <div className="flex flex-wrap gap-2">
                  <Btn variant="secondary" onClick={() => openEdit(u)} className="min-h-[2.75rem] px-4 py-2 text-sm">
                    Edit
                  </Btn>
                  {u.status === "IN_SERVICE" ? (
                    <Btn variant="secondary" disabled={busy} onClick={() => void setStatus(u, "AVAILABLE")} className="min-h-[2.75rem] px-4 py-2 text-sm">
                      Mark available
                    </Btn>
                  ) : u.status === "AVAILABLE" ? (
                    <Btn variant="secondary" disabled={busy} onClick={() => void setStatus(u, "IN_SERVICE")} className="min-h-[2.75rem] px-4 py-2 text-sm">
                      Mark in-service
                    </Btn>
                  ) : null}
                  <Link href={`/demos/new`}>
                    <Btn variant="ghost" className="min-h-[2.75rem] px-4 py-2 text-sm">
                      New demo →
                    </Btn>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
