import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { HttpException } from '@nestjs/common';
import sharp from 'sharp';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { ReceiptService } from '../src/orders/receipt.service';
import { parseConfig } from '../src/config/config';

const config=parseConfig({NODE_ENV:'test',LOG_LEVEL:'silent'});
const rejected=(status:number,code:string)=>(error:unknown)=>{
  assert.ok(error instanceof HttpException);
  assert.equal(error.getStatus(),status);assert.deepEqual(error.getResponse(),{code});return true;
};
const file=(bytes:Buffer,mimetype='image/png')=>({buffer:bytes,size:bytes.length,mimetype});

test('comprobantes reales JPG, PNG y PDF conservan sus bytes originales',async()=>{
  const service=new ReceiptService(config);
  const png=await sharp({create:{width:24,height:24,channels:3,background:'#fff'}}).png().toBuffer();
  const jpg=await sharp(png).jpeg().toBuffer();
  const pdf=await PDFDocument.create();pdf.addPage();const document=Buffer.from(await pdf.save());
  for(const [bytes,mime,extension]of [[png,'image/png','png'],[jpg,'image/jpeg','jpg'],[document,'application/pdf','pdf']] as const){
    const validated=await service.validate(file(bytes,mime));
    assert.deepEqual(validated.bytes,bytes);assert.equal(validated.mime,mime);assert.equal(validated.extension,extension);
  }
});

test('archivos falsos, truncados, fuera del límite de píxeles y PDF activo siguen siendo 422',async()=>{
  const service=new ReceiptService(config);
  const jpg=await sharp({create:{width:24,height:24,channels:3,background:'#fff'}}).jpeg().toBuffer();
  const oversized=await sharp({create:{width:4000,height:3000,channels:3,background:'#fff'}}).jpeg().toBuffer();
  const pdf=await PDFDocument.create();pdf.addPage();
  pdf.catalog.set(PDFName.of('OpenAction'),pdf.context.obj({S:PDFName.of('JavaScript'),JS:PDFString.of('private-input')}));
  for(const invalid of [file(Buffer.from('fake PNG')),file(jpg.subarray(0,20),'image/jpeg'),
    file(oversized,'image/jpeg'),file(Buffer.from(await pdf.save()),'application/pdf')]){
    await assert.rejects(service.validate(invalid),rejected(422,'INVALID_RECEIPT'));
  }
});

test('worker ausente devuelve 503 y libera capacidad para reintentos concurrentes',async()=>{
  class MissingWorker extends ReceiptService {
    protected override startWorker(){return new Worker(resolve(__dirname,'missing-receipt-worker.js'),{execArgv:[],stdout:true,stderr:true});}
  }
  const service=new MissingWorker(config);
  await Promise.all(Array.from({length:5},()=>assert.rejects(service.validate(file(Buffer.from('fixture'))),
    rejected(503,'RECEIPT_VALIDATION_UNAVAILABLE'))));
});

test('fallo al arrancar, excepción, salida sin resultado y protocolo inválido no culpan al archivo',async()=>{
  class UnavailableWorker extends ReceiptService {
    constructor(private readonly script:string|null){super(config);}
    protected override startWorker(){
      if(this.script===null)throw new Error('PRIVATE_SERVER_PATH');
      return new Worker(this.script,{eval:true,execArgv:[],stdout:true,stderr:true});
    }
  }
  for(const script of [null,"throw new Error('PRIVATE_RECEIPT_INPUT')",'process.exit(0)',
    "require('node:worker_threads').parentPort.postMessage({unexpected:'PRIVATE_INPUT'})"]){
    await assert.rejects(new UnavailableWorker(script).validate(file(Buffer.from('fixture'))),
      rejected(503,'RECEIPT_VALIDATION_UNAVAILABLE'));
  }
});

test('timeout del worker devuelve 503 y los diagnósticos omiten entrada y excepciones privadas',{timeout:25000},()=>{
  const script=`
    const {Worker}=require('node:worker_threads');
    const {ReceiptService}=require('./src/orders/receipt.service');
    const {parseConfig}=require('./src/config/config');
    const config=parseConfig({NODE_ENV:'test',LOG_LEVEL:'info'});
    const file={buffer:Buffer.from('PRIVATE_FILE_CONTENT'),size:20,mimetype:'image/png'};
    class HangingWorker extends ReceiptService {
      startWorker(){return new Worker('setInterval(()=>{},1000)',{eval:true,execArgv:[],stdout:true,stderr:true});}
    }
    class BrokenWorker extends ReceiptService {
      startWorker(){throw new Error('PRIVATE_SERVER_PATH');}
    }
    (async()=>{
      for(const service of [new BrokenWorker(config),new ReceiptService(config),new HangingWorker(config)]){
        try{await service.validate(file,'receipt-fixture');process.exitCode=1;}
        catch(error){if(![422,503].includes(error.getStatus()))process.exitCode=1;}
      }
    })().catch(()=>{process.exitCode=1;});
  `;
  const result=spawnSync(process.execPath,['-r','ts-node/register','-e',script],{
    cwd:resolve(__dirname,'..'),encoding:'utf8',timeout:22000,windowsHide:true,
  });
  assert.ifError(result.error);assert.equal(result.status,0);
  const records=result.stdout.trim().split(/\r?\n/).map(line=>JSON.parse(line) as Record<string,unknown>);
  assert.deepEqual(records.map(record=>record.reason),['WORKER_START','IMAGE_SIGNATURE','WORKER_TIMEOUT']);
  assert.ok(records.every(record=>record.requestId==='receipt-fixture'));
  assert.deepEqual(records.map(record=>record.code),['RECEIPT_VALIDATION_UNAVAILABLE','INVALID_RECEIPT','RECEIPT_VALIDATION_UNAVAILABLE']);
  assert.ok(!(result.stdout+result.stderr).includes('PRIVATE_'));
});
