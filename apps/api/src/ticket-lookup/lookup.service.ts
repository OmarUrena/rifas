import { createHmac, randomUUID } from 'node:crypto';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { APP_CONFIG, AppConfig } from '../config/config';
import { DatabaseService } from '../database/database.service';
import { maskHalf, maskLookupEmail, normalizeLookupPhone } from './lookup.core';
import { TicketLookupInputDto, TicketLookupPersonDto } from './lookup.dto';

function fail(code:string,status:number):never {throw new HttpException({code},status);}
@Injectable()
export class TicketLookupService {
  constructor(private readonly db:DatabaseService,@Inject(APP_CONFIG) private readonly config:AppConfig) {}
  private key(value:string){return createHmac('sha256',this.config.abuseHashKey).update('ticket-lookup:'+value).digest('hex');}
  async raffles(page:number,pageSize:number) {
    return this.db.transaction(async c=>({
      items:(await c.query<{id:string;title:string}>(`SELECT id,title FROM sorteos.raffles WHERE status IN ('PUBLISHED','PAUSED','CLOSED','DRAWN')
        ORDER BY created_at DESC,id LIMIT $1 OFFSET $2`,[pageSize,(page-1)*pageSize])).rows,
      total:(await c.query<{n:number}>("SELECT count(*)::int AS n FROM sorteos.raffles WHERE status IN ('PUBLISHED','PAUSED','CLOSED','DRAWN')")).rows[0]!.n,
    }),true);
  }
  private async budget(c:PoolClient,key:string,maximum:number):Promise<boolean> {
    const row=(await c.query<{attempts:number}>(`INSERT INTO sorteos.ticket_lookup_limits(key,attempts) VALUES($1,1)
      ON CONFLICT(key) DO UPDATE SET
      attempts=CASE WHEN ticket_lookup_limits.window_started_at<=now()-interval '1 hour' THEN 1 ELSE ticket_lookup_limits.attempts+1 END,
      window_started_at=CASE WHEN ticket_lookup_limits.window_started_at<=now()-interval '1 hour' THEN now() ELSE ticket_lookup_limits.window_started_at END
      RETURNING attempts`,[key])).rows[0]!;
    return row.attempts<=maximum;
  }
  async search(body:TicketLookupInputDto,page:number,pageSize:number,ip:string,requestId:string) {
    const phone=normalizeLookupPhone(body.phone);
    if(!phone)fail('INVALID_REQUEST',400);
    const outcome=await this.db.transaction(async c=>{
      if(!(await c.query<{ready:boolean}>("SELECT to_regclass('sorteos.ticket_lookup_limits') IS NOT NULL AS ready")).rows[0]!.ready)
        fail('LOOKUP_UNAVAILABLE',503);
      // Authentication-free summary only. Counters commit even on denial.
      await c.query(`WITH stale AS (SELECT key FROM sorteos.ticket_lookup_limits
        WHERE window_started_at<now()-interval '24 hours' ORDER BY window_started_at,key LIMIT 100 FOR UPDATE SKIP LOCKED)
        DELETE FROM sorteos.ticket_lookup_limits l USING stale WHERE l.key=stale.key`);
      // Fixed lock order shared by every instance; each key is HMAC, never raw IP/phone.
      const ipAllowed=await this.budget(c,'ip:'+this.key(ip),20);
      if(!ipAllowed)return {limited:true as const};
      const contactAllowed=await this.budget(c,'phone:'+this.key(phone),30);
      if(!contactAllowed)return {limited:true as const};
      const raffle=await c.query("SELECT id FROM sorteos.raffles WHERE id=$1 AND status IN ('PUBLISHED','PAUSED','CLOSED','DRAWN')",[body.raffleId]);
      let items:TicketLookupPersonDto[]=[],total=0,totalTickets=0;
      if(raffle.rowCount) {
        // One row per order: its state must never be inferred from another purchase.
        const matched=`FROM sorteos.orders o JOIN sorteos.customers u ON u.id=o.customer_id
          WHERE o.raffle_id=$1 AND o.status<>'CANCELLED'
          AND regexp_replace(btrim(u.phone),'[[:space:]().-]','','g')=$2`;
        const rows=(await c.query<{name:string;email:string|null;n:number;status:TicketLookupPersonDto['orderStatus']}>(`SELECT u.name,u.email,o.ticket_quantity AS n,o.status ${matched}
          ORDER BY o.created_at DESC,o.id LIMIT $3 OFFSET $4`,[body.raffleId,phone,pageSize,(page-1)*pageSize])).rows;
        const counts=(await c.query<{total:number;tickets:string}>(`SELECT count(*)::int AS total,coalesce(sum(o.ticket_quantity),0)::text AS tickets
          ${matched}`,[body.raffleId,phone])).rows[0]!;
        total=counts.total;totalTickets=Number(counts.tickets);
        items=rows.map(row=>({maskedName:maskHalf(row.name),maskedEmail:maskLookupEmail(row.email),ticketCount:Number(row.n),orderStatus:row.status}));
        if(!Number.isSafeInteger(totalTickets)||items.some(row=>!Number.isSafeInteger(row.ticketCount)))throw new Error('Ticket count overflow');
      }
      // No contacts, names, result counts or search values in persistent audit.
      await c.query(`INSERT INTO sorteos.audit_logs(actor_kind,action,entity,entity_id,request_id)
        VALUES('SYSTEM','PUBLIC_TICKET_SUMMARY','ticket_lookup',$1,$2)`,[randomUUID(),requestId]);
      return {limited:false as const,result:{items,total,totalTickets}};
    });
    if(outcome.limited)fail('RATE_LIMITED',429);
    return outcome.result;
  }
}
