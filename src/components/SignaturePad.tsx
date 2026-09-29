"use client";

import { useEffect, useRef, useState } from "react";
import { Btn } from "./ui";

/**
 * Canvas signature pad. Calls onChange with a PNG data URL whenever the
 * signature changes (or null when cleared). Parent must reset via `resetKey`.
 */
export default function SignaturePad({
  onChange,
  resetKey,
}: {
  onChange: (dataUrl: string | null) => void;
  resetKey?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [empty, setEmpty] = useState(true);

  const setup = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(220 * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
  };

  useEffect(() => {
    setup();
    const onResize = () => {
      if (!hasInk.current) setup();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resetKey === undefined) return;
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const emit = () => {
    const canvas = canvasRef.current!;
    if (hasInk.current) {
      onChange(canvas.toDataURL("image/png"));
      setEmpty(false);
    } else {
      onChange(null);
      setEmpty(true);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onChange(null);
    setEmpty(true);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white touch-none">
        <canvas
          ref={canvasRef}
          className="h-[220px] w-full cursor-crosshair"
          onPointerDown={(e) => {
            drawing.current = true;
            hasInk.current = true;
            const ctx = canvasRef.current!.getContext("2d")!;
            const p = pos(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = canvasRef.current!.getContext("2d")!;
            const p = pos(e);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }}
          onPointerUp={() => {
            drawing.current = false;
            emit();
          }}
          onPointerCancel={() => {
            drawing.current = false;
            emit();
          }}
        />
        {empty ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-gray-400">Sign here with your finger or mouse</span>
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex justify-end">
        <Btn variant="secondary" onClick={clear} className="min-h-[2.5rem] px-4 py-2 text-sm">
          Clear signature
        </Btn>
      </div>
    </div>
  );
}
