"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui";

export default function MarkInvoicedButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Btn
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Mark “${label}” as invoiced?`)) return;
        setBusy(true);
        await fetch(`/api/sold/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiced: true }),
        });
        setBusy(false);
        router.refresh();
      }}
      className="min-h-[2.75rem] px-4 py-2 text-sm"
    >
      {busy ? "Saving…" : "Mark invoiced"}
    </Btn>
  );
}
