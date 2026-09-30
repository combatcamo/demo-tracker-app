"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PageTitle, Card, Field, inputCls, Btn } from "@/components/ui";
import SignaturePad from "@/components/SignaturePad";
import FinditLookup from "@/components/FinditLookup";
import PhotoInput, { type PickedPhoto } from "@/components/PhotoInput";
import SerialPlateScanner, { type PlateScanResult } from "@/components/SerialPlateScanner";

const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

interface Rep {
  id: string;
  name: string;
}

interface FreeUnit {
  id: string;
  name: string;
  category: string;
  serial: string;
  status: string;
}

const CONDITIONS = [
  { v: "NEW", label: "New" },
  { v: "USED", label: "Used" },
  { v: "DAMAGED", label: "Damaged" },
  { v: "FOR_SALE", label: "For sale" },
];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const ACK_TEXT =
  "I acknowledge that I am responsible for the demo equipment listed above while it is in my care. " +
  "I will return it by the expected return date in the same condition it was received, ordinary demo wear excepted. " +
  "I understand I am responsible for damage, loss, or theft beyond ordinary wear.";

export default function NewDemoForm(props: {
  reps: Rep[];
  categories: string[];
  defaultRepId: string;
}) {
  // Remount the whole form after each successful submit so the next demo
  // ALWAYS starts blank (never carries the previous signature/photos over).
  const [formKey, setFormKey] = useState(0);
  return <NewDemoFormInner key={formKey} {...props} onSubmitted={() => setFormKey((k) => k + 1)} />;
}

