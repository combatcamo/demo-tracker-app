import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import TeamClient from "./TeamClient";

export const dynamic = "force-dynamic";

export interface TeamUser {
  id: string;
  name: string;
  role: "ADMIN" | "REP";
  active: boolean;
  createdAt: string;
}

export default async function TeamPage() {
  const me = await requirePageUser();
  if (me.role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, active: true, createdAt: true },
  });
  const views: TeamUser[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
  }));
  return <TeamClient users={views} meId={me.id} />;
}
