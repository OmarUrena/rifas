import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { FinancialAuthorization } from '../auth/financial.guard';
import { AdminIdentity, AdminProof } from '../auth/admin.guard';
import { PageQueryDto } from '../common/pagination';
import { LotteryInputDto, LotteryAction, LotteryPageDto } from './lottery.dto';
const fail=(code:string,status=422):never=>{throw new HttpException({code},status);};
@Injectable()
export class LotteryService {
 constructor(private readonly db:DatabaseService,private readonly auth:FinancialAuthorization){}
 async write(id:string,body:LotteryInputDto,key:string,actor:AdminIdentity,proof:AdminProof,rid:string){
  if(actor.role!=='OWNER')throw new ForbiddenException();
  const fingerprint=createHash('sha256').update(JSON.stringify([id,body])).digest('hex');
  return this.db.transaction(async c=>{
   await this.auth.authorize(c,actor,proof,rid);
   await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`lottery:${actor.id}:${key.toLowerCase()}`]);
   const old=(await c.query("SELECT metadata FROM sorteos.audit_logs WHERE actor_id=$1 AND action='LOTTERY_ACTION' AND metadata->>'idempotencyKey'=$2",[actor.id,key.toLowerCase()])).rows[0];
   if(old){if(old.metadata.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT',409);return old.metadata.result as {id:string};}
   const raffle=(await c.query('SELECT id,status,published_at FROM sorteos.raffles WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!raffle)fail('NOT_FOUND',404);
   let result:{id:string};
   if(body.action===LotteryAction.PRIZE){
    if(!body.title?.trim())fail('INVALID_REQUEST',400);
    if(raffle.status!=='DRAFT'||raffle.published_at)fail('PRIZES_LOCKED',409);
    result=(await c.query('INSERT INTO sorteos.lottery_prizes(raffle_id,title) VALUES($1,$2) RETURNING id',[id,body.title!.trim()])).rows[0];
    await c.query('UPDATE sorteos.raffles SET updated_at=now() WHERE id=$1',[id]);
   }else if(body.action===LotteryAction.RESULT){
    if(!body.pick4||!body.fireball||!body.eventAt||!body.reference?.trim()||Date.parse(body.eventAt)>Date.now())fail('INVALID_REQUEST',400);
    result=(await c.query(`INSERT INTO sorteos.lottery_results(raffle_id,pick4,fireball,event_at,reference,rules_version,sales_closed,created_by)
     VALUES($1,$2,$3,$4,$5,'',false,$6) RETURNING id`,[id,body.pick4,body.fireball,body.eventAt,body.reference!.trim(),actor.id])).rows[0];
   }else if(body.action===LotteryAction.AWARD){
    if(!body.resultId||!body.prizeId)fail('INVALID_REQUEST',400);
    const selected=(await c.query('SELECT eligible_order_id FROM sorteos.lottery_results WHERE id=$1 AND raffle_id=$2',[body.resultId,id])).rows[0];
    if(!selected?.eligible_order_id)fail('LOTTERY_NOT_ELIGIBLE',409);
    result=(await c.query(`INSERT INTO sorteos.lottery_awards(raffle_id,result_id,prize_id,order_id,prize_snapshot,created_by)
     VALUES($1,$2,$3,$4,'',$5) RETURNING id`,[id,body.resultId,body.prizeId,selected.eligible_order_id,actor.id])).rows[0];
   }else{
    if(!body.awardId||!body.source||!body.eventAt||!body.reference?.trim()||Date.parse(body.eventAt)>Date.now())fail('INVALID_REQUEST',400);
    const table=body.source==='LOTTERY'?'lottery_awards':'blessed_awards';
    const award=(await c.query(`SELECT * FROM sorteos.${table} WHERE id=$1 AND raffle_id=$2`,[body.awardId,id])).rows[0];
    if(!award)fail('NOT_FOUND',404);
    if(body.source==='BLESSED'&&award.status!=='CONFIRMED')fail('LOTTERY_NOT_ELIGIBLE',409);
    result=(await c.query(`INSERT INTO sorteos.prize_deliveries(${body.source==='LOTTERY'?'lottery_award_id':'blessed_award_id'},delivered_at,reference,created_by)
     VALUES($1,$2,$3,$4) RETURNING id`,[body.awardId,body.eventAt,body.reference!.trim(),actor.id])).rows[0];
   }
   await c.query(`INSERT INTO sorteos.audit_logs(actor_kind,actor_id,action,entity,entity_id,request_id,metadata)
    VALUES('ADMIN',$1,'LOTTERY_ACTION','raffles',$2,$3,$4::jsonb)`,[actor.id,id,rid,JSON.stringify({idempotencyKey:key.toLowerCase(),fingerprint,result})]);
   return result;
  });
 }
 async list(id:string,kind:'prizes'|'results'|'awards'|'deliveries',q:PageQueryDto,actor:AdminIdentity,proof:AdminProof,rid:string):Promise<LotteryPageDto>{
  return this.db.transaction(async c=>{
   await this.auth.authorize(c,actor,proof,rid);
   if(!(await c.query('SELECT id FROM sorteos.raffles WHERE id=$1',[id])).rowCount)fail('NOT_FOUND',404);
   const sources={
    prizes:`SELECT p.id,p.title,'' AS number,CASE WHEN a.id IS NULL THEN 'AVAILABLE' ELSE 'AWARDED' END AS status,'' AS reference,p.created_at AS event_at,NULL::uuid AS order_id,'' AS customer_name,'' AS customer_phone,'' AS actor_id FROM sorteos.lottery_prizes p LEFT JOIN sorteos.lottery_awards a ON a.prize_id=p.id WHERE p.raffle_id=$1`,
    results:`SELECT x.id,'Pick 4 + FIREBALL' AS title,x.number,CASE WHEN x.eligible_order_id IS NOT NULL THEN 'ELIGIBLE' WHEN x.sales_closed THEN 'NO_ELIGIBLE_WINNER' ELSE 'PRELIMINARY' END AS status,x.reference,x.event_at,x.eligible_order_id AS order_id,coalesce(c.name,'') AS customer_name,coalesce(c.phone,'') AS customer_phone,x.created_by::text AS actor_id FROM sorteos.lottery_results x LEFT JOIN sorteos.orders o ON o.id=x.eligible_order_id LEFT JOIN sorteos.customers c ON c.id=o.customer_id WHERE x.raffle_id=$1`,
    awards:`SELECT a.id,a.prize_snapshot AS title,r.number,CASE WHEN d.id IS NULL THEN 'CONFIRMED' ELSE 'DELIVERED' END AS status,r.reference,a.created_at AS event_at,a.order_id,c.name AS customer_name,c.phone AS customer_phone,a.created_by::text AS actor_id FROM sorteos.lottery_awards a JOIN sorteos.lottery_results r ON r.id=a.result_id JOIN sorteos.orders o ON o.id=a.order_id JOIN sorteos.customers c ON c.id=o.customer_id LEFT JOIN sorteos.prize_deliveries d ON d.lottery_award_id=a.id WHERE a.raffle_id=$1`,
    deliveries:`SELECT d.id,coalesce(a.prize_snapshot,b.prize_snapshot->>'title') AS title,coalesce(r.number,lpad(n.number::text,5,'0')) AS number,'DELIVERED' AS status,d.reference,d.delivered_at AS event_at,coalesce(a.order_id,b.order_id) AS order_id,c.name AS customer_name,c.phone AS customer_phone,d.created_by::text AS actor_id FROM sorteos.prize_deliveries d LEFT JOIN sorteos.lottery_awards a ON a.id=d.lottery_award_id LEFT JOIN sorteos.lottery_results r ON r.id=a.result_id LEFT JOIN sorteos.blessed_awards b ON b.id=d.blessed_award_id LEFT JOIN sorteos.blessed_numbers n ON n.id=b.blessing_id JOIN sorteos.orders o ON o.id=coalesce(a.order_id,b.order_id) JOIN sorteos.customers c ON c.id=o.customer_id WHERE coalesce(a.raffle_id,b.raffle_id)=$1`
   };
   const sql=sources[kind];
   const total=(await c.query(`SELECT count(*)::int AS n FROM (${sql}) s`,[id])).rows[0].n as number;
   const rows=(await c.query(`SELECT * FROM (${sql}) s ORDER BY event_at DESC,id LIMIT $2 OFFSET $3`,[id,q.pageSize,(q.page-1)*q.pageSize])).rows;
   await c.query("INSERT INTO sorteos.audit_logs(actor_kind,actor_id,action,entity,entity_id,request_id) VALUES('ADMIN',$1,'LOTTERY_HISTORY_READ','raffles',$2,$3)",[actor.id,id,rid]);
   return {total,items:rows.map(r=>({id:r.id,title:r.title,number:r.number,status:r.status,reference:r.reference,eventAt:r.event_at.toISOString(),orderId:r.order_id??'',customerName:r.customer_name,customerPhone:r.customer_phone,actorId:r.actor_id}))};
  },false,true);
 }
}
