// Read-only delivery checks. Never print environment values or matching text.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(path.join(root,'apps/api/package.json'));
const tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const forbiddenEnv=tracked.filter(p=>/(^|\/)\.env(?:\.|$)/.test(p)&&!p.endsWith('/.env.example')&&p!=='.env.example');
const secrets=new Set();
for(const relative of ['.env','apps/api/.env','apps/api/.env.local','apps/web/.env','apps/web/.env.local']) {
  const file=path.join(root,relative);if(!fs.existsSync(file))continue;
  const env=require('dotenv').parse(fs.readFileSync(file));
  for(const [key,value]of Object.entries(env))if(/TOKEN|SECRET|SERVICE_ROLE|PRIVATE_KEY|HASH_KEY|STORAGE_KEY|DATABASE_URL|PASSWORD/.test(key)&&value.length>=16)secrets.add(value);
}
function walk(directory){
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(directory,entry.name);return entry.isDirectory()?walk(file):[file];
  });
}
const staticRoot=path.join(root,'apps/web/.next/static');
const assets=fs.existsSync(staticRoot)?walk(staticRoot).filter(p=>/\.(js|json|map)$/.test(p)):[];
const exposed=[];
for(const file of assets) {
  const content=fs.readFileSync(file,'utf8');
  if([...secrets].some(secret=>content.includes(secret)||content.includes(encodeURIComponent(secret)))
    ||/sb_secret_[A-Za-z0-9_-]{24,}/.test(content))exposed.push(path.relative(root,file).replaceAll('\\','/'));
}
const documents=['README.md','docs/CONTRATO_API.md','docs/PLAN_DESARROLLO.md','docs/PLAN_AJUSTES_NEGOCIO.md',
  ...Array.from({length:7},(_,i)=>`docs/AJUSTES_NEGOCIO_FASE_${i+1}.md`),
  ...['0025-business-adjustments-phase-1','0026-range-inventory-fundraising','0027-lottery-manual-awards','0028-public-masked-phone-summary','0029-public-purchase-simplification','0030-regression-delivery'].map(n=>'docs/decisions/'+n+'.md')];
let links=0;const broken=[];
for(const relative of documents) {
  const file=path.join(root,relative);
  if(!fs.existsSync(file)){broken.push({document:relative,target:'DOCUMENT_MISSING'});continue;}
  for(const match of fs.readFileSync(file,'utf8').matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target=match[1].trim().replace(/^<|>$/g,'').split(/\s+"/)[0].split('#')[0];
    if(!target||/^[a-z][a-z0-9+.-]*:/i.test(target)||target.startsWith('/'))continue;
    links++;
    if(!fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(target))))broken.push({document:relative,target});
  }
}
const migrationFiles=fs.readdirSync(path.join(root,'infra/supabase/migrations')).filter(p=>p.endsWith('.sql'));
const versions=migrationFiles.map(p=>p.slice(0,14));
const migrationNamesValid=migrationFiles.every(p=>/^\d{14}_[a-z0-9_]+\.sql$/.test(p))&&new Set(versions).size===versions.length;
const result={check:'delivery-artifacts',publicAssets:assets.length,configuredPrivateValuesChecked:secrets.size,
  exposedAssets:exposed,forbiddenTrackedEnvFiles:forbiddenEnv,markdownLinksChecked:links,brokenLinks:broken,
  localMigrations:migrationFiles.length,migrationNamesValid,
  result:assets.length>0&&exposed.length===0&&forbiddenEnv.length===0&&broken.length===0&&migrationNamesValid?'PASS':'FAIL'};
console.log(JSON.stringify(result,null,2));
if(result.result!=='PASS')process.exitCode=1;
