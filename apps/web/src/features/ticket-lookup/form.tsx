'use client';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { components } from '@sorteos/api-client';
import { Alert, Button, Card, Input } from '@/components/ui';
import { ticketLookupApi } from './api';
type Schemas=components['schemas'];
const orderLabels:Record<Schemas['TicketLookupPersonDto']['orderStatus'],string>={
  PENDING_REVIEW:'Pendiente de revisión',UNDER_REVIEW:'En revisión',NEEDS_RESOLUTION:'Requiere resolución',PAID:'Pago confirmado',
};
export function TicketLookup({baseUrl}:{baseUrl:string}) {
  const api=useMemo(()=>ticketLookupApi(baseUrl),[baseUrl]);
  const [raffles,setRaffles]=useState<Schemas['LookupRafflesDto']|null>(null);
  const [rafflePage,setRafflePage]=useState(1),[raffleId,setRaffleId]=useState(''),[phone,setPhone]=useState('');
  const [result,setResult]=useState<Schemas['TicketLookupResultDto']|null>(null),[page,setPage]=useState(1);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loadError,setLoadError]=useState(false),[revision,setRevision]=useState(0);
  const flight=useRef(false),generation=useRef(0);
  useEffect(()=>{
    let active=true;
    api.raffles(rafflePage).then(data=>{if(active){setRaffles(data);setLoadError(false);}})
      .catch(()=>{if(active)setLoadError(true);});
    return ()=>{active=false;};
  },[api,rafflePage,revision]);
  function clear(){generation.current++;setResult(null);setError('');setPage(1);}
  async function search(nextPage:number) {
    if(flight.current)return;
    flight.current=true;setBusy(true);setError('');setResult(null);
    const current=generation.current;
    try {
      const data=await api.search(raffleId,phone,nextPage);
      if(current===generation.current){setResult(data);setPage(nextPage);}
    }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'No se pudo realizar la consulta.');}
    finally{flight.current=false;setBusy(false);}
  }
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();void search(1);}
  return <div className="lookup-layout">
    <Card><h2>Busca tu registro</h2>
      <p>Selecciona la rifa e introduce el teléfono utilizado en la compra.</p>
      {loadError?<Alert title="No se pudieron cargar las rifas" tone="error"><Button onClick={()=>{setLoadError(false);setRevision(n=>n+1);}}>Reintentar</Button></Alert>
        :!raffles?<p role="status">Cargando rifas…</p>
        :!raffles.total?<p>No hay rifas para consultar.</p>
        :<><form className="lookup-form" onSubmit={submit}><fieldset disabled={busy}>
          <label className="field">Rifa<select required aria-label="Rifa" value={raffleId} onChange={event=>{clear();setRaffleId(event.target.value);}}>
            <option value="">Selecciona una rifa</option>{raffles.items.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}
          </select></label>
          <Input id="lookup-phone" label="Teléfono de la compra" type="tel" autoComplete="tel" inputMode="tel" required maxLength={40} value={phone} onChange={event=>{clear();setPhone(event.target.value);}} hint="Número dominicano de diez cifras o número internacional con + y código de país." />
          <Button disabled={busy||!raffleId||!phone.trim()}>{busy?'Buscando…':'Buscar registro'}</Button>
        </fieldset></form>
        {raffles.total>12&&<div className="lookup-pagination"><Button disabled={busy||rafflePage===1} onClick={()=>{clear();setRaffleId('');setRaffles(null);setRafflePage(p=>p-1);}}>Rifas anteriores</Button><span>Página {rafflePage}</span><Button disabled={busy||rafflePage*12>=raffles.total} onClick={()=>{clear();setRaffleId('');setRaffles(null);setRafflePage(p=>p+1);}}>Más rifas</Button></div>}</>}
    </Card>
    {busy&&<p role="status">Consultando registros…</p>}
    {error&&<Alert title="No se pudo consultar" tone="error">{error}</Alert>}
    {result&&<section aria-label="Resultado de la búsqueda" aria-live="polite"><Card>
      <h2>Registro de boletos</h2>
      {!result.total?<p>No encontramos boletos registrados con ese teléfono en esta rifa.</p>:<>
        <p><strong>{result.totalTickets}</strong> boletos registrados.</p>
        <p>Incluye órdenes pendientes de revisión y pagadas. No incluye órdenes canceladas; el registro no confirma el pago.</p>
        <ul className="lookup-results">{result.items.map((person,index)=><li key={index}><dl>
          <div><dt>Nombre</dt><dd>{person.maskedName}</dd></div>
          <div><dt>Correo</dt><dd style={{overflowWrap:'anywhere'}}>{person.maskedEmail??'No registrado'}</dd></div>
          <div><dt>Boletos registrados</dt><dd>{person.ticketCount}</dd></div>
          <div><dt>Estado de la orden</dt><dd>{orderLabels[person.orderStatus]??'Estado no disponible'}</dd></div>
        </dl></li>)}</ul>
        {result.total>12&&<div className="lookup-pagination"><Button disabled={busy||page===1} onClick={()=>void search(page-1)}>Anteriores</Button><span>Página {page}</span><Button disabled={busy||page*12>=result.total} onClick={()=>void search(page+1)}>Siguientes</Button></div>}
      </>}
    </Card></section>}
  </div>;
}
