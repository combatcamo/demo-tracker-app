import { prisma } from "@/lib/prisma";
import { requirePageUser } from "@/lib/auth";
import NewDemoForm from "./NewDemoForm";

export const dynamic = "force-dynamic";

export default async function NewDemoPage() {
  const me = await requirePageUser();
  const reps = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const categories = await prisma.equipmentUnit.findMany({
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return (
    <NewDemoForm
      reps={reps}
      categories={categories.map((c) => c.category)}
      defaultRepId={me.id}
    />
  );
}
