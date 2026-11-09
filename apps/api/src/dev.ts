import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChildProcess, spawn } from 'node:child_process';

export function sourceFingerprint(root:string):string {
  const hash=createHash('sha256');
  function add(file:string){if(existsSync(file)){hash.update(file);hash.update(readFileSync(file));}}
  function walk(directory:string){
    if(!existsSync(directory))return;
    for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const path=resolve(directory,entry.name);
      if(entry.isDirectory())walk(path);else if(entry.isFile()&&/\.(ts|json)$/.test(entry.name))add(path);
    }
  }
  walk(resolve(root,'src'));
  for(const file of ['.env','package.json','tsconfig.json','tsconfig.build.json'])add(resolve(root,file));
  return hash.digest('hex');
}

export function watchDevelopmentSources(root:string,onChange:()=>void,intervalMs=750):()=>void {
  let previous=sourceFingerprint(root);
  let candidate:string|undefined,candidateSince=0;
  const timer=setInterval(()=>{
    try{
      const current=sourceFingerprint(root);
      if(current===previous){candidate=undefined;return;}
      if(current!==candidate){candidate=current;candidateSince=Date.now();return;}
      // Editors can truncate a file before writing its replacement. Wait for
      // stable content to avoid restarting on a brief empty .env snapshot.
      if(Date.now()-candidateSince<Math.max(150,intervalMs))return;
      previous=current;candidate=undefined;onChange();
    }
    catch{/* An editor may briefly replace a file; inspect the next complete snapshot. */}
  },intervalMs);
  return ()=>clearInterval(timer);
}

export function runDevelopmentServer(root=resolve(__dirname,'..')) {
  let child:ChildProcess|undefined,restarting=false,closing=false;
  const environment={...process.env};delete environment.WATCH_REPORT_DEPENDENCIES;
  function launch(){
    child=spawn(process.execPath,['-r',require.resolve('ts-node/register'),'src/main.ts'],{cwd:root,env:environment,stdio:'inherit'});
    child.once('error',()=>console.error('No se pudo iniciar la API de desarrollo.'));
    child.once('close',()=>{
      child=undefined;
      if(restarting&&!closing){restarting=false;launch();}
      else if(!closing)console.error('La API se detuvo. Se reintentara cuando cambie el codigo o la configuracion.');
    });
  }
  const stopWatching=watchDevelopmentSources(root,()=>{
    if(closing||restarting)return;
    console.log('Cambio de contenido detectado; reiniciando API.');
    if(child){restarting=true;child.kill();}else launch();
  });
  function stop(){closing=true;stopWatching();child?.kill();}
  process.once('SIGINT',stop);process.once('SIGTERM',stop);launch();
  return stop;
}

if(require.main===module)runDevelopmentServer();
