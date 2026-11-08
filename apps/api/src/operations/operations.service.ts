import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { inventory } from '../catalog/inventory';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { FinancialAuthorization } from '../auth/financial.guard';
import { AdminIdentity, AdminProof } from '../auth/admin.guard';
import { OperationSummaryDto, OrdersCsvQueryDto } from './operations.dto';

export function csvCell(value:unknown):string {
  let text=String(value??'');
  if (/^\s*[=+\-@]/u.test(text)||Array.from(text).some(char=>char.charCodeAt(0)<32)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
@Injectable()
export class OperationsService {
  constructor(private readonly db:DatabaseService,private readonly auth:FinancialAuthorization){}
  private async audit(c:PoolClient,actor:AdminIdentity,requestId:string,action:string,id:string|null,metadata:object={}) {
    await c.query(`INSERT INTO sorteos.audit_logs(actor_kind,actor_id,action,entity,entity_id,request_id,metadata)
      VALUES('ADMIN',$1,$2,'raffles',$3,$4,$5::jsonb)`,[actor.id,action,id??actor.id,requestId,JSON.stringify(metadata)]);
  }
  async summary(id:string|undefined,actor:AdminIdentity,proof:AdminProof,requestId:string):Promise<OperationSummaryDto> {
    return this.db.transaction(async c=>{
      await this.auth.authorize(c,actor,proof,requestId);
      if(id&&!(await c.query('SELECT id FROM sorteos.raffles WHERE id=$1',[id])).rowCount)throw new NotFoundException();
      const stock=await inventory(c,id??null);
      const money=(await c.query<{confirmedAmountMinor:string;pendingAmountMinor:string;pendingOrders:number}>(`
        SELECT coalesce(sum(total_minor) FILTER(WHERE status='PAID'),0)::text AS "confirmedAmountMinor",
        coalesce(sum(total_minor) FILTER(WHERE status IN('PENDING_REVIEW','UNDER_REVIEW','NEEDS_RESOLUTION')),0)::text AS "pendingAmountMinor",
        count(*) FILTER(WHERE status IN('PENDING_REVIEW','UNDER_REVIEW','NEEDS_RESOLUTION'))::int AS "pendingOrders"
        FROM sorteos.orders WHERE ($1::uuid IS NULL OR raffle_id=$1)`,[id??null])).rows[0]!;
      const incidents=(await c.query<{count:number}>(`SELECT count(*)::int AS count FROM sorteos.payment_incidents i
        LEFT JOIN sorteos.orders o ON o.id=i.order_id LEFT JOIN sorteos.checkout_holds h ON h.id=i.hold_id
        WHERE i.status<>'RESOLVED' AND ($1::uuid IS NULL OR coalesce(o.raffle_id,h.raffle_id)=$1)`,[id??null])).rows[0]!.count;
      const active=(await c.query<{count:number}>(`SELECT count(*)::int AS count FROM sorteos.raffles WHERE status='PUBLISHED' AND ($1::uuid IS NULL OR id=$1)`,[id??null])).rows[0]!.count;
      await this.audit(c,actor,requestId,'OPERATIONS_SUMMARY_READ',id??null);
      return {...stock,...money,openIncidents:incidents,activeRaffles:active};
    },false,true);
  }
  async close(id:string,version:number,actor:AdminIdentity,proof:AdminProof,requestId:string) {
    if(actor.role!=='OWNER')throw new ForbiddenException();
    return this.db.transaction(async c=>{
      await this.auth.authorize(c,actor,proof,requestId);
      const row=(await c.query<{status:string;version:number}>('SELECT status,version FROM sorteos.raffles WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!row)throw new NotFoundException();
      if(row.version!==version)throw new ConflictException({code:'CONCURRENT_MODIFICATION'});
      if(row.status!=='PAUSED')throw new ConflictException({code:'CLOSE_REQUIRES_PAUSE'});
      const holds=await c.query("SELECT id FROM sorteos.checkout_holds WHERE raffle_id=$1 AND status='ACTIVE' AND expires_at>now() LIMIT 1",[id]);
      if(holds.rowCount)throw new ConflictException({code:'ACTIVE_HOLDS_EXIST'});
      await c.query("UPDATE sorteos.raffles SET status='CLOSED' WHERE id=$1",[id]);
      await this.audit(c,actor,requestId,'RAFFLE_CLOSED',id);
      return {id,status:'CLOSED' as const,version:row.version+1};
    });
  }
  async csv(query:OrdersCsvQueryDto,actor:AdminIdentity,proof:AdminProof,requestId:string) {
    if(actor.role!=='OWNER')throw new ForbiddenException();
    if(query.from&&query.to&&Date.parse(query.from)>Date.parse(query.to))throw new UnprocessableEntityException({code:'INVALID_DATE_RANGE'});
    return this.db.transaction(async c=>{
      await this.auth.authorize(c,actor,proof,requestId);
      const rows=(await c.query<{order_code:string;raffle_slug:string;status:string;quantity:number;total_minor:string;created_at:Date}>(`
        SELECT o.order_code,r.slug AS raffle_slug,o.status,o.ticket_quantity AS quantity,o.total_minor,o.created_at
        FROM sorteos.orders o JOIN sorteos.raffles r ON r.id=o.raffle_id
        WHERE ($1::text IS NULL OR o.status::text=$1) AND ($2::uuid IS NULL OR o.raffle_id=$2)
          AND ($3::timestamptz IS NULL OR o.created_at>=$3) AND ($4::timestamptz IS NULL OR o.created_at<=$4)
        ORDER BY o.created_at DESC,o.id LIMIT 10001`,[query.status??null,query.raffleId??null,query.from??null,query.to??null])).rows;
      if(rows.length>10000)throw new UnprocessableEntityException({code:'EXPORT_TOO_LARGE'});
      await this.audit(c,actor,requestId,'ORDERS_CSV_EXPORTED',query.raffleId??null,{count:rows.length,status:query.status??null,from:query.from??null,to:query.to??null});
      return '\ufeff'+[['codigo_orden','rifa','estado','cantidad','total_centavos_DOP','creada_UTC'],...rows.map(r=>[r.order_code,r.raffle_slug,r.status,r.quantity,r.total_minor,r.created_at.toISOString()])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
    },false,true);
  }
}
