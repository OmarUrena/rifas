import { Inject, Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/config';
import { fetchFromServer } from '../common/server-fetch';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export type PrizeUpload={buffer:Buffer;size:number;mimetype:string};

@Injectable()
export class MediaService {
  private processing=0;
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  url(key: string): string {
    if(this.config.developmentLocalMedia&&/^prizes\/local-[a-f0-9-]{36}\.webp$/.test(key))return `http://${this.config.host}:${this.config.port}/api/v1/media/${key.slice(13,-5)}`;
    if (!this.config.supabaseUrl) throw new ServiceUnavailableException({code:'MEDIA_UNAVAILABLE'});
    return `${this.config.supabaseUrl}/storage/v1/object/public/${this.config.publicMediaBucket}/${key}`;
  }
  async verify(keys: string[]): Promise<void> {
    if (!keys.length) throw new UnprocessableEntityException({code:'PUBLICATION_REQUIREMENTS_NOT_MET'});
    await Promise.all(keys.map(async key => {
      if(this.config.developmentLocalMedia&&/^prizes\/local-[a-f0-9-]{36}\.webp$/.test(key)){
        try{await this.localRead(key.slice(13,-5));return;}catch{throw new UnprocessableEntityException({code:'INVALID_MEDIA'});}
      }
      let response: Awaited<ReturnType<typeof fetchFromServer>>;
      try { response = await fetchFromServer(this.url(key), {method:'HEAD',redirect:'error',signal:AbortSignal.timeout(2000)}); }
      catch { throw new ServiceUnavailableException({code:'MEDIA_UNAVAILABLE'}); }
      if (!response.ok || !/^image\/(jpeg|png|webp|avif)(;|$)/.test(response.headers.get('content-type') ?? '')) {
        throw new UnprocessableEntityException({code:'INVALID_MEDIA'});
      }
    }));
  }
  private async localPath(id:string){
    if(!this.config.developmentLocalMedia||!['development','test'].includes(this.config.environment)||!/^[a-f0-9-]{36}$/.test(id))throw new ServiceUnavailableException({code:'MEDIA_UNAVAILABLE'});
    const root=resolve(__dirname,'../../../../.tmp/development-media');
    for(const dir of [resolve(root,'..'),root]){await mkdir(dir,{recursive:true});if((await lstat(dir)).isSymbolicLink())throw new Error('Invalid media directory');}
    const file=resolve(root,id+'.webp');
    try{if((await lstat(file)).isSymbolicLink())throw new Error('Invalid media file');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    return file;
  }
  async localRead(id:string){return readFile(await this.localPath(id));}
  private storage(){
    if(!this.config.supabaseUrl||!this.config.storageKey)throw new ServiceUnavailableException({code:'MEDIA_UNAVAILABLE'});
    return createClient(this.config.supabaseUrl,this.config.storageKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetchFromServer(input,{...init,redirect:'error',signal:AbortSignal.timeout(5000)})}}).storage;
  }
  async remove(key:string){
    if(this.config.developmentLocalMedia&&key.startsWith('prizes/local-')){await unlink(await this.localPath(key.slice(13,-5)));return;}
    const result=await this.storage().from(this.config.publicMediaBucket).remove([key]);if(result.error)throw new ServiceUnavailableException({code:'MEDIA_UNAVAILABLE'});
  }
  async upload(file:PrizeUpload|undefined){
    if(!file||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp','image/avif'].includes(file.mimetype))throw new UnprocessableEntityException({code:'INVALID_MEDIA'});
    if(this.processing>=2)throw new ServiceUnavailableException({code:'MEDIA_UNAVAILABLE'});
    this.processing++;
    let bytes:Buffer;
    try{
      const image=sharp(file.buffer,{limitInputPixels:20000000,animated:false});
      const meta=await image.metadata();
      if(!['jpeg','png','webp','avif','heif'].includes(meta.format??'')||(meta.pages??1)>1)throw new Error('Invalid image');
      bytes=await image.rotate().resize(2000,2000,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
    }catch{throw new UnprocessableEntityException({code:'INVALID_MEDIA'});}finally{this.processing--;}
    const id=randomUUID(),key=`prizes/${this.config.developmentLocalMedia?'local-':''}${id}.webp`;
    try{
      if(this.config.developmentLocalMedia)await writeFile(await this.localPath(id),bytes,{flag:'wx'});
      else{
        const storage=this.storage(),bucket=await storage.getBucket(this.config.publicMediaBucket);
        if(bucket.error||bucket.data.public!==true)throw new Error('Public prize bucket required');
        const uploaded=await storage.from(this.config.publicMediaBucket).upload(key,bytes,{contentType:'image/webp',upsert:false,cacheControl:'3600'});
        if(uploaded.error)throw new Error('Upload failed');
      }
      return {storageKey:key,url:this.url(key)};
    }catch{throw new ServiceUnavailableException({code:'MEDIA_UNAVAILABLE'});}
  }
}