function NewDemoFormInner({
  reps,
  categories,
  defaultRepId,
  onSubmitted,
}: {
  reps: Rep[];
  categories: string[];
  defaultRepId: string;
  onSubmitted: () => void;
}) {
  const router = useRouter();

  const [repId, setRepId] = useState(defaultRepId);
  const [checkoutDate, setCheckoutDate] = useState(todayStr());
  const [expectedReturnDate, setExpectedReturnDate] = useState(plusDaysStr(7));
  const [pickupAtBranch, setPickupAtBranch] = useState(false);
  const [deliverToCustomer, setDeliverToCustomer] = useState(false);
  const [customerReturnsToBranch, setCustomerReturnsToBranch] = useState(false);

  const [customerCompany, setCustomerCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [category, setCategory] = useState("");
  const [unitQuery, setUnitQuery] = useState("");
  const [freeUnits, setFreeUnits] = useState<FreeUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const [conditionOut, setConditionOut] = useState("NEW");
  const [hoursOut, setHoursOut] = useState("");
  const [customerIdVerified, setCustomerIdVerified] = useState(false);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [platePhoto, setPlatePhoto] = useState<PickedPhoto | null>(null);
  const [plateRead, setPlateRead] = useState<{ model: string; serial: string } | null>(null);
  const [showPlateScan, setShowPlateScan] = useState(false);
  const [outNotes, setOutNotes] = useState("");
  const [reminderDaysBefore, setReminderDaysBefore] = useState(3);
  const [includeResponsibilityRecord, setIncludeResponsibilityRecord] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const [signature, setSignature] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFreeUnits = useCallback(async () => {
    if (!checkoutDate || !expectedReturnDate) return;
    setUnitsLoading(true);
    try {
      const p = new URLSearchParams({ from: checkoutDate, to: expectedReturnDate });
      if (category) p.set("category", category);
      if (unitQuery.trim()) p.set("q", unitQuery.trim());
      const res = await fetch(`/api/equipment/available?${p.toString()}`);
      const data = (await res.json()) as { units?: FreeUnit[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load units");
      const units = data.units ?? [];
      setFreeUnits(units);
      if (unitId && !units.some((u) => u.id === unitId)) setUnitId("");
    } catch (e) {
      setFreeUnits([]);
      if (unitId) setUnitId("");
      void e;
    } finally {
      setUnitsLoading(false);
    }
  }, [checkoutDate, expectedReturnDate, category, unitQuery, unitId]);

  useEffect(() => {
    const t = setTimeout(() => void loadFreeUnits(), 300);
    return () => clearTimeout(t);
  }, [loadFreeUnits]);

  useEffect(() => {
    const refresh = () => void loadFreeUnits();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [loadFreeUnits]);

  const handleScan = (text: string) => {
    setScanning(false);
    let id: string | null = null;
    try {
      const parsed = JSON.parse(text) as { t?: string; id?: string };
      if (parsed && parsed.t === "dw-unit" && typeof parsed.id === "string") id = parsed.id;
    } catch {
      id = null;
    }
    if (!id) {
      setScanMsg("That QR code is not a Demo Tracker unit tag.");
      return;
    }
    const found = freeUnits.find((u) => u.id === id);
    if (found) {
      setUnitId(found.id);
      setScanMsg(`Selected ${found.name} (${found.serial}).`);
    } else {
      setScanMsg("That unit is not available for the selected dates.");
    }
  };

  const selectedUnit = freeUnits.find((u) => u.id === unitId) ?? null;

  const handlePlateConfirm = (r: PlateScanResult) => {
    setShowPlateScan(false);
    setPlateRead({ model: r.model, serial: r.serial });
    setPlatePhoto({
      id: `plate-${Date.now()}`,
      dataUrl: r.photoDataUrl,
      name: "serial-plate.jpg",
    });
    // Narrow the unit list to the scanned serial; the effect below
    // auto-selects when there is an exact match.
    if (r.serial) setUnitQuery(r.serial);
  };

  // Auto-select the unit when a plate scan yields an exact serial match.
  useEffect(() => {
    if (plateRead && plateRead.serial && freeUnits.length > 0 && !unitId) {
      const match = freeUnits.find(
        (u) => u.serial.toLowerCase() === plateRead.serial.toLowerCase()
      );
      if (match) setUnitId(match.id);
    }
  }, [plateRead, freeUnits, unitId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signature) {
      setError("A customer signature is required before checking a unit out.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/demos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repId,
          checkoutDate,
          expectedReturnDate,
          pickupAtBranch,
          deliverToCustomer,
          customerReturnsToBranch,
          customerCompany,
          contactName,
          contactPhone,
          deliveryAddress,
          unitId,
          conditionOut,
          hoursOut,
          customerIdVerified,
          outNotes,
          reminderDaysBefore,
          includeResponsibilityRecord,
          signatureData: signature,
          photosOut: photos.map((p) => ({ dataUrl: p.dataUrl })),
          serialPlatePhoto: platePhoto ? platePhoto.dataUrl : null,
        }),
      });
      const data = (await res.json()) as { error?: string; demo?: { id: string } };
      if (!res.ok) throw new Error(data.error ?? "Could not save the demo");
      const demoId = data.demo!.id;
      onSubmitted(); // blank slate for the next demo
      router.push(`/demos/${demoId}`);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not save the demo");
    } finally {
      setBusy(false);
    }
  };

  const checkCls = "h-6 w-6 shrink-0 rounded accent-orange-600";

  return (
    <div>
      <PageTitle title="New Demo" sub="Check a unit out to a customer." />
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <h2 className="mb-3 text-lg font-bold">Scheduling</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rep">
              <select value={repId} onChange={(e) => setRepId(e.target.value)} className={inputCls}>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <div />
            <Field label="Check-out date">
              <input
                type="date"
                value={checkoutDate}
                onChange={(e) => setCheckoutDate(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Expected return date">
              <input
                type="date"
                value={expectedReturnDate}
                min={checkoutDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
          </div>
          <div className="mt-4 space-y-3">
            {[
              { v: pickupAtBranch, s: setPickupAtBranch, t: "Customer picks up at branch" },
              { v: deliverToCustomer, s: setDeliverToCustomer, t: "We deliver to the customer" },
              { v: customerReturnsToBranch, s: setCustomerReturnsToBranch, t: "Customer delivers back to branch" },
            ].map((c) => (
              <label key={c.t} className="flex min-h-[3rem] items-center gap-3 text-base">
                <input type="checkbox" checked={c.v} onChange={(e) => c.s(e.target.checked)} className={checkCls} />
                {c.t}
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">Customer</h2>
          <FinditLookup kind="customers" onPick={r => {
            setCustomerCompany(r.name || "");
            setContactName(r.contact_name || "");
            setContactPhone(r.phone_number || "");
            setDeliveryAddress(r.address || "");
          }} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer company">
              <input value={customerCompany} onChange={(e) => setCustomerCompany(e.target.value)} className={inputCls} required />
            </Field>
            <Field label="Contact name">
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} required />
            </Field>
            <Field label="Contact phone">
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className={inputCls}
                inputMode="tel"
                required
              />
            </Field>
            <Field label="Delivery address">
              <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">Unit</h2>
          <p className="mb-3 text-sm"><a className="font-semibold text-orange-700 underline" href="/equipment" target="_blank" rel="noreferrer">FindIT equipment autofill: add a unit under Equipment</a>, then return here. All stores can be searched; FindIT serials are never changed.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Search name or serial">
              <input
                value={unitQuery}
                onChange={(e) => setUnitQuery(e.target.value)}
                className={inputCls}
                placeholder="e.g. UTG or 8573204"
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Only units free for the selected dates are listed — a unit can&apos;t be double-booked.
          </p>
          <div className="mt-3">
            {showPlateScan ? (
              <SerialPlateScanner onConfirm={handlePlateConfirm} />
            ) : (
              <Btn variant="secondary" onClick={() => setShowPlateScan(true)} className="w-full sm:w-auto">
                Scan serial plate
              </Btn>
            )}
            {plateRead ? (
              <div className="mt-2 flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3">
                {platePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={platePhoto.dataUrl} alt="Serial plate" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    Plate reads: {plateRead.model || "—"} · Serial {plateRead.serial || "—"}
                  </p>
                  {selectedUnit ? (
                    selectedUnit.serial.toLowerCase() === plateRead.serial.toLowerCase() ? (
                      <p className="text-sm font-semibold text-green-700">✓ Matches the selected unit.</p>
                    ) : (
                      <p className="text-sm font-semibold text-amber-700">
                        ⚠ Does not match the selected unit ({selectedUnit.serial}).
                      </p>
                    )
                  ) : (
                    <p className="text-sm text-gray-500">Pick the matching unit from the list below.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => { setPlateRead(null); setPlatePhoto(null); }}
                    className="mt-1 text-sm font-semibold text-orange-700 underline"
                  >
                    Clear scan
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="mt-3">
            {scanning ? (
              <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />
            ) : (
              <Btn variant="secondary" onClick={() => { setScanMsg(null); setScanning(true); }} className="w-full sm:w-auto">
                Scan unit QR code
              </Btn>
            )}
            {scanMsg ? <p className="mt-2 text-sm font-semibold text-gray-700">{scanMsg}</p> : null}
          </div>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {unitsLoading ? (
              <p className="text-sm text-gray-500">Loading available units…</p>
            ) : freeUnits.length === 0 ? (
              <p className="text-sm text-gray-500">
                No units are free for these dates. Try different dates, or add the unit under Equipment first.
              </p>
            ) : (
              freeUnits.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUnitId(u.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left ${
                    unitId === u.id ? "border-orange-600 bg-orange-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <span>
                    <span className="block font-bold">{u.name}</span>
                    <span className="block text-sm text-gray-500">
                      {u.category} · Serial {u.serial}
                    </span>
                  </span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                      unitId === u.id ? "border-orange-600 bg-orange-600 text-white" : "border-gray-300 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </button>
              ))
            )}
          </div>
          {selectedUnit ? (
            <p className="mt-2 text-sm font-semibold text-green-700">
              Selected: {selectedUnit.name} ({selectedUnit.serial})
            </p>
          ) : (
            <p className="mt-2 text-sm font-semibold text-red-600">Select a unit to continue.</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">Condition &amp; photos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Condition going out">
              <select value={conditionOut} onChange={(e) => setConditionOut(e.target.value)} className={inputCls}>
                {CONDITIONS.map((c) => (
                  <option key={c.v} value={c.v}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hours / mileage">
              <input value={hoursOut} onChange={(e) => setHoursOut(e.target.value)} className={inputCls} required placeholder="e.g. 412" />
            </Field>
          </div>
          <label className="mt-4 flex min-h-[3rem] items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={customerIdVerified}
              onChange={(e) => setCustomerIdVerified(e.target.checked)}
              className={checkCls}
            />
            Customer ID verified
          </label>
          <div className="mt-4">
            <PhotoInput value={photos} onChange={setPhotos} label="Condition photos (up to 6)" max={6} />
          </div>
          <div className="mt-4">
            <Field label="Out notes">
              <textarea value={outNotes} onChange={(e) => setOutNotes(e.target.value)} className={inputCls} rows={3} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Remind me before return">
              <select
                value={reminderDaysBefore}
                onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
                className={inputCls}
              >
                {[0, 1, 2, 3, 5, 7].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "Day of return" : `${n} day${n > 1 ? "s" : ""} before`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">Responsibility record</h2>
          <label className="flex min-h-[3rem] items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={includeResponsibilityRecord}
              onChange={(e) => setIncludeResponsibilityRecord(e.target.checked)}
              className={checkCls}
            />
            Include responsibility record with this demo
          </label>
          <Btn variant="ghost" onClick={() => setShowPreview((s) => !s)} className="mt-1 px-2">
            {showPreview ? "Hide preview" : "Preview responsibility record"}
          </Btn>
          {showPreview ? (
            <div className="mt-3 rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
              <p className="font-bold text-gray-900">Customer Responsibility Acknowledgment</p>
              <p className="mt-2">{ACK_TEXT}</p>
              <dl className="mt-3 space-y-1">
                <div className="flex gap-2"><dt className="font-semibold">Customer:</dt><dd>{customerCompany || "—"}</dd></div>
                <div className="flex gap-2"><dt className="font-semibold">Unit:</dt><dd>{selectedUnit ? `${selectedUnit.name} (${selectedUnit.serial})` : "—"}</dd></div>
                <div className="flex gap-2"><dt className="font-semibold">Dates:</dt><dd>{checkoutDate} → {expectedReturnDate}</dd></div>
              </dl>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg font-bold">Customer signature</h2>
          <SignaturePad onChange={setSignature} />
          {!signature ? <p className="mt-2 text-sm font-semibold text-red-600">Signature required.</p> : null}
        </Card>

        {error ? <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}

        <Btn type="submit" disabled={busy} className="w-full text-lg">
          {busy ? "Saving…" : "Check out unit"}
        </Btn>
      </form>
    </div>
  );
}
