// Real B3/NestJS + PostgreSQL/browser integration, reusing backend-owned isolated setup.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const frontend = fileURLToPath(new URL("../../../..", import.meta.url));
const backend = path.resolve(process.env.BACKEND_CHECKOUT || frontend);
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL local de pruebas requerida.");
const backendRequire = createRequire(path.join(backend, "apps/api/package.json"));
const webRequire = createRequire(path.join(frontend, "apps/web/package.json"));
const file = path.join(backend, "apps/api/test/checkout.integration.ts");
let source = fs.readFileSync(file, "utf8");
const end = source.indexOf("test('sesión secreta");
if (end < 0) throw new Error("Cambió el setup B3. Revisar antes de ejecutar.");
source = source.slice(0, end).replace(/from '([^']+)'/g, (_, name) => "from " + JSON.stringify(name.startsWith(".") ? path.resolve(path.dirname(file), name).replaceAll("\\", "/") : name.startsWith("node:") ? name : backendRequire.resolve(name).replaceAll("\\", "/")));
source = source.replace("import 'reflect-metadata';", "import " + JSON.stringify(backendRequire.resolve("reflect-metadata").replaceAll("\\", "/")) + ";");
source = source.replace("const settings={", "const settings={CORS_ORIGINS:'http://127.0.0.1:3105',SUPABASE_URL:'https://media.example.test',");
source = source.replace("await app.listen(0,'127.0.0.1')", "await app.listen(3106,'127.0.0.1')");
source += `
test('F3: dos navegadores, respuesta perdida, recarga, cancelación, vencimiento y pérdida de sesión', {timeout:120000}, async()=>{
  const {chromium,firefox,webkit,expect} = require(${JSON.stringify(webRequire.resolve("@playwright/test"))});
  const AxeBuilder = require(${JSON.stringify(webRequire.resolve("@axe-core/playwright"))}).default;
  const {mkdirSync} = require('node:fs');
  const output=${JSON.stringify(path.join(frontend, "docs/frontend/screenshots/f3"))};mkdirSync(output,{recursive:true});
  const browser=await chromium.launch();
  const contexts=[];
  const count=async(id)=>Number((await db.query('SELECT count(*)::int AS n FROM sorteos.checkout_holds WHERE raffle_id=$1',[id])).rows[0].n);
  const url=(id)=>'http://127.0.0.1:3105/rifas/demo-'+id+'/participar';
  try {
    const id=await raffle(2);
    const one=await browser.newContext({viewport:{width:390,height:844}}),two=await browser.newContext({viewport:{width:1280,height:900}});contexts.push(one,two);
    const a=await one.newPage(),b=await two.newPage();
    await Promise.all([a.goto(url(id)),b.goto(url(id))]);
    const reserve=(page)=>page.getByRole('button',{name:'Confirmar cupo'});
    await expect(reserve(a)).toBeEnabled();await expect(reserve(b)).toBeEnabled();
    assert.equal(await count(id),0);
    for (const value of ['0','1.5','3']) { await a.getByRole('spinbutton').fill(value); await expect(reserve(a)).toBeDisabled(); }
    await a.getByRole('spinbutton').fill('2');
    await reserve(a).dblclick();
    await a.getByText('Cupo reservado temporalmente',{exact:true}).waitFor();
    await expect(a.getByText('RD$ 200.50',{exact:true})).toBeVisible();assert.equal(await count(id),1);
    const cookies=await one.cookies();assert.equal(cookies.some(c=>c.name==='sorteos_guest'&&c.httpOnly&&c.sameSite==='Lax'),true);
    assert.equal(await a.evaluate(()=>document.cookie.includes('sorteos_guest')),false);
    const before=(await db.query('SELECT id,expires_at FROM sorteos.checkout_holds WHERE raffle_id=$1',[id])).rows[0];
    await a.reload();await a.getByText('Cupo reservado temporalmente',{exact:true}).waitFor();
    assert.equal(await count(id),1);assert.equal((await db.query('SELECT expires_at FROM sorteos.checkout_holds WHERE id=$1',[before.id])).rows[0].expires_at.toISOString(),before.expires_at.toISOString());
    await reserve(b).click();await b.getByText('Ya no quedan tantos boletos disponibles. Reduce la cantidad.',{exact:true}).waitFor();
    assert.equal(await count(id),1);
    const accessibility=await new AxeBuilder({page:a}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(accessibility.violations,[]);
    assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await a.screenshot({path:output+'/cupo-mobile.png',fullPage:true});
    await a.getByRole('button',{name:'Liberar cupo y cambiar cantidad'}).click();await expect(reserve(a)).toBeEnabled();
    await b.getByRole('button',{name:'Recuperar la misma solicitud'}).click();await b.getByText('Cupo reservado temporalmente',{exact:true}).waitFor();
    assert.equal(await count(id),2);
    await b.screenshot({path:output+'/cupo-desktop.png',fullPage:true});
    // Lost POST response after backend commit. Reload must not POST until explicit recovery.
    const lost=await raffle(5);await a.goto(url(lost));
    let drop=true;
    await a.route('**/api/v1/checkout-holds',async route=>{
      if(drop&&route.request().method()==='POST'){drop=false;await route.fetch();await route.abort('failed');}else await route.continue();
    });
    await reserve(a).click();await a.getByText('No pudimos completar la consulta',{exact:true}).waitFor();assert.equal(await count(lost),1);
    await a.reload();await expect(a.getByRole('button',{name:'Recuperar la misma solicitud'})).toBeEnabled();assert.equal(await count(lost),1);
    await a.route('**/api/v1/checkout-holds',async route=>{
      if(route.request().method()==='POST'){
        const response=await route.fetch();
        await route.fulfill({response,status:429,json:{error:{code:'RATE_LIMITED',message:'Proxy TEST'}}});
      }else await route.continue();
    });
    await a.getByRole('button',{name:'Recuperar la misma solicitud'}).click();await a.getByText('Demasiadas solicitudes; inténtalo más tarde.',{exact:true}).waitFor();
    assert.equal(await a.getByRole('button',{name:'Revisar cantidad',exact:true}).count(),0);assert.equal(await count(lost),1);
    await a.unroute('**/api/v1/checkout-holds');
    await a.getByRole('button',{name:'Recuperar la misma solicitud'}).click();await a.getByText('Cupo reservado temporalmente',{exact:true}).waitFor();assert.equal(await count(lost),1);
    await a.unroute('**/api/v1/checkout-holds');
    // Expiry is immutable: cancel the normal hold and insert a short-lived fixture atomically.
    const stored=await a.evaluate(()=>JSON.parse(sessionStorage.getItem('sorteos:checkout:intent:v1')));
    const sessionId=(await db.query('SELECT session_id FROM sorteos.checkout_holds WHERE id=$1',[stored.holdId])).rows[0].session_id;
    await a.getByRole('button',{name:'Liberar cupo y cambiar cantidad'}).click();await expect(reserve(a)).toBeEnabled();
    const fixtureId=randomUUID(),fixtureKey=randomUUID();
    await db.query('BEGIN');
    try{
      await db.query("INSERT INTO sorteos.checkout_holds(id,raffle_id,session_id,quantity,unit_price_minor_snapshot,rules_version_snapshot,created_at,expires_at,idempotency_key,request_hash) VALUES($1,$2,$3,1,10025,'TEST-1',now()-interval '2 hours',now()+interval '10 seconds',$4,repeat('a',64))",[fixtureId,lost,sessionId,fixtureKey]);
      await db.query("UPDATE sorteos.tickets SET status='HELD',hold_id=$1 WHERE id=(SELECT id FROM sorteos.tickets WHERE raffle_id=$2 AND status='AVAILABLE' LIMIT 1)",[fixtureId,lost]);
      await db.query('COMMIT');
    }catch(error){await db.query('ROLLBACK');throw error;}
    await a.evaluate(value=>sessionStorage.setItem('sorteos:checkout:intent:v1',JSON.stringify(value)),{...stored,key:fixtureKey,holdId:fixtureId,quantity:1});
    await a.reload();
    await a.getByText('El cupo está por vencer',{exact:true}).waitFor();
    await a.getByText('Reserva vencida',{exact:true}).waitFor();assert.equal(await a.getByText('Cuentas publicadas',{exact:true}).count(),0);
    await a.screenshot({path:output+'/vencimiento-mobile.png',fullPage:true});
    await a.reload();await a.getByText('Reserva vencida',{exact:true}).waitFor();assert.equal(await count(lost),2);
    await a.getByRole('button',{name:'Volver a consultar cupo',exact:true}).click();await expect(reserve(a)).toBeEnabled();
    // Missing guest cookie must never initialize a replacement session on recovery GET.
    await reserve(a).click();await a.getByText('Cupo reservado temporalmente',{exact:true}).waitFor();
    const size=await count(lost);await one.clearCookies();await a.reload();
    await a.getByText('No pudimos acceder a tu sesión.',{exact:false}).waitFor();
    await a.getByRole('button',{name:'Recuperar la misma solicitud'}).click();await a.getByText('No pudimos acceder a tu sesión.',{exact:false}).waitFor();
    assert.equal(await count(lost),size);assert.equal((await one.cookies()).some(c=>c.name==='sorteos_guest'),false);
    await a.screenshot({path:output+'/sesion-perdida-mobile.png',fullPage:true});
    // Additional browser engines exercise direct API cookies/CORS and cancellation.
    for(const [engine,label] of [[firefox,'firefox'],[webkit,'webkit-mobile']]){
      const actual=await engine.launch();try{
        const page=await actual.newPage({viewport:{width:390,height:844}});const target=await raffle(5);
        await page.goto(url(target));await expect(reserve(page)).toBeEnabled();await reserve(page).click();await page.getByText('Cupo reservado temporalmente',{exact:true}).waitFor();
        await page.reload();await page.getByText('Cupo reservado temporalmente',{exact:true}).waitFor();assert.equal(await count(target),1);
        await page.screenshot({path:output+'/cupo-'+label+'.png',fullPage:true});
        await page.getByRole('button',{name:'Liberar cupo y cambiar cantidad'}).click();await expect(reserve(page)).toBeEnabled();
      }finally{await actual.close();}
    }
    const contested=await raffle(1);
    const first=await browser.newContext(),second=await browser.newContext();contexts.push(first,second);
    const x=await first.newPage(),y=await second.newPage();
    await Promise.all([x.goto(url(contested)),y.goto(url(contested))]);
    await Promise.all([expect(reserve(x)).toBeEnabled(),expect(reserve(y)).toBeEnabled()]);
    await Promise.all([reserve(x).click(),reserve(y).click()]);
    await Promise.all([expect(x.getByText('Cupo reservado temporalmente',{exact:true}).or(x.getByText('Ya no quedan tantos boletos disponibles. Reduce la cantidad.',{exact:true}))).toBeVisible(),expect(y.getByText('Cupo reservado temporalmente',{exact:true}).or(y.getByText('Ya no quedan tantos boletos disponibles. Reduce la cantidad.',{exact:true}))).toBeVisible()]);
    assert.equal(await count(contested),1);
    assert.equal(Number((await db.query("SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1 AND status='HELD'",[contested])).rows[0].n),1);
    assert.equal(Number((await db.query('SELECT count(*)::int AS n FROM sorteos.orders')).rows[0].n),1);
  }finally{for(const context of contexts)await context.close();await browser.close();}
});
`;
const temporary = path.join(backend, ".tmp/f3-live.integration.ts");
fs.writeFileSync(temporary, source);
const result = spawnSync(process.execPath, ["-r", backendRequire.resolve("ts-node/register"), "--test", temporary], { cwd: backend, stdio: "inherit", env: { ...process.env, NODE_ENV: "test", TS_NODE_TRANSPILE_ONLY: "true", TS_NODE_PROJECT: path.join(backend, "apps/api/tsconfig.json") } });
process.exitCode = result.status ?? 1;
