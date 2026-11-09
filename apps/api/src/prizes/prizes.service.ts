import { createHash } from 'node:crypto';
import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AdminIdentity, AdminProof } from '../auth/admin.guard';
import { FinancialAuthorization } from '../auth/financial.guard';
import { PageQueryDto } from '../common/pagination';
import { chooseNumbers } from '../checkout/numbers';
import { AwardQueryDto, BlessedAwardsPageDto, BlessedNumberDto, BlessedNumbersInputDto, BlessedSelection, PrizeConfigurationDto, PrizeInputDto, PrizeKind, PrizeMutationDto, PrizeDto } from './prizes.dto';
import { prizesReady, publicBlessings } from './prizes.core';
function fail(code:string,status:number):never{throw new HttpException({code},status);}

@Injectable()
export class PrizesService {
  constructor(private readonly db:DatabaseService,private readonly auth:FinancialAuthorization){}
  private async ready(c:PoolClient){if(!await prizesReady(c))fail('PRIZES_NOT_READY',503);}
  private async raffle(c:PoolClient,id:string,lock=false){
    const row=(await c.query<{id:string;status:string;version:number;total_tickets:number;published_at:Date|null}>(`SELECT id,status,version,total_tickets,published_at FROM sorteos.raffles WHERE id=$1 ${lock?'FOR UPDATE':''}`,[id])).rows[0];
    if(!row)fail('NOT_FOUND',404);return row;
  }
  private async configurable(c:PoolClient,id:string){
    const row=await this.raffle(c,id,true);
    const holds=await c.query('SELECT 1 FROM sorteos.checkout_holds WHERE raffle_id=$1 LIMIT 1',[id]);
    if(row.status!=='DRAFT'||row.published_at!==null||holds.rowCount)fail('PRIZES_LOCKED',409);
    return row;
  }
  private async mutation(id:string,action:string,body:PrizeInputDto|BlessedNumbersInputDto,key:string,actor:AdminIdentity,proof:AdminProof,requestId:string,work:(c:PoolClient)=>Promise<{prizeId:string;numbers:PrizeMutationDto['numbers']}>):Promise<PrizeMutationDto>{
    if(actor.role!=='OWNER')throw new ForbiddenException();
    const fingerprint=createHash('sha256').update(JSON.stringify([id.toLowerCase(),action,body])).digest('hex');
    return this.db.transaction(async c=>{
      await this.auth.authorize(c,actor,proof,requestId);await this.ready(c);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`prize-action:${actor.id}:${key.toLowerCase()}`]);
      const old=(await c.query<{metadata:{fingerprint:string;result:PrizeMutationDto}}>(`SELECT metadata FROM sorteos.audit_logs WHERE actor_id=$1
        AND action IN ('PRIZE_CREATED','BLESSED_NUMBERS_CREATED') AND metadata->>'idempotencyKey'=$2`,[actor.id,key.toLowerCase()])).rows[0];
      if(old){if(old.metadata.fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT',409);return old.metadata.result;}
      const row=await this.configurable(c,id);if(row.version!==body.expectedVersion)fail('CONCURRENT_MODIFICATION',409);
      const value=await work(c);
      // Use the same optimistic version as publishing, so configuration/publication races conflict.
      const version=(await c.query<{version:number}>('UPDATE sorteos.raffles SET updated_at=now() WHERE id=$1 RETURNING version',[id])).rows[0]!.version;
      const result={...value,version};
      await c.query(`INSERT INTO sorteos.audit_logs(actor_kind,actor_id,action,entity,entity_id,request_id,metadata)
        VALUES('ADMIN',$1,$2,'raffles',$3,$4,$5::jsonb)`,[actor.id,action,id,requestId,JSON.stringify({idempotencyKey:key.toLowerCase(),fingerprint,result})]);
      return result;
    });
  }
  async configuration(id:string,actor:AdminIdentity,proof:AdminProof,requestId:string):Promise<PrizeConfigurationDto>{
    return this.db.transaction(async c=>{
      await this.auth.authorize(c,actor,proof,requestId);await this.ready(c);const row=await this.raffle(c,id);
      const prizes=(await c.query<PrizeDto & {amountMinor:number|string|null}>(`SELECT p.id,p.title,p.description,p.kind,p.amount_minor::text AS "amountMinor",p.quantity,
        (SELECT count(*)::int FROM sorteos.blessed_numbers b WHERE b.prize_id=p.id) AS "assignedNumbers"
        FROM sorteos.raffle_prizes p WHERE raffle_id=$1 ORDER BY created_at,id`,[id])).rows.map(p=>({...p,amountMinor:p.amountMinor===null?null:Number(p.amountMinor)}));
      const holds=(await c.query('SELECT 1 FROM sorteos.checkout_holds WHERE raffle_id=$1 LIMIT 1',[id])).rowCount;
      return {version:row.version,configurable:row.status==='DRAFT'&&row.published_at===null&&!holds,prizes};
    },false,true);
  }
  createPrize(id:string,body:PrizeInputDto,key:string,actor:AdminIdentity,proof:AdminProof,requestId:string){
    if((body.kind===PrizeKind.MONEY)!==(body.amountMinor!==undefined&&body.amountMinor!==null))fail('INVALID_PRIZE',422);
    return this.mutation(id,'PRIZE_CREATED',body,key,actor,proof,requestId,async c=>{
      const prize=(await c.query<{id:string}>(`INSERT INTO sorteos.raffle_prizes(raffle_id,title,description,kind,amount_minor,quantity)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[id,body.title,body.description,body.kind,body.amountMinor??null,body.quantity])).rows[0]!;
      return {prizeId:prize.id,numbers:[]};
    });
  }
  createNumbers(id:string,body:BlessedNumbersInputDto,key:string,actor:AdminIdentity,proof:AdminProof,requestId:string){
    const manual=body.mode===BlessedSelection.MANUAL;
    if(manual?(!body.numbers?.length||body.quantity!==undefined):(body.numbers!==undefined||body.quantity===undefined))fail('INVALID_PRIZE',422);
    return this.mutation(id,'BLESSED_NUMBERS_CREATED',body,key,actor,proof,requestId,async c=>{
      const raffle=await this.raffle(c,id);
      const prize=(await c.query<PrizeDto & {quantity:number}>('SELECT id,quantity FROM sorteos.raffle_prizes WHERE id=$1 AND raffle_id=$2 FOR UPDATE',[body.prizeId,id])).rows[0];
      if(!prize)fail('NOT_FOUND',404);
      const occupied=(await c.query<{number:number;prize_id:string}>('SELECT number,prize_id FROM sorteos.blessed_numbers WHERE raffle_id=$1 ORDER BY number',[id])).rows;
      const count=manual?body.numbers!.length:body.quantity!,total=Math.min(100000,raffle.total_tickets);
      if(count>prize.quantity-occupied.filter(b=>b.prize_id===prize.id).length||count>total-occupied.length)fail('PRIZE_CAPACITY_EXCEEDED',422);
      const numbers=manual?body.numbers!.map(Number):chooseNumbers(total,occupied.map(b=>b.number),count);
      if(numbers.some(n=>n>=total))fail('INVALID_PRIZE',422);
      if(numbers.some(n=>occupied.some(b=>b.number===n)))fail('BLESSED_NUMBER_EXISTS',409);
      await c.query(`INSERT INTO sorteos.blessed_numbers(raffle_id,number,prize_id)
        SELECT $1,n,$3 FROM unnest($2::int[]) AS n ORDER BY n`,[id,numbers,body.prizeId]);
      const selected=(await c.query<Omit<BlessedNumberDto,'amountMinor'>&{amountMinor:string|null}>(`SELECT lpad(b.number::text,5,'0') AS number,
        p.title AS "prizeTitle",p.description AS "prizeDescription",p.kind AS "prizeKind",p.amount_minor::text AS "amountMinor"
        FROM sorteos.blessed_numbers b JOIN sorteos.raffle_prizes p ON p.id=b.prize_id WHERE b.raffle_id=$1 AND b.number=ANY($2::int[]) ORDER BY b.number`,[id,numbers])).rows;
      return {prizeId:prize.id,numbers:selected.map(n=>({...n,amountMinor:n.amountMinor===null?null:Number(n.amountMinor)}))};
    });
  }
  async numbers(id:string,query:PageQueryDto,publicRoute=false,actor?:AdminIdentity,proof?:AdminProof,requestId?:string){
    return this.db.transaction(async c=>{
      if(!publicRoute){await this.auth.authorize(c,actor!,proof!,requestId!);await this.ready(c);}
      const row=publicRoute?(await c.query<{id:string}>("SELECT id FROM sorteos.raffles WHERE slug=$1 AND status='PUBLISHED'",[id])).rows[0]:await this.raffle(c,id);
      if(!row)fail('NOT_FOUND',404);
      const data=await publicBlessings(c,row.id,query.pageSize,(query.page-1)*query.pageSize);
      return {items:data.items,pagination:{page:query.page,pageSize:query.pageSize,total:data.total}};
    },publicRoute,!publicRoute);
  }
  async awards(id:string,query:AwardQueryDto,actor:AdminIdentity,proof:AdminProof,requestId:string):Promise<BlessedAwardsPageDto>{
    return this.db.transaction(async c=>{
      await this.auth.authorize(c,actor,proof,requestId);await this.ready(c);await this.raffle(c,id);
      const filter=query.status??null;
      const total=(await c.query<{n:number}>(`SELECT count(*)::int AS n FROM sorteos.blessed_awards WHERE raffle_id=$1 AND ($2::text IS NULL OR status=$2)`,[id,filter])).rows[0]!.n;
      const items=(await c.query(`SELECT a.id,lpad(b.number::text,5,'0') AS number,a.status,a.prize_snapshot->>'title' AS "prizeTitle",
        a.prize_snapshot->>'description' AS "prizeDescription",a.prize_snapshot->>'kind' AS "prizeKind",a.prize_snapshot->>'amountMinor' AS "amountMinor",
        o.id AS "orderId",o.order_code AS "orderCode",o.status AS "orderStatus",c.name AS "customerName",c.phone AS "customerPhone",c.email AS "customerEmail",a.created_at AS "createdAt"
        FROM sorteos.blessed_awards a JOIN sorteos.blessed_numbers b ON b.id=a.blessing_id
        JOIN sorteos.orders o ON o.id=a.order_id JOIN sorteos.customers c ON c.id=o.customer_id
        WHERE a.raffle_id=$1 AND ($2::text IS NULL OR a.status=$2) ORDER BY a.created_at DESC,a.id LIMIT $3 OFFSET $4`,[id,filter,query.pageSize,(query.page-1)*query.pageSize])).rows
        .map(row=>({...row,amountMinor:row.amountMinor===null?null:Number(row.amountMinor),createdAt:row.createdAt.toISOString()}));
      await c.query(`INSERT INTO sorteos.audit_logs(actor_kind,actor_id,action,entity,entity_id,request_id)
        VALUES('ADMIN',$1,'BLESSED_BENEFICIARIES_READ','raffles',$2,$3)`,[actor.id,id,requestId]);
      return {items,pagination:{page:query.page,pageSize:query.pageSize,total}};
    },false,true);
  }
}
