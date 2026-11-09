import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { watchDevelopmentSources } from '../src/dev';

const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('watcher ignora dependencias y cambios de fechas, pero detecta contenido y entorno reales',async()=>{
  const tmp=resolve(__dirname,'../../../.tmp');await mkdir(tmp,{recursive:true});
  const root=await mkdtemp(resolve(tmp,'dev-watcher-'));
  assert.ok(root.startsWith(tmp+sep));
  await mkdir(resolve(root,'src'));await mkdir(resolve(root,'node_modules'));
  const main=resolve(root,'src/main.ts');await writeFile(main,'// initial');
  let changes=0;const stop=watchDevelopmentSources(root,()=>{changes++;},30);
  async function expectChanges(expected:number){
    const end=Date.now()+2000;while(changes<expected&&Date.now()<end)await delay(30);
    assert.equal(changes,expected);
  }
  try{
    await writeFile(resolve(root,'node_modules/dependency.js'),'updated dependency');
    await utimes(main,new Date(),new Date(Date.now()+10000));await delay(180);assert.equal(changes,0);
    await writeFile(main,'// changed code');await expectChanges(1);
    await writeFile(resolve(root,'.env'),'PORT=3001');await expectChanges(2);
    await writeFile(resolve(root,'.env'),'');await delay(60);
    await writeFile(resolve(root,'.env'),'PORT=3002');await expectChanges(3);
    await writeFile(resolve(root,'src/added.ts'),'// new file');await expectChanges(4);
    await rm(resolve(root,'src/added.ts'));await expectChanges(5);
  }finally{stop();await rm(root,{recursive:true,force:true});}
});
