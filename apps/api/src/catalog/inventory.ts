import { PoolClient } from 'pg';
import { AvailabilityDto } from './catalog.dto';

// Absence of a ticket row means an eligible number, not exhausted inventory.
export async function inventory(client:PoolClient,id:string|null):Promise<AvailabilityDto> {
  const result=await client.query<{total:number;available:number;held:number;reserved:number;sold:number;asOf:Date}>(`
    WITH universe AS (SELECT coalesce(sum(total_tickets),0)::int AS total FROM sorteos.raffles WHERE ($1::uuid IS NULL OR id=$1)),
    occupied AS (SELECT
      count(*) FILTER(WHERE t.status='HELD' AND h.status='ACTIVE' AND h.expires_at>now())::int AS held,
      count(*) FILTER(WHERE t.status='RESERVED')::int AS reserved,
      count(*) FILTER(WHERE t.status='SOLD')::int AS sold
      FROM sorteos.tickets t LEFT JOIN sorteos.checkout_holds h ON h.id=t.hold_id
      WHERE ($1::uuid IS NULL OR t.raffle_id=$1))
    SELECT total,total-held-reserved-sold AS available,held,reserved,sold,now() AS "asOf" FROM universe CROSS JOIN occupied`,[id]);
  const row=result.rows[0]!;
  return {...row,asOf:row.asOf.toISOString()};
}
