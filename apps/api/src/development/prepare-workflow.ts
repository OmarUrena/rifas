import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Inject, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Client } from 'pg';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { APP_CONFIG, AppConfig } from '../config/config';
import { loadConfig } from '../config/load-config';

@Injectable()
export class DevelopmentWorkflowSetup {
  constructor(@Inject(APP_CONFIG) private readonly config:AppConfig){}
  async prepare(){
    const config=this.config,until=Date.parse(config.developmentMfaUntil??'');
    if(!['development','test'].includes(config.environment)||!config.developmentLocalReceipts
      ||!config.developmentMfaToken||!config.databaseUrl||!Number.isFinite(until)||until<=Date.now()||until>Date.now()+8*3600000)
      throw new Error('La preparacion requiere capacidad de desarrollo vigente y almacenamiento privado DEMO');
    const database=new URL(config.databaseUrl);
    if(!['127.0.0.1','localhost','[::1]'].includes(database.hostname)){
      const project=new URL(config.supabaseUrl??'').hostname.split('.')[0];
      if(!database.hostname.endsWith('.pooler.supabase.com')||!decodeURIComponent(database.username).endsWith('.'+project))
        throw new Error('La DB no coincide con el proyecto Auth de desarrollo');
    }
    // Own generated DEMO artwork. Filesystem work happens before opening the DB transaction.
    const directory=resolve(__dirname,'../../../../apps/web/public/development/prizes');
    await mkdir(directory,{recursive:true});
    const image=await sharp({create:{width:640,height:360,channels:3,background:'#153a35'}}).png().toBuffer();
    await writeFile(resolve(directory,'development-demo.png'),image);
    const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.HelveticaBold),page=pdf.addPage([600,300]);
    page.drawText('COMPROBANTE DEMO - NO ES UN PAGO',{x:30,y:220,size:22,font,color:rgb(0.7,0,0)});
    page.drawText('Solo pruebas. Sin transferencia ni cuenta bancaria real.',{x:30,y:170,size:14,font});
    await writeFile(resolve(directory,'../comprobante-demo.pdf'),await pdf.save());
    const db=new Client({connectionString:config.databaseUrl,ssl:config.databaseSsl?{rejectUnauthorized:true,ca:config.databaseCa}:false});
    try{
      await db.connect();await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(111001,17)');
      const owner=(await db.query<{id:string}>("SELECT id FROM sorteos.admin_users WHERE active AND role='OWNER' FOR UPDATE")).rows;
      if(owner.length!==1)throw new Error('Se requiere un unico OWNER activo');
      const admin=owner[0]!.id;
      await db.query("SELECT set_config('app.actor_kind','SYSTEM',true),set_config('app.actor_id',$1,true),set_config('app.request_id',$2,true)",[admin,randomUUID()]);
      await db.query(`INSERT INTO sorteos.development_admin_access(admin_id,token_hash,expires_at) VALUES($1,$2,$3)
        ON CONFLICT(token_hash) DO NOTHING`,[admin,createHash('sha256').update(config.developmentMfaToken).digest('hex'),new Date(until)]);
      await db.query(`INSERT INTO sorteos.bank_accounts(bank_name,holder_name,account_type,account_display,is_demo,active)
        SELECT 'BANCO DEMO — NO EXISTE','TITULAR DEMO — NO REAL','DEMO','SIN CUENTA REAL — NO TRANSFERIR',true,false
        WHERE NOT EXISTS(SELECT 1 FROM sorteos.bank_accounts WHERE is_demo AND bank_name='BANCO DEMO — NO EXISTE')`);
      const slug='demo-prueba-completa';
      await db.query(`INSERT INTO sorteos.raffles(inventory_policy,slug,title,description,prize,total_tickets,ticket_price_minor,min_purchase,max_purchase,rules,rules_version,ends_at) VALUES ('LEGACY',$1,'RIFA DEMO — NO TRANSFERIR','Prueba de desarrollo sin venta ni transferencia real.','PREMIO DEMO SIN VALOR COMERCIAL',100,10000,1,20,
          'DEMO: no transferir dinero. Sin premio ni sorteo real; solo prueba del formulario y revision.','DEMO-PRUEBA-1',$2)
        ON CONFLICT(slug) DO NOTHING`,[slug,new Date(until)]);
      const raffle=(await db.query<{id:string;rules_version:string;title:string;status:string}>(
        'SELECT id,rules_version,title,status FROM sorteos.raffles WHERE slug=$1 FOR UPDATE',[slug])).rows[0]!;
      if(raffle.rules_version!=='DEMO-PRUEBA-1'||!raffle.title.includes('DEMO'))throw new Error('El slug DEMO ya tiene datos diferentes; no se sobrescriben');
      await db.query(`INSERT INTO sorteos.raffle_media(raffle_id,storage_key,alt,position,rights_confirmed)
        VALUES($1,'prizes/development-demo.png','Imagen generada propia para pruebas DEMO; no representa un premio real',0,true)
        ON CONFLICT(raffle_id,position) DO NOTHING`,[raffle.id]);
      if(raffle.status==='DRAFT')await db.query(`UPDATE sorteos.raffles SET status='PUBLISHED',publication_approved_by=$2,
        publication_approved_at=now(),approved_rules_version=rules_version WHERE id=$1`,[raffle.id,admin]);
      else if(raffle.status==='PUBLISHED')await db.query(`UPDATE sorteos.raffles SET ends_at=$2
        WHERE id=$1 AND (ends_at IS NULL OR ends_at<$2)`,[raffle.id,new Date(until)]);
      await db.query(`INSERT INTO sorteos.audit_logs(actor_kind,actor_id,action,entity,entity_id,request_id)
        VALUES('SYSTEM',$1,'DEVELOPMENT_WORKFLOW_PREPARED','raffles',$2,$3)`,[admin,raffle.id,randomUUID()]);
      await db.query('COMMIT');return {slug,expiresAt:new Date(until).toISOString(),demo:true};
    }catch(error){await db.query('ROLLBACK').catch(()=>undefined);throw error;}
    finally{await db.end();}
  }
}

@Module({}) class DevelopmentSetupModule {}
async function main(){
  if(process.env.DEVELOPMENT_SETUP_ENABLED!=='true')throw new Error('Requiere autorizacion de preparacion DEMO');
  const config=loadConfig();
  const app=await NestFactory.createApplicationContext({module:DevelopmentSetupModule,providers:[{provide:APP_CONFIG,useValue:config},DevelopmentWorkflowSetup]},{logger:false});
  try{process.stdout.write(JSON.stringify(await app.get(DevelopmentWorkflowSetup).prepare())+'\n');}
  finally{await app.close();}
}
if(require.main===module)void main().catch(()=>{process.stderr.write('Preparacion DEMO no completada. Revisar configuracion y migracion de desarrollo; no se registran secretos.\n');process.exitCode=1;});
