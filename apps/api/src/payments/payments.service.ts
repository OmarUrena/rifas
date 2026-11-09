import { createHash, randomUUID } from 'node:crypto';
import { syncOrderAwards, orderAwards } from '../prizes/prizes.core';
import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AdminIdentity, AdminProof } from '../auth/admin.guard';
import { FinancialAuthorization } from '../auth/financial.guard';
import { DatabaseService } from '../database/database.service';
import { PrivateStorageService } from '../orders/private-storage.service';
import { AdminOrderDetailDto, AdminOrdersPageDto, AdminOrdersQueryDto, AdminOrderSummaryDto, ApproveDto,
  CancelDto, FinancialResultDto, ResolutionDto, ResolutionType, ReviewDto } from './payments.dto';

type Action='START_REVIEW'|'APPROVE'|'REQUEST_RESOLUTION'|'CANCEL';
type Payload=ReviewDto|ApproveDto|ResolutionDto|CancelDto;
interface OrderRow {id:string;order_code:string;raffle_id:string;customer_id:string;hold_id:string;ticket_quantity:number;total_minor:string;status:string;version:number;created_at:Date;reviewed_at:Date;reviewed_by:string}
interface ReportRow {id:string;bank_account_id:string;reference:string;receipt_sha256:string;status:string;verified_amount_minor:string|null}
interface SummaryRow extends OrderRow {raffle_title:string;report_status:string;duplicate_reference_count:number;duplicate_receipt_count:number}
function fail(code:string,status:number):never{throw new HttpException({code},status);}
const summarySql=`SELECT o.*,r.title AS raffle_title,p.status AS report_status,
  (SELECT count(*)::int FROM sorteos.payment_reports x WHERE x.order_id<>o.id AND x.reference=p.reference) AS duplicate_reference_count,
  (SELECT count(*)::int FROM sorteos.payment_reports x WHERE x.order_id<>o.id AND x.receipt_sha256=p.receipt_sha256) AS duplicate_receipt_count
  FROM sorteos.orders o JOIN sorteos.raffles r ON r.id=o.raffle_id JOIN sorteos.payment_reports p ON p.order_id=o.id AND p.active`;

