import { Inject, Injectable, HttpException } from '@nestjs/common';
import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { APP_CONFIG, AppConfig } from '../config/config';
import { SafeLogger } from '../common/logger';

export interface ReceiptUpload {buffer:Buffer;mimetype:string;size:number}
export interface ValidReceipt {bytes:Buffer;mime:string;extension:string}
@Injectable()
export class ReceiptService {
  private active=0;
  private waiting:(()=>void)[]=[];
  private workerCode?:string;
  private readonly logger:SafeLogger;
  constructor(@Inject(APP_CONFIG) private readonly config:AppConfig){this.logger=new SafeLogger(config.logLevel);}
  protected startWorker(file:ReceiptUpload):Worker {
    const source=__filename.endsWith('.ts');
    // Static reference keeps the compiled worker and its imports in the deployment trace.
    const path=source?resolve(__dirname,'receipt.worker.ts'):require.resolve('./receipt.worker.js');
    if(source&&!this.workerCode) {
      const ts=createRequire(__filename)('typescript') as typeof import('typescript');
      const compiled=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,
        target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
      this.workerCode=`(function(require){${compiled}\n})(require('node:module').createRequire(${JSON.stringify(path)}));`;
    }
    return new Worker(source?this.workerCode!:path,{
      eval:source,execArgv:[],workerData:{bytes:file.buffer,mime:file.mimetype},
      stdout:true,stderr:true,
      resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32},
    });
  }
  async validate(file:ReceiptUpload|undefined,requestId?:string):Promise<ValidReceipt> {
    if(!file?.buffer.length)throw new HttpException({code:'INVALID_RECEIPT'},422);
    if(file.size>this.config.receiptMaxBytes)throw new HttpException({code:'FILE_TOO_LARGE'},413);
    if(!['image/jpeg','image/png','application/pdf'].includes(file.mimetype))throw new HttpException({code:'UNSUPPORTED_FILE_TYPE'},415);
    if(this.active>=2)await new Promise<void>(resolve=>this.waiting.push(resolve));else this.active++;
    try {
      return await new Promise<ValidReceipt>((accept,reject)=>{
        const unavailable=(reason:string)=>{
          this.logger.output.error({event:'receipt_validation_failed',requestId,reason,code:'RECEIPT_VALIDATION_UNAVAILABLE'});
          reject(new HttpException({code:'RECEIPT_VALIDATION_UNAVAILABLE'},503));
        };
        let worker:Worker;
        try{worker=this.startWorker(file);}catch{unavailable('WORKER_START');return;}
        // Parsers pueden imprimir fragmentos de entrada: nunca enviarlos a logs.
        worker.stdout?.resume();worker.stderr?.resume();
        let finished=false;
        const end=async(data?:unknown,failure?:string)=>{
          // Node --watch forwards dependency notifications through worker message events.
          // They are not parser results; keep waiting for the validated receipt payload.
          if(data&&typeof data==='object'&&Object.keys(data).length===1
            &&Object.entries(data).some(([key,value])=>['watch:require','watch:import'].includes(key)
              &&Array.isArray(value)&&value.every(item=>typeof item==='string'||item===undefined)))return;
          if(finished)return;finished=true;clearTimeout(timer);
          // Complete teardown before releasing capacity or returning the HTTP response.
          try{await worker.terminate();}catch{unavailable('WORKER_TERMINATE');return;}
          if(failure){unavailable(failure);return;}
          if(data&&typeof data==='object'&&'invalid'in data&&data.invalid===true){
            const reasons=['FILE_STRUCTURE','IMAGE_SIGNATURE','IMAGE_DECODE','IMAGE_PAGES','PDF_STRUCTURE','PDF_DECODE','PDF_PAGES','PDF_CONTENT'];
            const reason='reason'in data&&typeof data.reason==='string'&&reasons.includes(data.reason)?data.reason:'FILE_STRUCTURE';
            this.logger.output.warn({event:'receipt_rejected',requestId,reason,code:'INVALID_RECEIPT'});
            reject(new HttpException({code:'INVALID_RECEIPT'},422));return;
          }
          if(!data||typeof data!=='object'||!('bytes'in data)||!(data.bytes instanceof Uint8Array)
            ||!data.bytes.length||data.bytes.length>this.config.receiptMaxBytes
            ||!('mime'in data)||typeof data.mime!=='string'||!['image/jpeg','image/png','application/pdf'].includes(data.mime)
            ||!('extension'in data)||typeof data.extension!=='string'||!['jpg','png','pdf'].includes(data.extension))
            unavailable('WORKER_PROTOCOL');
          else accept({bytes:Buffer.from(data.bytes),mime:data.mime,extension:data.extension});
        };
        const timer=setTimeout(()=>{void end(undefined,'WORKER_TIMEOUT');},10000);
        worker.on('message',data=>{void end(data);});
        worker.once('error',error=>{
          const code='code'in error?String(error.code):'';
          const reason=['MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND','ERR_WORKER_OUT_OF_MEMORY'].includes(code)?code:'WORKER_ERROR';
          void end(undefined,reason);
        });
        worker.once('exit',()=>{void end(undefined,'WORKER_EXIT');});
      });
    }finally{const next=this.waiting.shift();if(next)next();else this.active--;}
  }
}
