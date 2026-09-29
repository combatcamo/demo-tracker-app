"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageTitle, Card, Field, inputCls, Btn, EmptyState } from "@/components/ui";
import { fmtDate } from "@/lib/demos";
import type { TeamUser } from "./page";

export default function TeamClient({ users, meId }: { users: TeamUser[]; meId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"ADMIN" | "REP">("REP");
  const [resetFor, setResetFor] = useState<TeamUser | null>(null);
  const [newPin, setNewPin] = useState("");

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin, role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add employee");
      setShowAdd(false);
      setName("");
      setPin("");
      setRole("REP");
      router.refresh();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not add employee");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (u: TeamUser, body: Record<string, unknown>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update");
      setResetFor(null);
      setNewPin("");
      router.refresh();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Team"
        sub="Who can sign in. Only admins see this page."
        action={<Btn onClick={() => setShowAdd((s) => !s)}>+ Add employee</Btn>}
      />
      {error ? <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

      {showAdd ? (
        <Card className="mb-4">
          <h2 className="mb-3 text-lg font-bold">Add employee</h2>
          <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required placeholder="e.g. Tanner Pinson" />
            </Field>
            <Field label="PIN (at least 4 characters)">
              <input value={pin} onChange={(e) => setPin(e.target.value)} className={inputCls} required minLength={4} inputMode="numeric" placeholder="They'll type this to sign in" />
            </Field>
            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "REP")} className={inputCls}>
                <option value="REP">Rep — can use the tracker</option>
                <option value="ADMIN">Admin — can also manage the team</option>
              </select>
            </Field>
            <div className="flex items-end gap-2">
              <Btn type="submit" disabled={busy}>{busy ? "Adding…" : "Add employee"}</Btn>
              <Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn>
            </div>
          </form>
        </Card>
      ) : null}

      {users.length === 0 ? (
        <EmptyState title="No employees yet" body="Add your first employee above." />
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className={u.active ? "" : "opacity-60"}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {u.name} {u.id === meId ? <span className="text-xs font-semibold text-gray-500">(you)</span> : null}
                  </p>
                  <p className="text-sm text-gray-500">
                    {u.role === "ADMIN" ? "Admin" : "Rep"} · Joined {fmtDate(u.createdAt)}
                    {!u.active ? " · Deactivated" : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                    u.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {u.active ? "Active" : "Inactive"}
                </span>
              </div>

              {resetFor?.id === u.id ? (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void patch(u, { pin: newPin });
                  }}
                >
                  <input
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className={inputCls}
                    placeholder="New PIN (min 4 chars)"
                    minLength={4}
                    required
                  />
                  <Btn type="submit" disabled={busy} className="shrink-0">Save PIN</Btn>
                  <Btn variant="secondary" onClick={() => { setResetFor(null); setNewPin(""); }} className="shrink-0">
                    Cancel
                  </Btn>
                </form>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn
                    variant="secondary"
                    disabled={busy}
                    onClick={() => { setResetFor(u); setNewPin(""); }}
                    className="min-h-[2.75rem] px-4 py-2 text-sm"
                  >
                    Reset PIN
                  </Btn>
                  {u.id !== meId ? (
                    u.active ? (
                      <Btn
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void patch(u, { active: false }, `Deactivate ${u.name}? They won't be able to sign in.`)}
                        className="min-h-[2.75rem] px-4 py-2 text-sm"
                      >
                        Deactivate
                      </Btn>
                    ) : (
                      <Btn
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void patch(u, { active: true })}
                        className="min-h-[2.75rem] px-4 py-2 text-sm"
                      >
                        Reactivate
                      </Btn>
                    )
                  ) : null}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
