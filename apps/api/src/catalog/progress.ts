// Same PAID definition used by OperationsService; aggregate before joining tickets.
import { PoolClient } from 'pg';
export async function confirmedAmount(client:PoolClient,id:string):Promise<string> {
  const result=await client.query<{amount:string}>("SELECT coalesce(sum(total_minor),0)::text AS amount FROM sorteos.orders WHERE raffle_id=$1 AND status='PAID'",[id]);
  return result.rows[0]!.amount;
}
export function progress(amount:string,target:string|null) {
  if(target===null)return {progressPercent:null,actualProgressPercent:null};
  const real=BigInt(amount)*100n/BigInt(target);
  return {progressPercent:Number(real>100n?100n:real),actualProgressPercent:real.toString()};
}
export function ticketWidth(total:number,width:number):number {return total<=100000?5:width;}
