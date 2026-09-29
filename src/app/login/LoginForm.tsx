"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, inputCls, Btn } from "@/components/ui";

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed");
        return;
      }
      router.push(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Your name">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="username"
          placeholder="e.g. Tanner Pinson"
        />
      </Field>
      <Field label="PIN">
        <input
          className={inputCls}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoComplete="current-password"
          placeholder="Your PIN"
        />
      </Field>
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      <Btn type="submit" disabled={busy || !name.trim() || !pin} className="w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Btn>
      <p className="text-center text-xs text-gray-500">
        First time here? Your manager sets up your name and PIN under Team.
      </p>
    </form>
  );
}
