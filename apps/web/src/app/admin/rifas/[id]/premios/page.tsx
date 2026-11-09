import { notFound } from "next/navigation";
import { AdminFrame, AdminPageHeading } from "@/features/admin/frame";
import { PrizesWorkspace } from "@/features/admin/prizes";
import { requireAdmin } from "@/features/admin/server";
export const metadata = { title: "Premios y números bendecidos" };
export default async function PrizesPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(), { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  return <AdminFrame session={session}><AdminPageHeading section="Rifas" title="Premios y números bendecidos" description="Configura los premios antes de publicar y consulta sus beneficiarios." /><PrizesWorkspace id={id} role={session.role} /></AdminFrame>;
}
