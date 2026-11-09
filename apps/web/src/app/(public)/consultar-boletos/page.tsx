import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Alert, SectionContainer } from '@/components/ui';
import { TicketLookup } from '@/features/ticket-lookup/form';
import { readEnvironment } from '@/lib/config';
export const metadata:Metadata={title:'Consultar mis boletos',robots:{index:false,follow:false}};
export default async function TicketLookupPage() {
  await connection();
  const {mode,apiBaseUrl}=readEnvironment(process.env);
  return <SectionContainer className="section"><h1>Consultar mis boletos</h1>
    <p>Consulta la cantidad registrada con tu teléfono. El nombre y el correo aparecen parcialmente censurados.</p>
    {mode==='live'&&apiBaseUrl?<TicketLookup baseUrl={apiBaseUrl}/>:<Alert title="Consulta no disponible">La búsqueda requiere conexión con el servicio. Inténtalo más tarde.</Alert>}
  </SectionContainer>;
}
