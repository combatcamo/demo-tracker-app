"use client";

import { useRef, useState } from "react";
import { Btn, inputCls } from "./ui";
import { compressImage } from "./PhotoInput";

export interface PlateScanResult {
  model: string;
  serial: string;
  photoDataUrl: string;
}

/** Best-effort extraction of model + serial from OCR'd plate text. */
function extractPlate(text: string): { model: string; serial: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let serial = "";
  let model = "";

  const serialRe =
    /(?:SERIAL|S\/N|SER\.?\s*NO\.?|PIN|PRODUCT\s*ID|MFG\.?\s*NO\.?)\s*(?:NO\.?|NUMBER|#)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-/]{3,25})/i;
  for (const line of lines) {
    const m = serialRe.exec(line);
    if (m) {
      serial = m[1].toUpperCase();
      break;
    }
  }

  const modelRe =
    /(?:MODEL|MOD\.?\s*NO\.?|TYPE)\s*(?:NO\.?|NUMBER|#)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9 \-/\.]{1,24})/i;
  for (const line of lines) {
    const m = modelRe.exec(line);
    if (m) {
      model = m[1].trim().toUpperCase();
      break;
    }
  }

  if (!serial) {
    const tokens = text.match(/[A-Z0-9][A-Z0-9\-/]{4,25}/gi) ?? [];
    const cleaned = tokens.map((t) => t.toUpperCase()).sort((a, b) => b.length - a.length);
    serial = cleaned[0] ?? "";
  }
  if (!model) {
    const cand = lines.find((l) => /[A-Z]/i.test(l) && /\d/.test(l) && l.length <= 24);
    model = (cand ?? "").toUpperCase();
  }
  return { model, serial };
}

type Stage = "idle" | "reading" | "confirm";

/**
 * Serial-plate scanner: take a photo with the camera or pick one from the
 * photo library, run OCR on-device (Tesseract.js, no cloud), then let the
 * employee confirm/correct the extracted model + serial before they are used.
 */
export default function SerialPlateScanner({
  onConfirm,
}: {
  onConfirm: (r: PlateScanResult) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }
    setError(null);
    setStage("reading");
    try {
      const dataUrl = await compressImage(file);
      setPreview(dataUrl);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      try {
        const { data } = await worker.recognize(dataUrl);
        const { model: m, serial: s } = extractPlate(data.text ?? "");
        setModel(m);
        setSerial(s);
        setStage("confirm");
      } finally {
        await worker.terminate();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the plate. Try again with a clearer photo.");
      setStage("idle");
      setPreview(null);
    }
  };

  const reset = () => {
    setStage("idle");
    setPreview(null);
    setModel("");
    setSerial("");
    setError(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
  };

  const confirm = () => {
    if (!preview) return;
    onConfirm({ model: model.trim(), serial: serial.trim(), photoDataUrl: preview });
    reset();
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
      {/* Hidden inputs: camera forces the camera, library shows the picker */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {stage === "idle" ? (
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="secondary" onClick={() => cameraRef.current?.click()} className="w-full">
            📷 Take photo
          </Btn>
          <Btn variant="secondary" onClick={() => libraryRef.current?.click()} className="w-full">
            🖼️ From library
          </Btn>
        </div>
      ) : null}

      {stage === "reading" ? (
        <div className="flex items-center gap-3 py-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Serial plate" className="h-20 w-20 rounded-xl object-cover" />
          ) : null}
          <p className="text-sm font-semibold text-gray-700">Reading the plate…</p>
        </div>
      ) : null}

      {stage === "confirm" && preview ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Serial plate" className="mb-3 max-h-48 w-full rounded-xl object-contain bg-black" />
          <p className="mb-2 text-sm text-gray-600">
            Check what the scan read — fix anything it got wrong, then use the values.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700">Model</span>
              <input value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} placeholder="e.g. UTG T5" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700">Serial number</span>
              <input value={serial} onChange={(e) => setSerial(e.target.value)} className={inputCls} placeholder="e.g. 8573204" />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Btn onClick={confirm} disabled={!serial.trim()} className="w-full">
              Use these values
            </Btn>
            <Btn variant="secondary" onClick={reset} className="w-full">
              Retake
            </Btn>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
