import { prisma } from "./prisma";

export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: string
): Promise<void> {
  await prisma.auditLog.create({
    data: { userId, action, entityType, entityId, details: details ?? null },
  });
}
