/**
 * Seed script: creates the first admin from ADMIN_NAME / ADMIN_PIN env vars.
 * Creates nothing else — no fake demo data. Safe to run multiple times:
 * it does nothing when any user already exists.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log("Users already exist — nothing to seed.");
    return;
  }
  const name = (process.env.ADMIN_NAME ?? "").trim();
  const pin = (process.env.ADMIN_PIN ?? "").trim();
  if (!name || !pin) {
    console.log("ADMIN_NAME and ADMIN_PIN are not set — skipping admin creation.");
    return;
  }
  const pinHash = await bcrypt.hash(pin, 12);
  await prisma.user.create({ data: { name, pinHash, role: "ADMIN", active: true } });
  console.log(`Created admin user "${name}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
