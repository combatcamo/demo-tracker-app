import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import { fmtDate } from "@/lib/demos";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

const ACK_TEXT =
  "I acknowledge that I am responsible for the demo equipment listed above while it is in my care. " +
  "I will return it by the expected return date in the same condition it was received, ordinary demo wear excepted. " +
  "I understand I am responsible for damage, loss, or theft beyond ordinary wear.";

/** Printable responsibility record. Uses the browser print dialog. */
export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;
  const demo = await prisma.demo.findUnique({
    where: { id },
    include: { unit: true, rep: { select: { name: true } } },
  });
  if (!demo) notFound();

  const row = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #ddd" }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <PrintButton />
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Signed Responsibility Record</h1>
      <p style={{ color: "#555" }}>Ditch Witch of Arkansas — Little Rock Branch</p>
      <div style={{ marginTop: 16 }}>
        {row("Customer", demo.customerCompany)}
        {row("Contact", `${demo.contactName} · ${demo.contactPhone}`)}
        {demo.deliveryAddress ? row("Delivery address", demo.deliveryAddress) : null}
        {row("Unit", `${demo.unit.name} (${demo.unit.category})`)}
        {row("Serial number", demo.unit.serial)}
        {row("Date out", fmtDate(demo.checkoutDate))}
        {row("Expected return", fmtDate(demo.expectedReturnDate))}
        {row("Branch employee", demo.rep.name)}
        {row("Condition out", demo.conditionOut.replace("_", " "))}
        {row("Hours/mileage out", demo.hoursOut)}
      </div>
      <h2 style={{ marginTop: 24, fontSize: 18, fontWeight: 700 }}>Customer Responsibility Acknowledgment</h2>
      <p style={{ lineHeight: 1.6 }}>{ACK_TEXT}</p>
      <div style={{ marginTop: 24 }}>
        <p style={{ fontWeight: 600 }}>Customer signature</p>
        {demo.signatureData ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={demo.signatureData} alt="Customer signature" style={{ maxWidth: 320, border: "1px solid #ddd", borderRadius: 8, marginTop: 8 }} />
        ) : (
          <p>No signature captured.</p>
        )}
        {demo.signatureDate ? (
          <p style={{ color: "#555", marginTop: 8 }}>Signed {fmtDate(demo.signatureDate)}</p>
        ) : null}
      </div>
    </div>
  );
}
