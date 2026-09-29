"use client";

import { useRef, useState } from "react";
import { Btn } from "./ui";

export interface PickedPhoto {
  id: string;
  dataUrl: string;
  name: string;
}

/** Compress an image to max 1600px JPEG so uploads stay small on phones. */
export function compressImage(file: File): Promise<string> {
  return compress(file);
}

function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1600;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}

/** Photo picker with previews. Parent owns the list via value/onChange. */
export default function PhotoInput({
  value,
  onChange,
  label = "Photos",
  max = 10,
}: {
  value: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  label?: string;
  max?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const next = [...value];
      for (const f of Array.from(files).slice(0, Math.max(0, max - next.length))) {
        if (!f.type.startsWith("image/")) continue;
        const dataUrl = await compress(f);
        next.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, dataUrl, name: f.name });
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add photos");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void addFiles(e.target.files)}
      />
      {value.length > 0 ? (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {value.map((p) => (
            <div key={p.id} className="relative overflow-hidden rounded-xl border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.dataUrl} alt={p.name} className="h-24 w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(value.filter((x) => x.id !== p.id))}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-lg font-bold text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-sm text-gray-400">No photos yet</p>
      )}
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      <Btn variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()} className="w-full">
        {busy ? "Adding…" : "Upload photos"}
      </Btn>
    </div>
  );
}
