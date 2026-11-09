import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { RaffleCard } from '@/features/raffles/components';
import { salesOpen } from '@/features/raffles/types';
import { demoRaffles } from '@/fixtures/catalog';
import { OrderSummary } from '@/features/orders/confirmation';
import type { Order } from '@/features/orders/api';
test('Comprar lleva a la participación sin crear una reserva y no depende del 100%',()=>{
  render(<RaffleCard raffle={{...demoRaffles[0]!,demo:false,canPurchase:true,progressPercent:100}}/>);
  expect(screen.getByRole('link',{name:'Comprar'})).toHaveAttribute('href',`/rifas/${demoRaffles[0]!.slug}#participacion`);
  expect(screen.queryByText('Ver detalles')).not.toBeInTheDocument();
});
test.each(['PAUSED','CLOSED','DRAWN'] as const)('no ofrece Comprar con estado %s',status=>{
  render(<RaffleCard raffle={{...demoRaffles[0]!,demo:false,status,canPurchase:false}}/>);
  expect(screen.queryByRole('link',{name:'Comprar'})).not.toBeInTheDocument();
  expect(screen.getByRole('button')).toBeDisabled();
});
test('respeta la proyección de API, el mínimo y la ventana de ventas',()=>{
  const raffle={...demoRaffles[0]!,demo:false,canPurchase:true};
  expect(salesOpen({...raffle,canPurchase:false})).toBe(false);
  expect(salesOpen({...raffle,available:1,minPurchase:2})).toBe(false);
  expect(salesOpen({...raffle,startsAt:new Date(Date.now()+60000).toISOString()})).toBe(false);
  expect(salesOpen({...raffle,endsAt:new Date(Date.now()-60000).toISOString()})).toBe(false);
});
test('confirmación prioriza números y conserva resumen sin afirmar pago pendiente como pagado',()=>{
  const order:Order={blessedAwards:[],orderCode:'RF-DEMO000000000001',status:'PENDING_REVIEW',paymentReportStatus:'REPORTED',raffleId:'demo',raffleTitle:'DEMO',quantity:1,ticketNumbers:['00001'],totalMinor:10025,currency:'DOP',createdAt:'2026-11-01T12:00:00Z',message:''};
  const {rerender}=render(<OrderSummary order={order}/>);
  expect(screen.getByRole('heading',{name:'Orden recibida'})).toBeInTheDocument();
  expect(screen.getByText('Pago pendiente de revisión')).toBeInTheDocument();
  expect(screen.getByRole('list',{name:'Números asignados a la orden'})).toHaveTextContent('00001');
  expect(screen.getByText('Ver resumen de la orden').closest('details')).not.toHaveAttribute('open');
  expect(screen.queryByRole('heading',{name:'Pago confirmado'})).not.toBeInTheDocument();
  rerender(<OrderSummary order={{...order,status:'PAID',paymentReportStatus:'VERIFIED'}}/>);
  expect(screen.getByRole('heading',{name:'Pago confirmado'})).toBeInTheDocument();
});
