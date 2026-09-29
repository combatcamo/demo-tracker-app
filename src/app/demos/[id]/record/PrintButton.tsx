"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        background: "#ea580c",
        color: "#fff",
        border: 0,
        borderRadius: 12,
        padding: "12px 24px",
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Print
    </button>
  );
}
