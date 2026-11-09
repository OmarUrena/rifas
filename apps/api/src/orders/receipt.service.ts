import { Inject, Injectable, HttpException } from '@nestjs/common';
import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { APP_CONFIG, AppConfig } from '../config/config';

export interface ReceiptUpload {buffer:Buffer;mimetype:string;size:number}
export interface ValidReceipt {bytes:Buffer;mime:string;extension:string}
@Injectable()
export class ReceiptService {
  private active=0;
  private waiting:(()=>void)[]=[];
  private workerCode?:string;
  constructor(@Inject(APP_CONFIG) private readonly config:AppConfig){}
  async validate(file:ReceiptUpload|undefined):Promise<ValidReceipt> {
    if(!file?.buffer.length)throw new HttpException({code:'INVALID_RECEIPT'},422);
    if(file.size>this.config.receiptMaxBytes)throw new HttpException({code:'FILE_TOO_LARGE'},413);
    if(!['image/jpeg','image/png','application/pdf'].includes(file.mimetype))throw new HttpException({code:'UNSUPPORTED_FILE_TYPE'},415);
    if(this.active>=2)await new Promise<void>(resolve=>this.waiting.push(resolve));else this.active++;
    try {
      return await new Promise<ValidReceipt>((accept,reject)=>{
        const source=__filename.endsWith('.ts');
        // A static module reference lets the deployment trace include the JS worker and its imports.
        const path=source?resolve(__dirname,'receipt.worker.ts'):require.resolve('./receipt.worker.js');
        if(source&&!this.workerCode) {
          // Compilar una vez el código local de confianza, en vez de arrancar
          // ts-node para cada comprobante. Producción ejecuta el JS del build.
          const ts=createRequire(__filename)('typescript') as typeof import('typescript');
          const compiled=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,
            target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
          this.workerCode=`(function(require){${compiled}\n})(require('node:module').createRequire(${JSON.stringify(path)}));`;
        }
        const worker=new Worker(source?this.workerCode!:path,{
          eval:source,execArgv:[],workerData:{bytes:file.buffer,mime:file.mimetype},
          stdout:true,stderr:true,
          resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32},
        });
        // Parsers pueden imprimir fragmentos de entrada: nunca enviarlos a logs.
        worker.stdout?.resume();worker.stderr?.resume();
        let finished=false;
        const end=(data?:unknown)=>{
          // Node --watch forwards dependency notifications through worker message events.
          // They are not parser results; keep waiting for the validated receipt payload.
          if(data&&typeof data==='object'&&Object.keys(data).length===1
            &&Object.entries(data).some(([key,value])=>['watch:require','watch:import'].includes(key)
              &&Array.isArray(value)&&value.every(item=>typeof item==='string'||item===undefined)))return;
          if(finished)return;finished=true;clearTimeout(timer);void worker.terminate();
          if(!data||typeof data!=='object'||!('bytes'in data)||!(data.bytes instanceof Uint8Array)
            ||!data.bytes.length||data.bytes.length>this.config.receiptMaxBytes
            ||!('mime'in data)||typeof data.mime!=='string'||!['image/jpeg','image/png','application/pdf'].includes(data.mime)
            ||!('extension'in data)||typeof data.extension!=='string'||!['jpg','png','pdf'].includes(data.extension))
            reject(new HttpException({code:'INVALID_RECEIPT'},422));
          else accept({bytes:Buffer.from(data.bytes),mime:data.mime,extension:data.extension});
        };
        const timer=setTimeout(()=>end(),10000);
        worker.on('message',end);worker.once('error',()=>end());worker.once('exit',()=>end());
      });
    }finally{const next=this.waiting.shift();if(next)next();else this.active--;}
  }
}
