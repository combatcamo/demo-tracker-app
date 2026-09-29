"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Field, inputCls, Btn } from "@/components/ui";
import PhotoInput, { type PickedPhoto } from "@/components/PhotoInput";

const CONDITION_IN = ["Returned as sent", "Normal wear", "Damaged", "Needs service"];

export default function DemoActions({
  demoId,
  status,
  customerCompany,
  followUpNote,
}: {
  demoId: string;
  status: string;
  customerCompany: string;
  followUpNote: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showFollowup, setShowFollowup] = useState(false);

  const [hoursIn, setHoursIn] = useState("");
  const [conditionIn, setConditionIn] = useState(CONDITION_IN[0]);
  const [returnNotes, setReturnNotes] = useState("");
  const [inPhotos, setInPhotos] = useState<PickedPhoto[]>([]);
  const [note, setNote] = useState(followUpNote ?? "");

  const call = async (url: string, body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const doCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await call(`/api/demos/${demoId}/checkin`, {
      hoursIn,
      conditionIn,
      returnNotes,
      photosIn: inPhotos.map((p) => ({ dataUrl: p.dataUrl })),
    });
    if (ok) {
      setShowCheckin(false);
      setInPhotos([]);
    }
  };

  const doFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await call(`/api/demos/${demoId}/followup`, { note });
    if (ok) setShowFollowup(false);
  };

  const open = status === "SCHEDULED" || status === "OUT_ON_DEMO";

  return (
    <div className="space-y-3">
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {status === "SCHEDULED" ? (
          <Btn
            disabled={busy}
            onClick={() => {
              if (confirm(`Mark this demo as out on demo for ${customerCompany}?`))
                void call(`/api/demos/${demoId}/status`, { to: "OUT_ON_DEMO" });
            }}
          >
            Start demo
          </Btn>
        ) : null}
        {open ? (
          <Btn disabled={busy} onClick={() => setShowCheckin((s) => !s)}>
            {showCheckin ? "Close check-in" : "Check in"}
          </Btn>
        ) : null}
        {open ? (
          <Btn
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (confirm(`Cancel this demo for ${customerCompany}? The unit will be freed up.`))
                void call(`/api/demos/${demoId}/status`, { to: "CANCELLED" });
            }}
          >
            Cancel demo
          </Btn>
        ) : null}
        <Btn variant="secondary" onClick={() => setShowFollowup((s) => !s)}>
          {followUpNote ? "Edit follow-up" : "Follow up"}
        </Btn>
      </div>

      {showCheckin && open ? (
        <Card>
          <h2 className="mb-3 text-lg font-bold">Check in unit</h2>
          <form onSubmit={doCheckin} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hours / mileage in">
                <input value={hoursIn} onChange={(e) => setHoursIn(e.target.value)} className={inputCls} placeholder="e.g. 438" />
              </Field>
              <Field label="Condition in">
                <select value={conditionIn} onChange={(e) => setConditionIn(e.target.value)} className={inputCls}>
                  {CONDITION_IN.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Return notes">
              <textarea value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} className={inputCls} rows={3} />
            </Field>
            <PhotoInput value={inPhotos} onChange={setInPhotos} label="Return photos" />
            <Btn type="submit" disabled={busy} className="w-full">
              {busy ? "Checking in…" : "Complete check-in"}
            </Btn>
          </form>
        </Card>
      ) : null}

      {showFollowup ? (
        <Card>
          <h2 className="mb-3 text-lg font-bold">Follow-up</h2>
          <form onSubmit={doFollowup} className="space-y-3">
            <Field label="Follow-up note">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={inputCls}
                rows={3}
                placeholder="e.g. Called 9/30 — loves the unit, wants pricing next week."
              />
            </Field>
            <Btn type="submit" disabled={busy || !note.trim()}>
              {busy ? "Saving…" : "Save follow-up"}
            </Btn>
          </form>
        </Card>
      ) : followUpNote ? (
        <Card>
          <h2 className="mb-1 text-lg font-bold">Follow-up</h2>
          <p className="whitespace-pre-wrap text-sm">{followUpNote}</p>
        </Card>
      ) : null}
    </div>
  );
}
