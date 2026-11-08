import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { HttpException, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PoolClient } from 'pg';
import { APP_CONFIG, AppConfig } from '../config/config';
import { DatabaseService } from '../database/database.service';
import { CreateHoldDto, HoldDto } from './checkout.dto';
import { chooseNumbers } from './numbers';

interface Session {id:string}
interface Hold {
  id:string;raffle_id:string;quantity:number;unit_price_minor_snapshot:string;
  expires_at:Date;status:string;request_hash:string;
}
function fail(code:string,status:number):never {throw new HttpException({code},status);}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

/** Fisher-Yates parcial, uniforme sin reemplazo. Solo números internos en servidor. */
export function chooseTickets(ids:string[],quantity:number):string[] {
  for(let i=0;i<quantity;i++) {
    const j=randomInt(i,ids.length);
    [ids[i],ids[j]]=[ids[j]!,ids[i]!];
  }
  return ids.slice(0,quantity);
}

@Injectable()
export class CheckoutService implements OnModuleInit,OnModuleDestroy {
  private timer?:ReturnType<typeof setInterval>;
  private sweeping=false;
  constructor(private readonly db:DatabaseService,@Inject(APP_CONFIG) private readonly config:AppConfig) {}
  onModuleInit() {
    if(this.config.databaseUrl) {
      this.timer=setInterval(()=>{void this.sweep();},this.config.holdSweepMs);
      this.timer.unref();
    }
  }
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  private async context(c:PoolClient,requestId:string,sessionId?:string) {
    await c.query("SELECT set_config('app.actor_kind',$1,true),set_config('app.actor_id',$2,true),set_config('app.request_id',$3,true)",
      [sessionId?'GUEST':'SYSTEM',sessionId??'',requestId]);
  }
  ipKey(ip:string):string {return createHmac('sha256',this.config.abuseHashKey).update(ip).digest('hex');}
  async session(c:PoolClient,secret:string|undefined):Promise<Session> {
    if(!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret))fail('SESSION_INVALID',401);
    const row=await c.query<Session>('SELECT id FROM sorteos.guest_sessions WHERE secret_hash=$1 AND expires_at>now()',[hash(secret)]);
    if(!row.rows[0])fail('SESSION_INVALID',401);
    return row.rows[0];
  }
  private async budget(c:PoolClient,kind:'session'|'hold',ipKey:string,limit:number) {
    const result=await c.query<{attempts:number}>(`INSERT INTO sorteos.checkout_limits(key,attempts) VALUES($1,1)
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN checkout_limits.window_started_at<=now()-interval '1 hour'
        THEN 1 ELSE checkout_limits.attempts+1 END,
        window_started_at=CASE WHEN checkout_limits.window_started_at<=now()-interval '1 hour' THEN now() ELSE checkout_limits.window_started_at END
      RETURNING attempts`,[`${kind}:${ipKey}`]);
    if(result.rows[0]!.attempts>limit)fail('RATE_LIMITED',429);
  }
  async openSession(secret:string|undefined,ipKey:string,requestId:string):Promise<string|undefined> {
    return this.db.transaction(async c=>{
      await this.context(c,requestId);
      if(secret && /^[A-Za-z0-9_-]{43}$/.test(secret)) {
        const valid=await c.query("UPDATE sorteos.guest_sessions SET expires_at=greatest(expires_at,now()+interval '24 hours') WHERE secret_hash=$1 AND expires_at>now() RETURNING id",[hash(secret)]);
        if(valid.rowCount)return secret;
      }
      await this.budget(c,'session',ipKey,this.config.sessionHourlyIp);
      await this.context(c,requestId);
      const token=randomBytes(32).toString('base64url');
      await c.query("INSERT INTO sorteos.guest_sessions(secret_hash,abuse_key_hash,expires_at) VALUES($1,$2,now()+interval '24 hours')",[hash(token),ipKey]);
      return token;
    });
  }
  private async expire(c:PoolClient,raffleId:string) {
    // La fila de rifa siempre se bloquea antes de tocar hold/boletos.
    const expired=await c.query<{id:string}>(`UPDATE sorteos.checkout_holds SET status='EXPIRED'
      WHERE raffle_id=$1 AND status='ACTIVE' AND expires_at<=now() RETURNING id`,[raffleId]);
    if(expired.rowCount)await c.query(`UPDATE sorteos.tickets SET status='AVAILABLE',hold_id=NULL
      WHERE status='HELD' AND hold_id=ANY($1::uuid[])`,[expired.rows.map(row=>row.id)]);
  }
  private async response(c:PoolClient,hold:Hold):Promise<HoldDto> {
    const time=await c.query<{now:Date}>('SELECT now() AS now');
    return {holdId:hold.id,raffleId:hold.raffle_id,quantity:hold.quantity,
      unitPriceMinor:Number(hold.unit_price_minor_snapshot),
      totalMinor:Number(BigInt(hold.unit_price_minor_snapshot)*BigInt(hold.quantity)),
      currency:'DOP',expiresAt:hold.expires_at.toISOString(),serverTime:time.rows[0]!.now.toISOString(),status:hold.status};
  }
  async create(body:CreateHoldDto,key:string,secret:string|undefined,ipKey:string,requestId:string) {
    return this.db.transaction(async c=>{
      const session=await this.session(c,secret);
      // Orden global: IP -> sesión -> rifa -> holds/boletos. Claves hasheadas, sin IP cruda.
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`checkout-ip:${ipKey}`]);
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`checkout-session:${session.id}`]);
      await this.context(c,requestId,session.id);
      const requestHash=hash(JSON.stringify([body.raffleId.toLowerCase(),body.quantity]));
      const previous=await c.query<Hold>('SELECT * FROM sorteos.checkout_holds WHERE session_id=$1 AND idempotency_key=$2',[session.id,key]);
      if(previous.rows[0]) {
        if(previous.rows[0].request_hash!==requestHash)fail('IDEMPOTENCY_CONFLICT',409);
        await c.query('SELECT id FROM sorteos.raffles WHERE id=$1 FOR UPDATE',[previous.rows[0].raffle_id]);
        await this.expire(c,previous.rows[0].raffle_id);
        const current=await c.query<Hold>('SELECT * FROM sorteos.checkout_holds WHERE id=$1',[previous.rows[0].id]);
        return this.response(c,current.rows[0]!);
      }
      const lifetime=await c.query('SELECT id FROM sorteos.guest_sessions WHERE id=$1 AND expires_at>=now()+$2*interval \'1 minute\'',[session.id,this.config.holdTtlMinutes]);
      if(!lifetime.rowCount)fail('SESSION_INVALID',401);
      const result=await c.query<{id:string;total_tickets:number;status:string;min_purchase:number;max_purchase:number;ticket_price_minor:string;rules_version:string;open:boolean}>(
        `SELECT *, (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now()) AS open
         FROM sorteos.raffles WHERE id=$1 FOR UPDATE`,[body.raffleId]);
      const raffle=result.rows[0];
      if(!raffle || raffle.status!=='PUBLISHED' || !raffle.open)fail('RAFFLE_NOT_AVAILABLE',409);
      if(body.quantity<raffle.min_purchase || body.quantity>Math.min(raffle.max_purchase,this.config.holdMaxQuantity))fail('INVALID_QUANTITY',422);
      await this.expire(c,raffle.id);
      const active=await c.query<{session_count:number;ip_count:number}>(`SELECT
        count(*) FILTER(WHERE session_id=$1)::int AS session_count,
        count(*) FILTER(WHERE abuse_key_hash=$2)::int AS ip_count
        FROM sorteos.checkout_holds WHERE status='ACTIVE' AND expires_at>now() AND (session_id=$1 OR abuse_key_hash=$2)`,[session.id,ipKey]);
      if(active.rows[0]!.session_count>=this.config.holdMaxActiveSession || active.rows[0]!.ip_count>=this.config.holdMaxActiveIp)fail('RATE_LIMITED',429);
      await this.budget(c,'hold',ipKey,this.config.holdHourlyIp);
      const occupied=await c.query<{number:number}>("SELECT number FROM sorteos.tickets WHERE raffle_id=$1 AND status<>'AVAILABLE' ORDER BY number",[raffle.id]);
      if(raffle.total_tickets-occupied.rows.length<body.quantity)fail('INSUFFICIENT_TICKETS',409);
      const numbers=chooseNumbers(raffle.total_tickets,occupied.rows.map(row=>row.number),body.quantity);
      // Materialize only selected numbers. Released AVAILABLE rows can be reused.
      await c.query(`INSERT INTO sorteos.tickets(raffle_id,number) SELECT $1,n FROM unnest($2::int[]) AS n
        ON CONFLICT(raffle_id,number) DO NOTHING`,[raffle.id,numbers]);
      const selected=(await c.query<{id:string}>('SELECT id FROM sorteos.tickets WHERE raffle_id=$1 AND number=ANY($2::int[]) ORDER BY number',[raffle.id,numbers])).rows.map(row=>row.id);
      const created=await c.query<Hold>(`INSERT INTO sorteos.checkout_holds(raffle_id,session_id,quantity,unit_price_minor_snapshot,
        rules_version_snapshot,expires_at,idempotency_key,request_hash,abuse_key_hash)
        VALUES($1,$2,$3,$4,$5,now()+$6*interval '1 minute',$7,$8,$9) RETURNING *`,
        [raffle.id,session.id,body.quantity,raffle.ticket_price_minor,raffle.rules_version,this.config.holdTtlMinutes,key,requestHash,ipKey]);
      const hold=created.rows[0]!;
      const changed=await c.query("UPDATE sorteos.tickets SET status='HELD',hold_id=$1 WHERE id=ANY($2::uuid[]) AND status='AVAILABLE'",[hold.id,selected]);
      if(changed.rowCount!==body.quantity)throw new Error('Inventory invariant');
      return this.response(c,hold);
    });
  }
  async get(id:string,secret:string|undefined,requestId:string,cancel=false) {
    return this.db.transaction(async c=>{
      const session=await this.session(c,secret);
      const found=await c.query<Hold>('SELECT * FROM sorteos.checkout_holds WHERE id=$1 AND session_id=$2',[id,session.id]);
      if(!found.rows[0])fail('NOT_FOUND',404);
      await this.context(c,requestId,session.id);
      await c.query('SELECT id FROM sorteos.raffles WHERE id=$1 FOR UPDATE',[found.rows[0].raffle_id]);
      await this.expire(c,found.rows[0].raffle_id);
      const current=await c.query<Hold>('SELECT * FROM sorteos.checkout_holds WHERE id=$1',[id]);
      const hold=current.rows[0]!;
      if(cancel && hold.status==='CONSUMED')fail('HOLD_CONSUMED',409);
      if(cancel && hold.status==='ACTIVE') {
        await c.query("UPDATE sorteos.checkout_holds SET status='CANCELLED' WHERE id=$1",[id]);
        await c.query("UPDATE sorteos.tickets SET status='AVAILABLE',hold_id=NULL WHERE hold_id=$1 AND status='HELD'",[id]);
        hold.status='CANCELLED';
      }
      await c.query(`INSERT INTO sorteos.audit_logs(actor_kind,actor_id,action,entity,entity_id,request_id)
        VALUES('GUEST',$1,$2,'checkout_holds',$3,$4)`,[session.id,cancel?'HOLD_CANCEL_ACCESS':'HOLD_ACCESS',id,requestId]);
      return this.response(c,hold);
    });
  }
  async sweep() {
    if(this.sweeping)return;
    this.sweeping=true;
    try {
      const pending=await this.db.transaction(c=>c.query<{raffle_id:string}>(`SELECT raffle_id FROM sorteos.checkout_holds
        WHERE status='ACTIVE' AND expires_at<=now() GROUP BY raffle_id ORDER BY min(expires_at) LIMIT 20`),true);
      for(const row of pending.rows)await this.db.transaction(async c=>{
        const lock=await c.query('SELECT id FROM sorteos.raffles WHERE id=$1 FOR UPDATE SKIP LOCKED',[row.raffle_id]);
        if(!lock.rowCount)return;
        await this.context(c,randomUUID());
        await this.expire(c,row.raffle_id);
      });
    }catch {Logger.warn('No se completó la liberación de pre-reservas; se reintentará en el próximo ciclo.','Checkout');}
    finally{this.sweeping=false;}
  }
}
