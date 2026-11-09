import { PoolClient } from 'pg';
import { BlessedAwardDto, BlessedNumberDto } from './prizes.dto';

// Old schemas cannot contain blessed configuration. No persistent cache: activation
// becomes immediate after the migration, while existing orders remain readable.
export async function prizesReady(c:PoolClient):Promise<boolean> {
  return (await c.query<{ready:boolean}>("SELECT to_regclass('sorteos.blessed_numbers') IS NOT NULL AS ready")).rows[0]!.ready;
}
export async function publicBlessings(c:PoolClient,id:string,limit=12,offset=0):Promise<{items:BlessedNumberDto[];total:number}> {
  if(!await prizesReady(c))return {items:[],total:0};
  const total=(await c.query<{n:number}>('SELECT count(*)::int AS n FROM sorteos.blessed_numbers WHERE raffle_id=$1',[id])).rows[0]!.n;
  const items=(await c.query<Omit<BlessedNumberDto,'amountMinor'>&{amountMinor:string|null}>(`SELECT lpad(b.number::text,5,'0') AS number,p.title AS "prizeTitle",p.description AS "prizeDescription",
    p.kind AS "prizeKind",p.amount_minor::text AS "amountMinor" FROM sorteos.blessed_numbers b JOIN sorteos.raffle_prizes p ON p.id=b.prize_id
    WHERE b.raffle_id=$1 ORDER BY b.number LIMIT $2 OFFSET $3`,[id,limit,offset])).rows.map(row=>({...row,amountMinor:row.amountMinor===null?null:Number(row.amountMinor)}));
  return {items,total};
}
export async function orderAwards(c:PoolClient,id:string):Promise<BlessedAwardDto[]> {
  if(!await prizesReady(c))return [];
  return (await c.query<Omit<BlessedAwardDto,'amountMinor'>&{amountMinor:string|null}>(`SELECT a.id,lpad(b.number::text,5,'0') AS number,a.prize_snapshot->>'title' AS "prizeTitle",
    a.prize_snapshot->>'description' AS "prizeDescription",a.prize_snapshot->>'kind' AS "prizeKind",
    a.prize_snapshot->>'amountMinor' AS "amountMinor",a.status
    FROM sorteos.blessed_awards a JOIN sorteos.blessed_numbers b ON b.id=a.blessing_id WHERE a.order_id=$1 ORDER BY b.number`,[id])).rows.map(row=>({...row,amountMinor:row.amountMinor===null?null:Number(row.amountMinor)}));
}
export async function createOrderAwards(c:PoolClient,id:string):Promise<void> {
  if(!await prizesReady(c))return;
  await c.query(`INSERT INTO sorteos.blessed_awards(raffle_id,blessing_id,order_id,ticket_id,prize_snapshot)
    SELECT ot.raffle_id,b.id,ot.order_id,t.id,jsonb_build_object('title',p.title,'description',p.description,'kind',p.kind,'amountMinor',p.amount_minor)
    FROM sorteos.order_tickets ot JOIN sorteos.tickets t ON t.id=ot.ticket_id
    JOIN sorteos.blessed_numbers b ON b.raffle_id=t.raffle_id AND b.number=t.number
    JOIN sorteos.raffle_prizes p ON p.id=b.prize_id WHERE ot.order_id=$1 AND ot.released_at IS NULL
    ORDER BY b.id ON CONFLICT(order_id,blessing_id) DO NOTHING`,[id]);
}
export async function syncOrderAwards(c:PoolClient,id:string,status:'CONFIRMED'|'VOIDED'):Promise<void> {
  if(!await prizesReady(c))return;
  await c.query("UPDATE sorteos.blessed_awards SET status=$2 WHERE order_id=$1 AND status='PENDING_PAYMENT'",[id,status]);
}