@Injectable()
export class PaymentsService {
  constructor(private readonly db:DatabaseService,private readonly auth:FinancialAuthorization,private readonly storage:PrivateStorageService){}
  private summary(row:SummaryRow):AdminOrderSummaryDto {
    return {id:row.id,orderCode:row.order_code,raffleId:row.raffle_id,raffleTitle:row.raffle_title,status:row.status,
      paymentReportStatus:row.report_status,quantity:row.ticket_quantity,totalMinor:Number(row.total_minor),version:row.version,
      createdAt:row.created_at.toISOString(),duplicateReferenceCount:row.duplicate_reference_count,duplicateReceiptCount:row.duplicate_receipt_count};
  }
  private async audit(c:PoolClient,admin:AdminIdentity,action:string,entity:string,id:string,requestId:string) {
    await c.query("INSERT INTO sorteos.audit_logs(actor_kind,actor_id,action,entity,entity_id,request_id) VALUES('ADMIN',$1,$2,$3,$4,$5)",[admin.id,action,entity,id,requestId]);
  }
  async list(query:AdminOrdersQueryDto,admin:AdminIdentity,proof:AdminProof,requestId:string):Promise<AdminOrdersPageDto> {
    if(query.from&&query.to&&new Date(query.from)>new Date(query.to))fail('INVALID_DATE_RANGE',422);
    return this.db.transaction(async c=>{
      await this.auth.authorize(c,admin,proof,requestId);
      const values:unknown[]=[],conditions:string[]=[];
      for(const [column,value] of [['o.status',query.status],['o.raffle_id',query.raffleId],['o.created_at>=',query.from],['o.created_at<=',query.to]]) {
        if(value){values.push(value);conditions.push(`${column}${column!.endsWith('=')?'':'='}$${values.length}`);}
      }
      const where=conditions.length?` WHERE ${conditions.join(' AND ')}`:'';
      const count=await c.query<{total:number}>(`SELECT count(*)::int AS total FROM sorteos.orders o${where}`,values);
      const rows=await c.query<SummaryRow>(`${summarySql}${where} ORDER BY o.created_at DESC,o.id LIMIT $${values.length+1} OFFSET $${values.length+2}`,
        [...values,query.pageSize,(query.page-1)*query.pageSize]);
      await this.audit(c,admin,'ORDER_LIST_ACCESS','admin_users',admin.id,requestId);
      return {items:rows.rows.map(row=>this.summary(row)),pagination:{page:query.page,pageSize:query.pageSize,total:count.rows[0]!.total}};
    },false,true);
  }
  async detail(id:string,admin:AdminIdentity,proof:AdminProof,requestId:string):Promise<AdminOrderDetailDto> {
    return this.db.transaction(async c=>{
      await this.auth.authorize(c,admin,proof,requestId);
      const result=await c.query<SummaryRow>(`${summarySql} WHERE o.id=$1`,[id]);
      const order=result.rows[0];if(!order)fail('NOT_FOUND',404);
      const customer=(await c.query<{name:string;phone:string;email:string|null}>('SELECT name,phone,email FROM sorteos.customers WHERE id=$1',[order.customer_id])).rows[0]!;
      const tickets=await c.query<{number:number;ticket_width:number}>(`SELECT t.number,r.ticket_width FROM sorteos.order_tickets ot JOIN sorteos.tickets t ON t.id=ot.ticket_id
        JOIN sorteos.raffles r ON r.id=ot.raffle_id WHERE ot.order_id=$1 ORDER BY t.number`,[id]);
      const report=(await c.query(`SELECT id,bank_account_id AS "bankAccountId",reference,status,transfer_date AS "transferDate",reported_at AS "reportedAt",
        verified_amount_minor,bank_posted_at AS "bankPostedAt",bank_confirmation_reference AS "bankConfirmationReference",resolution_note AS "resolutionNote"
        FROM sorteos.payment_reports WHERE order_id=$1 AND active`,[id])).rows[0]!;
      const actions=await c.query(`SELECT id,action,admin_id AS "adminId",payload,result,created_at AS "createdAt"
        FROM sorteos.admin_actions WHERE order_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,[id]);
      const incidents=await c.query('SELECT id,category,status,resolution FROM sorteos.payment_incidents WHERE order_id=$1 ORDER BY created_at DESC,id LIMIT 100',[id]);
      await this.audit(c,admin,'ORDER_DETAIL_ACCESS','orders',id,requestId);
      return {...this.summary(order),blessedAwards:await orderAwards(c,id),customer,ticketNumbers:tickets.rows.map(row=>String(row.number).padStart(Math.max(5,row.ticket_width),'0')),
        paymentReport:{verifiedAmountMinor:report.verified_amount_minor===null?null:Number(report.verified_amount_minor),
          id:report.id,bankAccountId:report.bankAccountId,reference:report.reference,status:report.status,
          transferDate:report.transferDate.toISOString(),reportedAt:report.reportedAt.toISOString(),
          bankPostedAt:report.bankPostedAt?.toISOString()??null,bankConfirmationReference:report.bankConfirmationReference,resolutionNote:report.resolutionNote},
        actions:actions.rows.map(row=>({...row,id:row.id,action:row.action,adminId:row.adminId,payload:row.payload,result:row.result,createdAt:row.createdAt.toISOString()})),
        incidents:incidents.rows};
    },false,true);
  }
  async receipt(id:string,admin:AdminIdentity,proof:AdminProof,requestId:string,download=false) {
    const path=await this.db.transaction(async c=>{
      await this.auth.authorize(c,admin,proof,requestId);
      const report=await c.query<{receipt_storage_path:string}>('SELECT receipt_storage_path FROM sorteos.payment_reports WHERE id=$1',[id]);
      if(!report.rows[0])fail('NOT_FOUND',404);
      await this.audit(c,admin,download?'RECEIPT_DOWNLOAD_REQUEST':'RECEIPT_PROXY_ACCESS','payment_reports',id,requestId);
      return report.rows[0].receipt_storage_path;
    });
    if(!download)return {url:`/api/v1/admin/payment-reports/${id}/receipt`,access:'AUTHENTICATED_PROXY' as const};
    const file=await this.storage.download(path);
    await this.db.transaction(async c=>{
      await this.auth.authorize(c,admin,proof,requestId);
      await this.audit(c,admin,'RECEIPT_DOWNLOAD_GRANTED','payment_reports',id,requestId);
    });
    return file;
  }
  private fingerprint(id:string,action:Action,body:Payload) {
    const entries=Object.entries(body).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>
      [key,['bankPostedAt','refundedAt'].includes(key)?new Date(String(value)).toISOString():key==='duplicateOfOrderId'?String(value).toLowerCase():value]);
    return createHash('sha256').update(JSON.stringify([id.toLowerCase(),action,Object.fromEntries(entries)])).digest('hex');
  }
  private async validDate(c:PoolClient,value:string) {
    const row=await c.query<{valid:boolean}>('SELECT $1::timestamptz<=clock_timestamp()+interval \'5 minutes\' AS valid',[value]);
    if(!row.rows[0]!.valid)fail('INVALID_TRANSFER_DATE',422);
  }
  private async resolveIncidents(c:PoolClient,id:string,adminId:string,note:string) {
    await c.query("UPDATE sorteos.payment_incidents SET status='RESOLVED',resolution=$2,resolved_by=$3,resolved_at=now() WHERE order_id=$1 AND status<>'RESOLVED'",[id,note,adminId]);
  }
  async mutate(id:string,action:Action,body:Payload,key:string,admin:AdminIdentity,proof:AdminProof,requestId:string):Promise<FinancialResultDto> {
    const hash=this.fingerprint(id,action,body);
    return this.db.transaction(async c=>{
      await this.auth.authorize(c,admin,proof,requestId);
      if(['APPROVE','CANCEL'].includes(action)) {
        const owner=await c.query("SELECT id FROM sorteos.admin_users WHERE id=$1 AND active AND role='OWNER'",[admin.id]);
        if(!owner.rowCount)throw new ForbiddenException();
      }
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`admin-action:${admin.id}:${key.toLowerCase()}`]);
      const previous=await c.query<{request_hash:string;result:FinancialResultDto}>('SELECT request_hash,result FROM sorteos.admin_actions WHERE admin_id=$1 AND idempotency_key=$2',[admin.id,key]);
      if(previous.rows[0]){if(previous.rows[0].request_hash!==hash)fail('IDEMPOTENCY_CONFLICT',409);return previous.rows[0].result;}
      const found=await c.query<OrderRow>('SELECT * FROM sorteos.orders WHERE id=$1',[id]);
      if(!found.rows[0])fail('NOT_FOUND',404);
      await c.query('SELECT id FROM sorteos.raffles WHERE id=$1 FOR UPDATE',[found.rows[0].raffle_id]);
      await c.query('SELECT id FROM sorteos.checkout_holds WHERE id=$1 FOR UPDATE',[found.rows[0].hold_id]);
      const order=(await c.query<OrderRow>('SELECT * FROM sorteos.orders WHERE id=$1 FOR UPDATE',[id])).rows[0]!;
      if(order.version!==body.expectedVersion)fail('CONCURRENT_MODIFICATION',409);
      if(['PAID','CANCELLED'].includes(order.status))fail('INVALID_ORDER_STATE',409);
      const report=(await c.query<ReportRow>(`SELECT id,bank_account_id,reference,receipt_sha256,status,verified_amount_minor
        FROM sorteos.payment_reports WHERE order_id=$1 AND active FOR UPDATE`,[id])).rows[0];
      if(!report)throw new Error('Missing active report');
      const actionId=randomUUID();await c.query("SELECT set_config('app.admin_action_id',$1,true)",[actionId]);
      let status:string,released=0;
      if(action==='START_REVIEW') {
        if(!['PENDING_REVIEW','NEEDS_RESOLUTION'].includes(order.status))fail('INVALID_ORDER_STATE',409);
        status='UNDER_REVIEW';
        await c.query("UPDATE sorteos.payment_reports SET status='UNDER_REVIEW',reviewer_id=$2,reviewed_at=now() WHERE id=$1",[report.id,admin.id]);
      }else if(action==='REQUEST_RESOLUTION') {
        const input=body as ResolutionDto;status='NEEDS_RESOLUTION';
        await c.query('UPDATE sorteos.payment_reports SET status=$2,resolution_note=$3,reviewer_id=$4,reviewed_at=now() WHERE id=$1',[report.id,input.reportStatus,input.reason,admin.id]);
        await c.query(`INSERT INTO sorteos.payment_incidents(order_id,hold_id,category,reference)
          SELECT $1,$2,'PAYMENT_REVIEW_REQUIRED',$3 WHERE NOT EXISTS(SELECT 1 FROM sorteos.payment_incidents WHERE order_id=$1 AND status<>'RESOLVED')`,[id,order.hold_id,report.reference]);
      }else if(action==='APPROVE') {
        const input=body as ApproveDto;
        if(BigInt(input.verifiedAmountMinor)!==BigInt(order.total_minor))fail('AMOUNT_MISMATCH',422);
        await this.validDate(c,input.bankPostedAt);
        const duplicate=await c.query<{present:boolean}>(`SELECT EXISTS(SELECT 1 FROM sorteos.payment_reports WHERE order_id<>$1
          AND (reference=$2 OR receipt_sha256=$3 OR (bank_account_id=$4 AND bank_confirmation_reference=$5 AND status='VERIFIED'))) AS present`,
          [id,report.reference,report.receipt_sha256,report.bank_account_id,input.bankConfirmationReference]);
        if(duplicate.rows[0]!.present&&input.duplicateSignalsReviewed!==true)fail('DUPLICATE_REVIEW_REQUIRED',422);
        status='PAID';
        await c.query(`UPDATE sorteos.payment_reports SET status='VERIFIED',verified_amount_minor=$2,bank_posted_at=$3,
          bank_confirmation_reference=$4,resolution_note=$5,reviewer_id=$6,reviewed_at=now() WHERE id=$1`,
          [report.id,input.verifiedAmountMinor,input.bankPostedAt,input.bankConfirmationReference,input.note,admin.id]);
        await this.resolveIncidents(c,id,admin.id,input.note);
      }else {
        const input=body as CancelDto;status='CANCELLED';
        const refund=[input.receivedAmountMinor,input.refundAmountMinor,input.refundReference,input.refundedAt];
        if(input.resolutionType===ResolutionType.REFUNDED) {
          if(refund.some(v=>v===undefined||v===null)||input.receivedAmountMinor!==input.refundAmountMinor
            ||(report.verified_amount_minor!==null&&BigInt(report.verified_amount_minor)!==BigInt(input.receivedAmountMinor!)))fail('RECONCILIATION_REQUIRED',422);
          await this.validDate(c,input.refundedAt!);
        }else if(refund.some(v=>v!==undefined))fail('RECONCILIATION_REQUIRED',422);
        if(input.resolutionType===ResolutionType.DUPLICATE_RESOLVED) {
          if(!input.duplicateOfOrderId||!input.duplicateBankReference||input.duplicateOfOrderId.toLowerCase()===id.toLowerCase())fail('RECONCILIATION_REQUIRED',422);
          const duplicate=await c.query(`SELECT o.id FROM sorteos.orders o JOIN sorteos.payment_reports p ON p.order_id=o.id AND p.active
            WHERE o.id=$1 AND o.status='PAID' AND p.status='VERIFIED' AND p.bank_account_id=$2 AND p.bank_confirmation_reference=$3`,
            [input.duplicateOfOrderId,report.bank_account_id,input.duplicateBankReference]);
          if(!duplicate.rowCount)fail('RECONCILIATION_REQUIRED',422);
        }else if(input.duplicateOfOrderId!==undefined||input.duplicateBankReference!==undefined)fail('RECONCILIATION_REQUIRED',422);
        if(input.resolutionType===ResolutionType.NOT_PAID_CONFIRMED&&report.verified_amount_minor!==null)fail('RECONCILIATION_REQUIRED',422);
        await c.query(`UPDATE sorteos.payment_reports SET status=$2,verified_amount_minor=$3,resolution_note=$4,reviewer_id=$5,reviewed_at=now() WHERE id=$1`,
          [report.id,input.resolutionType===ResolutionType.REFUNDED?'REFUNDED':'INVALID',input.receivedAmountMinor??report.verified_amount_minor,input.reason,admin.id]);
        await this.resolveIncidents(c,id,admin.id,input.reason);
      }
      const cancel=action==='CANCEL'?body as CancelDto:undefined;
      const updated=(await c.query<OrderRow>(`UPDATE sorteos.orders SET status=$2,reviewed_at=now(),reviewed_by=$3,
        cancel_reason=$4,resolution_type=$5,evidence_reference=$6 WHERE id=$1 RETURNING *`,
        [id,status,admin.id,cancel?.reason??null,cancel?.resolutionType??null,cancel?.evidenceReference??null])).rows[0]!;
      if(action==='APPROVE') {
        const sold=await c.query("UPDATE sorteos.tickets SET status='SOLD' WHERE current_order_id=$1 AND status='RESERVED'",[id]);
        if(sold.rowCount!==order.ticket_quantity)throw new Error('Inventory invariant');
      }
      if(action==='CANCEL') {
        await c.query('UPDATE sorteos.order_tickets SET released_at=now() WHERE order_id=$1 AND released_at IS NULL',[id]);
        const freed=await c.query("UPDATE sorteos.tickets SET status='AVAILABLE',current_order_id=NULL WHERE current_order_id=$1 AND status='RESERVED'",[id]);
        if(freed.rowCount!==order.ticket_quantity)throw new Error('Inventory invariant');released=freed.rowCount;
      }
      if(action==='APPROVE'||action==='CANCEL')await syncOrderAwards(c,id,action==='APPROVE'?'CONFIRMED':'VOIDED');
      const counts=(await c.query<{sold:number;reserved:number}>(`SELECT count(*) FILTER(WHERE status='SOLD')::int AS sold,
        count(*) FILTER(WHERE status='RESERVED')::int AS reserved FROM sorteos.tickets WHERE current_order_id=$1`,[id])).rows[0]!;
      const result:FinancialResultDto={actionId,orderCode:order.order_code,status,version:updated.version,soldTicketCount:counts.sold,
        reservedTicketCount:counts.reserved,releasedTicketCount:released,reviewedAt:updated.reviewed_at.toISOString(),reviewedBy:admin.id};
      await c.query(`INSERT INTO sorteos.admin_actions(id,admin_id,order_id,idempotency_key,request_hash,action,payload,result)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)`,[actionId,admin.id,id,key,hash,action,JSON.stringify(body),JSON.stringify(result)]);
      return result;
    });
  }
}
