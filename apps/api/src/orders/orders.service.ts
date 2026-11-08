import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { HttpException, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CheckoutService } from '../checkout/checkout.service';
import { DatabaseService } from '../database/database.service';
import { OrderDto, SubmitOrderDto } from './orders.dto';
import { ReceiptService, ReceiptUpload } from './receipt.service';
import { PrivateStorageService } from './private-storage.service';
import { APP_CONFIG, AppConfig } from '../config/config';
import { developmentToken } from '../development/capability';

const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
function fail(code:string,status:number):never{throw new HttpException({code},status);}
interface OrderRow {id:string;order_code:string;status:string;request_hash:string;raffle_id:string;ticket_quantity:number;total_minor:string;created_at:Date}
interface HoldRow {id:string;raffle_id:string;quantity:number;unit_price_minor_snapshot:string;rules_version_snapshot:string;status:string;expired:boolean;isDemoBank?:boolean}
interface Stage {id:string;storage_path:string;sha256:string;status:string}

@Injectable()
export class OrdersService implements OnModuleInit,OnModuleDestroy {
  private timer?:ReturnType<typeof setInterval>;
  private cleaning=false;
  constructor(private readonly db:DatabaseService,private readonly checkout:CheckoutService,
    private readonly receipts:ReceiptService,private readonly storage:PrivateStorageService,@Inject(APP_CONFIG) private readonly config:AppConfig){}
  onModuleInit(){this.timer=setInterval(()=>{void this.sweep();},60000);this.timer.unref();}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  private async context(c:PoolClient,requestId:string,sessionId?:string){
    await c.query("SELECT set_config('app.actor_kind',$1,true),set_config('app.actor_id',$2,true),set_config('app.request_id',$3,true)",[sessionId?'GUEST':'SYSTEM',sessionId??'',requestId]);
    await c.query("SELECT set_config('app.development_mfa_token',$1,true)",[developmentToken(this.config)]);
  }
  private async previous(c:PoolClient,sessionId:string,key:string,requestHash:string) {
    const row=await c.query<OrderRow>('SELECT * FROM sorteos.orders WHERE session_id=$1 AND idempotency_key=$2',[sessionId,key]);
    if(row.rows[0] && row.rows[0].request_hash!==requestHash)fail('IDEMPOTENCY_CONFLICT',409);
    return row.rows[0];
  }
  private async hold(c:PoolClient,sessionId:string,body:SubmitOrderDto):Promise<HoldRow> {
    const found=await c.query<HoldRow>('SELECT * FROM sorteos.checkout_holds WHERE id=$1 AND session_id=$2',[body.holdId,sessionId]);
    if(!found.rows[0])fail('NOT_FOUND',404);
    const raffle=await c.query<{status:string;rules_version:string;slug:string}>('SELECT status,rules_version,slug FROM sorteos.raffles WHERE id=$1 FOR UPDATE',[found.rows[0].raffle_id]);
    const locked=await c.query<HoldRow>('SELECT *,expires_at<=clock_timestamp() AS expired FROM sorteos.checkout_holds WHERE id=$1 FOR UPDATE',[body.holdId]);
    const hold=locked.rows[0]!;
    if(hold.status==='CONSUMED')fail('HOLD_CONSUMED',409);
    if(hold.status!=='ACTIVE'||hold.expired)fail('HOLD_EXPIRED',409);
    if(!raffle.rows[0] || !['PUBLISHED','PAUSED'].includes(raffle.rows[0].status))fail('RAFFLE_NOT_AVAILABLE',409);
    if(body.acceptedRulesVersion!==hold.rules_version_snapshot||body.acceptedRulesVersion!==raffle.rows[0].rules_version)fail('RULES_CHANGED',409);
    let demo=false;
    if(developmentToken(this.config)&&raffle.rows[0].slug==='demo-prueba-completa'&&raffle.rows[0].rules_version==='DEMO-PRUEBA-1')
      demo=(await c.query<{valid:boolean}>('SELECT sorteos.development_checkout_valid() AS valid')).rows[0]?.valid===true;
    const bank=await c.query<{id:string;is_demo:boolean}>('SELECT id,is_demo FROM sorteos.bank_accounts WHERE id=$1 AND ((active AND NOT is_demo) OR (is_demo AND $2))',[body.bankAccountId,demo]);
    if(!bank.rowCount)fail('INVALID_BANK_ACCOUNT',422);
    const date=await c.query<{valid:boolean}>('SELECT $1::timestamptz<=clock_timestamp()+interval \'5 minutes\' AS valid',[body.transferDate]);
    if(!date.rows[0]!.valid)fail('INVALID_TRANSFER_DATE',422);
    return {...hold,isDemoBank:bank.rows[0]?.is_demo===true};
  }
  private async response(c:PoolClient,order:OrderRow):Promise<OrderDto> {
    const raffle=await c.query<{title:string;ticket_width:number}>('SELECT title,ticket_width FROM sorteos.raffles WHERE id=$1',[order.raffle_id]);
    const numbers=await c.query<{number:number}>(`SELECT t.number FROM sorteos.order_tickets ot JOIN sorteos.tickets t ON t.id=ot.ticket_id
      WHERE ot.order_id=$1 ORDER BY t.number`,[order.id]);
    const payment=await c.query<{status:string}>('SELECT status FROM sorteos.payment_reports WHERE order_id=$1 AND active',[order.id]);
    return {orderCode:order.order_code,status:order.status,paymentReportStatus:payment.rows[0]!.status,
      raffleId:order.raffle_id,raffleTitle:raffle.rows[0]!.title,quantity:order.ticket_quantity,
      ticketNumbers:numbers.rows.map(row=>String(row.number).padStart(Math.max(5,raffle.rows[0]!.ticket_width),'0')),
      totalMinor:Number(order.total_minor),currency:'DOP',createdAt:order.created_at.toISOString(),
      message:order.status==='PAID'?'Pago verificado.':order.status==='CANCELLED'?'Orden cancelada mediante resolución administrativa.':
        'Orden y comprobante recibidos. Los números están reservados y el pago está pendiente de verificación.'};
  }
  async submit(body:SubmitOrderDto,key:string,secret:string|undefined,file:ReceiptUpload|undefined,requestId:string):Promise<OrderDto> {
    // Validar y decodificar antes del upload; el hash de intención usa el original.
    const receipt=await this.receipts.validate(file);
    const requestHash=sha(JSON.stringify([body.holdId.toLowerCase(),body.customerName,body.customerPhone,body.customerEmail,
      body.bankAccountId.toLowerCase(),body.bankReference,new Date(body.transferDate).toISOString(),body.acceptedRulesVersion,sha(file!.buffer),file!.mimetype]));
    const prepared=await this.db.transaction(async c=>{
      const session=await this.checkout.session(c,secret);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`checkout-session:${session.id}`]);
      await this.context(c,requestId,session.id);
      const existing=await this.previous(c,session.id,key,requestHash);
      if(existing)return {response:await this.response(c,existing)};
      await this.hold(c,session.id,body);
      const quota=await c.query<{recent:number;pending:number}>(`SELECT count(*)::int AS recent,
        count(*) FILTER(WHERE status='PENDING' AND cleanup_after>now())::int AS pending
        FROM sorteos.receipt_staging WHERE session_id=$1 AND created_at>now()-interval '1 hour'`,[session.id]);
      if(quota.rows[0]!.recent>=20||quota.rows[0]!.pending>=2)fail('RATE_LIMITED',429);
      const id=randomUUID(),path=`pending/${id}.${receipt.extension}`;
      const stage=await c.query<Stage>(`INSERT INTO sorteos.receipt_staging(id,session_id,storage_path,sha256)
        VALUES($1,$2,$3,$4) RETURNING *`,[id,session.id,path,sha(receipt.bytes)]);
      return {stage:stage.rows[0]!};
    });
    if(prepared.response)return prepared.response;
    const stage=prepared.stage!;
    // Si la respuesta del upload se pierde, el job durable limpia tras el plazo;
    // no borrar inmediatamente mientras el proveedor podría estar completándolo.
    await this.storage.upload(stage.storage_path,receipt.bytes,receipt.mime);
    try {
      const response=await this.db.transaction(async c=>{
        const session=await this.checkout.session(c,secret);
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`checkout-session:${session.id}`]);
        await this.context(c,requestId,session.id);
        const previous=await this.previous(c,session.id,key,requestHash);
        if(previous)return this.response(c,previous);
        const hold=await this.hold(c,session.id,body);
        const staged=await c.query('SELECT id FROM sorteos.receipt_staging WHERE id=$1 AND status=\'PENDING\' AND cleanup_after>clock_timestamp() FOR UPDATE',[stage.id]);
        if(!staged.rowCount)fail('STORAGE_UNAVAILABLE',503);
        const customer=await c.query<{id:string}>('INSERT INTO sorteos.customers(name,phone,email,is_demo) VALUES($1,$2,$3,$4) RETURNING id',[body.customerName,body.customerPhone,body.customerEmail,hold.isDemoBank===true]);
        const order=await c.query<OrderRow>(`INSERT INTO sorteos.orders(order_code,raffle_id,customer_id,session_id,hold_id,ticket_quantity,
          unit_price_minor,rules_version_snapshot,lookup_secret_hash,idempotency_key,request_hash)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [`RF-${randomBytes(16).toString('hex').toUpperCase()}`,hold.raffle_id,customer.rows[0]!.id,session.id,hold.id,hold.quantity,
            hold.unit_price_minor_snapshot,hold.rules_version_snapshot,sha(randomBytes(32)),key,requestHash]);
        const row=order.rows[0]!;
        await c.query(`INSERT INTO sorteos.order_tickets(order_id,ticket_id,raffle_id)
          SELECT $1,id,raffle_id FROM sorteos.tickets WHERE hold_id=$2 AND status='HELD'`,[row.id,hold.id]);
        await c.query(`INSERT INTO sorteos.payment_reports(order_id,bank_account_id,reference,transfer_date,receipt_storage_path,receipt_sha256)
          VALUES($1,$2,$3,$4,$5,$6)`,[row.id,body.bankAccountId,body.bankReference,body.transferDate,stage.storage_path,stage.sha256]);
        const changed=await c.query("UPDATE sorteos.tickets SET status='RESERVED',hold_id=NULL,current_order_id=$1 WHERE hold_id=$2 AND status='HELD'",[row.id,hold.id]);
        if(changed.rowCount!==hold.quantity)throw new Error('Inventory invariant');
        await c.query("UPDATE sorteos.checkout_holds SET status='CONSUMED' WHERE id=$1",[hold.id]);
        await c.query("UPDATE sorteos.receipt_staging SET status='ATTACHED',order_id=$1 WHERE id=$2",[row.id,stage.id]);
        return this.response(c,row);
      });
      // También limpia el intento perdedor de dos uploads concurrentes con la misma clave.
      await this.cleanup(stage.id,true);
      return response;
    }catch(error){await this.cleanup(stage.id,true);throw error;}
  }
  async get(code:string,secret:string|undefined,requestId:string):Promise<OrderDto> {
    return this.db.transaction(async c=>{
      const session=await this.checkout.session(c,secret);await this.context(c,requestId,session.id);
      const order=await c.query<OrderRow>('SELECT * FROM sorteos.orders WHERE order_code=$1 AND session_id=$2',[code,session.id]);
      if(!order.rows[0])fail('NOT_FOUND',404);
      await c.query("INSERT INTO sorteos.audit_logs(actor_kind,actor_id,action,entity,entity_id,request_id) VALUES('GUEST',$1,'ORDER_ACCESS','orders',$2,$3)",[session.id,order.rows[0].id,requestId]);
      return this.response(c,order.rows[0]);
    });
  }
  private async cleanup(id:string,immediate=false) {
    try {
      const path=await this.db.transaction(async c=>{
        await this.context(c,randomUUID());
        const result=await c.query<{storage_path:string}>(`UPDATE sorteos.receipt_staging SET status='CLEANING',cleanup_after=now()+interval '10 minutes'
          WHERE id=$1 AND ((status='PENDING' AND ($2 OR cleanup_after<=now())) OR (status='CLEANING' AND cleanup_after<=now())) RETURNING storage_path`,[id,immediate]);
        return result.rows[0]?.storage_path;
      });
      if(!path)return;
      await this.storage.remove(path);
      await this.db.transaction(async c=>{await this.context(c,randomUUID());await c.query("UPDATE sorteos.receipt_staging SET status='CLEANED' WHERE id=$1 AND status='CLEANING'",[id]);});
    }catch{Logger.warn('Limpieza de comprobante pendiente de reintento.','Orders');}
  }
  async sweep() {
    if(this.cleaning)return;this.cleaning=true;
    try {
      const rows=await this.db.transaction(c=>c.query<{id:string}>("SELECT id FROM sorteos.receipt_staging WHERE status IN ('PENDING','CLEANING') AND cleanup_after<=now() ORDER BY cleanup_after LIMIT 20"),true);
      for(const row of rows.rows)await this.cleanup(row.id);
    }catch{Logger.warn('No se completó limpieza de comprobantes.','Orders');}
    finally{this.cleaning=false;}
  }
}
