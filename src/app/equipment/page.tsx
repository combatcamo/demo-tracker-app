import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import EquipmentClient from "./EquipmentClient";

export const dynamic = "force-dynamic";

export interface UnitView {
  id: string;
  name: string;
  category: string;
  serial: string;
  status: string;
  notes: string | null;
  holder: { customerCompany: string; repName: string; expectedReturnDate: Date; status: string } | null;
  qrDataUrl: string;
}

export default async function EquipmentPage() {
  await requirePageUser();
  const units = await prisma.equipmentUnit.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      demos: {
        where: { status: { in: ["SCHEDULED", "OUT_ON_DEMO"] } },
        orderBy: { checkoutDate: "asc" },
        take: 1,
        select: {
          status: true,
          expectedReturnDate: true,
          customerCompany: true,
          rep: { select: { name: true } },
        },
      },
    },
  });

  const categories = [...new Set(units.map((u) => u.category))].sort();

  const views: UnitView[] = await Promise.all(
    units.map(async (u) => ({
      id: u.id,
      name: u.name,
      category: u.category,
      serial: u.serial,
      status: u.status,
      notes: u.notes,
      holder: u.demos[0]
        ? {
            customerCompany: u.demos[0].customerCompany,
            repName: u.demos[0].rep.name,
            expectedReturnDate: u.demos[0].expectedReturnDate,
            status: u.demos[0].status,
          }
        : null,
      qrDataUrl: await QRCode.toDataURL(JSON.stringify({ t: "dw-unit", id: u.id }), {
        width: 220,
        margin: 1,
      }),
    }))
  );

  return (
    <div>
      {/* Printable QR tag sheet */}
      <div className="hidden print:block">
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>Unit QR Tags — Demo Tracker</h1>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {views.map((u) => (
            <div
              key={u.id}
              style={{ border: "2px solid #000", borderRadius: 12, padding: 16, textAlign: "center", breakInside: "avoid" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.qrDataUrl} alt={`QR for ${u.name}`} style={{ width: 160, height: 160, margin: "0 auto" }} />
              <p style={{ fontWeight: 800, marginTop: 8 }}>{u.name}</p>
              <p>Serial: {u.serial}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="print:hidden">
        <EquipmentClient initialUnits={views} categories={categories} />
      </div>
    </div>
  );
}
