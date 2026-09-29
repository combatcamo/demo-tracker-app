"use client";

import { useEffect, useRef, useState } from "react";
import { Btn } from "./ui";

/**
 * Camera QR scanner. Rendered only on the client (dynamic import, ssr: false).
 * Calls onScan with the decoded text. Parent shows/hides this component.
 */
export default function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const regionId = useRef(`qr-${Math.random().toString(36).slice(2)}`);
  const [error, setError] = useState<string | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let scanner: { clear(): void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const s = new Html5Qrcode(regionId.current);
        scanner = s;
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            onScanRef.current(decoded);
          },
          () => undefined
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Camera unavailable");
      }
    })();
    return () => {
      cancelled = true;
      if (scanner) void Promise.resolve(scanner.clear()).catch(() => undefined);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-gray-200 bg-black p-2">
      <div id={regionId.current} className="overflow-hidden rounded-xl" />
      {error ? <p className="p-3 text-sm text-red-300">{error}</p> : null}
      <div className="p-2">
        <Btn variant="secondary" onClick={onClose} className="w-full">
          Cancel scan
        </Btn>
      </div>
    </div>
  );
}
