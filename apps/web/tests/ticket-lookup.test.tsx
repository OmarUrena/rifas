import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { TicketLookup } from '@/features/ticket-lookup/form';
const mocks=vi.hoisted(()=>({raffles:vi.fn(),search:vi.fn()}));
vi.mock('@/features/ticket-lookup/api',()=>({ticketLookupApi:()=>mocks}));
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.raffles.mockResolvedValue({items:[{id:'raffle',title:'RIFA DEMO'}],total:1});
  mocks.search.mockResolvedValue({items:[{maskedName:'CLIENT******',maskedEmail:'de**@example********',ticketCount:3,orderStatus:'PENDING_REVIEW'}],total:1,totalTickets:3});
});
async function fill(){await screen.findByRole('option',{name:'RIFA DEMO'});fireEvent.change(screen.getByLabelText('Rifa'),{target:{value:'raffle'}});fireEvent.change(screen.getByLabelText('Teléfono de la compra'),{target:{value:'8095550100'}});}
test('consulta muestra solamente el resumen censurado sin solicitar código',async()=>{
  render(<TicketLookup baseUrl="http://localhost:3001/api/v1"/>);await fill();
  fireEvent.click(screen.getByRole('button',{name:'Buscar registro'}));
  await screen.findByText('CLIENT******');
  expect(screen.getByText('de**@example********')).toBeInTheDocument();
  expect(screen.getByText('Pendiente de revisión')).toBeInTheDocument();
  expect(screen.getByText(/Incluye órdenes pendientes/)).toBeInTheDocument();
  expect(mocks.search).toHaveBeenCalledWith('raffle','8095550100',1);
  expect(screen.queryByLabelText(/código/i)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Teléfono de la compra'),{target:{value:'8295550100'}});
  expect(screen.queryByText('CLIENT******')).not.toBeInTheDocument();
});
test('sin coincidencias y correo ausente son estados reales',async()=>{
  mocks.search.mockResolvedValueOnce({items:[],total:0,totalTickets:0});
  render(<TicketLookup baseUrl="http://localhost:3001/api/v1"/>);await fill();fireEvent.click(screen.getByRole('button',{name:'Buscar registro'}));
  await screen.findByText(/No encontramos boletos/);
  mocks.search.mockResolvedValueOnce({items:[{maskedName:'DE**',maskedEmail:null,ticketCount:1,orderStatus:'PAID'}],total:1,totalTickets:1});
  fireEvent.click(screen.getByRole('button',{name:'Buscar registro'}));await screen.findByText('No registrado');
  expect(screen.getByText('Pago confirmado')).toBeInTheDocument();
});
test('errores y doble clic no fingen resultados ni envían consultas duplicadas',async()=>{
  let reject!:(reason:Error)=>void;
  mocks.search.mockImplementationOnce(()=>new Promise((_resolve,rejection)=>{reject=rejection;}));
  render(<TicketLookup baseUrl="http://localhost:3001/api/v1"/>);await fill();
  const button=screen.getByRole('button',{name:'Buscar registro'});
  fireEvent.click(button);fireEvent.submit(button.closest('form')!);
  expect(mocks.search).toHaveBeenCalledTimes(1);
  reject(new Error('Espera antes de volver a buscar.'));
  await screen.findByText('Espera antes de volver a buscar.');
  expect(screen.queryByText('Registro de boletos')).not.toBeInTheDocument();
});
test('permite volver a intentar la carga inicial',async()=>{
  mocks.raffles.mockRejectedValueOnce(new Error('offline'));
  render(<TicketLookup baseUrl="http://localhost:3001/api/v1"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Reintentar'}));
  await waitFor(()=>expect(screen.getByRole('option',{name:'RIFA DEMO'})).toBeInTheDocument());
});
