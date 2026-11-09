// B4 end-to-end uses real NestJS/PostgreSQL and the backend's private Storage test fixture.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const frontend = fileURLToPath(new URL("../../../..", import.meta.url));
const backend = path.resolve(process.env.BACKEND_CHECKOUT || frontend);
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL local de pruebas requerida.");
const backendRequire = createRequire(path.join(backend, "apps/api/package.json")), webRequire = createRequire(path.join(frontend, "apps/web/package.json"));
const file = path.join(backend, "apps/api/test/orders.integration.ts");
let source = fs.readFileSync(file, "utf8");
const end = source.indexOf("test('correo obligatorio");
if (end < 0) throw new Error("Cambió el setup B4. Revisar el harness antes de continuar.");
source = source.slice(0, end).replace(/from '([^']+)'/g, (_, name) => "from " + JSON.stringify(name.startsWith(".") ? path.resolve(path.dirname(file), name).replaceAll("\\", "/") : name.startsWith("node:") ? name : backendRequire.resolve(name).replaceAll("\\", "/")));
source = source.replace("import 'reflect-metadata';", "import " + JSON.stringify(backendRequire.resolve("reflect-metadata").replaceAll("\\", "/")) + ";");
source = source.replace("const origin='http://localhost:3000'", "const origin='http://127.0.0.1:3105'");
source = source.replace("const config=parseConfig({", "const config=parseConfig({CORS_ORIGINS:origin,");
source = source.replace("await app.listen(0,'127.0.0.1')", "await app.listen(3106,'127.0.0.1')");
source += `
test('F4: formulario único, archivo obligatorio, confirmación protegida y recuperación idempotente', {timeout:240000}, async()=>{
  const {chromium,firefox,webkit,expect}=require(${JSON.stringify(webRequire.resolve("@playwright/test"))});
  const AxeBuilder=require(${JSON.stringify(webRequire.resolve("@axe-core/playwright"))}).default;
  const {mkdirSync}=require('node:fs');const output=${JSON.stringify(path.join(frontend, "docs/frontend/screenshots/f4"))};mkdirSync(output,{recursive:true});
  const browser=await chromium.launch();const contexts=[];
  const date=new Date(Date.now()-14460000).toISOString().slice(0,16);
  const enter=async(page,reference='REFERENCIA TEST SIN TRANSFERENCIA')=>{
    await page.getByLabel('Nombre completo',{exact:true}).fill('CLIENTE TEST F4');
    await page.getByLabel('Teléfono con código de país').fill('+1 (809) 555-0100');
    await page.getByLabel('Correo electrónico',{exact:true}).fill('test-f4@example.invalid');
    await page.getByLabel('Cuenta a la que transferiste').selectOption(bankId);
    await page.getByLabel('Referencia bancaria',{exact:true}).fill(reference);
    await page.getByLabel('Fecha y hora de la transferencia',{exact:true}).fill(date);
  };
  const attach=async(page,bytes=png,mime='image/png')=>page.getByLabel('Imagen JPG/PNG o PDF',{exact:true}).setInputFiles({name:mime==='application/pdf'?'comprobante-test.pdf':'comprobante-test.png',mimeType:mime,buffer:bytes});
  const start=async(page)=>{
    const c=await checkout(1);await page.goto('http://127.0.0.1:3105/rifas/demo-'+c.raffle+'/participar');
    await page.getByRole('button',{name:'Confirmar cupo'}).click();
    await page.getByText('Cupo reservado temporalmente',{exact:true}).waitFor();
    await page.getByLabel('Cuenta a la que transferiste').getByRole('option',{name:/BANCO DE PRUEBA/}).waitFor({state:'attached'});
    return c;
  };
  try{
    const context=await browser.newContext({viewport:{width:390,height:844}});contexts.push(context);const page=await context.newPage();
    const c=await start(page);const count=await orderCount();let posts=0;
    page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/v1/orders')posts++;});
    await expect(page.getByRole('button',{name:'Enviar orden'})).toBeDisabled();
    await enter(page);await page.getByRole('checkbox').check();
    await expect(page.getByRole('button',{name:'Enviar orden'})).toBeDisabled();assert.equal(await orderCount(),count);assert.equal(posts,0);
    await attach(page);await page.getByLabel('Correo electrónico',{exact:true}).fill('correo-invalido');await expect(page.getByRole('button',{name:'Enviar orden'})).toBeDisabled();
    await page.getByLabel('Correo electrónico',{exact:true}).fill('test-f4@example.invalid');
    await page.getByLabel('Fecha y hora de la transferencia',{exact:true}).fill('2099-01-01T12:00');await expect(page.getByRole('button',{name:'Enviar orden'})).toBeDisabled();await page.getByLabel('Fecha y hora de la transferencia',{exact:true}).fill(date);
    const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(accessibility.violations,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:output+'/formulario-mobile.png',fullPage:true});
    const held=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('sorteos:checkout:intent:v1')).holdId);
    const numbers=(await db.query('SELECT number FROM sorteos.tickets WHERE hold_id=$1 ORDER BY number',[held])).rows.map(row=>String(row.number).padStart(2,'0'));
    const beforeUploads=uploads;
    await page.getByRole('button',{name:'Enviar orden'}).dblclick();
    await page.waitForURL('**/orden/confirmacion');await page.getByRole('heading',{name:'Orden recibida',exact:true}).waitFor();
    assert.equal(posts,1);assert.equal(await orderCount(),count+1);assert.equal(uploads,beforeUploads+1);
    assert.deepEqual(await page.getByRole('list',{name:'Números asignados a la orden'}).locator('li').allTextContents(),numbers);
    assert.equal(await page.getByText('Pago confirmado',{exact:true}).count(),0);assert.equal(page.url().includes('RF-'),false);
    assert.equal(await page.getByText('test-f4@example.invalid',{exact:true}).count(),0);
    await page.screenshot({path:output+'/confirmacion-mobile.png',fullPage:true});
    const locator=(await context.cookies()).find(cookie=>cookie.name==='sorteos_order_locator');assert.equal(locator.httpOnly,true);
    await page.reload();await page.getByRole('heading',{name:'Orden recibida',exact:true}).waitFor();assert.equal(posts,1);assert.equal(await orderCount(),count+1);
    await context.clearCookies({name:'sorteos_guest'});await page.reload();await page.getByText('La sesión actual no permite consultar esta orden.',{exact:false}).waitFor();assert.equal(await page.getByRole('list',{name:'Números asignados a la orden'}).count(),0);
    // Lost response, then reload while paused: generic recovery still uses the original payload.
    const lostContext=await browser.newContext({viewport:{width:1280,height:900}});contexts.push(lostContext);const lost=await lostContext.newPage();const target=await start(lost);
    await enter(lost);await attach(lost);await lost.getByRole('checkbox').check();const baseline=await orderCount(),uploadBaseline=uploads;
    await lost.route('**/api/v1/orders',async route=>{await route.fetch();await route.abort('failed');});
    await lost.getByRole('button',{name:'Enviar orden'}).click();await lost.getByText('El envío necesita atención',{exact:true}).waitFor();assert.equal(await orderCount(),baseline+1);
    assert.equal(await lost.getByRole('button',{name:'Liberar cupo y cambiar cantidad'}).isDisabled(),true);
    const metadata=await lost.evaluate(()=>sessionStorage.getItem('sorteos:order:intent:v1'));assert.equal(metadata.includes('example.invalid'),false);assert.equal(metadata.includes('REFERENCIA TEST'),false);
    await db.query("UPDATE sorteos.raffles SET status='PAUSED' WHERE id=$1",[target.raffle]);
    await lost.reload();await lost.getByRole('link',{name:'Recuperar un envío pendiente'}).click();await lost.waitForURL('**/orden/recuperar');
    await lost.getByLabel('Nombre completo',{exact:true}).waitFor();
    await enter(lost,'REFERENCIA DIFERENTE TEST');await attach(lost);await lost.getByRole('checkbox').check();
    await lost.getByRole('button',{name:'Recuperar el mismo envío',exact:true}).click();await lost.getByText('Para recuperar el envío introduce exactamente los datos originales',{exact:false}).waitFor();assert.equal(await orderCount(),baseline+1);
    await lost.getByLabel('Referencia bancaria',{exact:true}).fill('REFERENCIA TEST SIN TRANSFERENCIA');await lost.unroute('**/api/v1/orders');
    await lost.getByRole('button',{name:'Recuperar el mismo envío',exact:true}).click();await lost.waitForURL('**/orden/confirmacion');await lost.getByRole('heading',{name:'Orden recibida',exact:true}).waitFor();
    assert.equal(await orderCount(),baseline+1);assert.equal(uploads,uploadBaseline+1);
    await lost.screenshot({path:output+'/recuperada-desktop.png',fullPage:true});
    // Server rejection of a forged PNG permits replacing the file without losing fields.
    const invalidContext=await browser.newContext();contexts.push(invalidContext);const invalid=await invalidContext.newPage();await start(invalid);await enter(invalid);await attach(invalid,Buffer.from('NOT PNG'));await invalid.getByRole('checkbox').check();const unchanged=await orderCount();
    await invalid.getByRole('button',{name:'Enviar orden'}).click();await invalid.getByText('No pudimos validar el comprobante.',{exact:false}).waitFor();assert.equal(await orderCount(),unchanged);
    await expect(invalid.getByLabel('Correo electrónico',{exact:true})).toHaveValue('test-f4@example.invalid');
    await attach(invalid);await invalid.getByRole('button',{name:'Enviar orden'}).click();await invalid.waitForURL('**/orden/confirmacion');assert.equal(await orderCount(),unchanged+1);
    // Storage failure remains uncertain in the UI and retries the original intention.
    const storageContext=await browser.newContext();contexts.push(storageContext);const storagePage=await storageContext.newPage();await start(storagePage);await enter(storagePage);await attach(storagePage);await storagePage.getByRole('checkbox').check();
    const storageCount=await orderCount();uploadFail=true;
    await storagePage.getByRole('button',{name:'Enviar orden'}).click();await storagePage.getByText('El envío necesita atención',{exact:true}).waitFor();assert.equal(await orderCount(),storageCount);
    await expect(storagePage.getByLabel('Correo electrónico',{exact:true})).toBeDisabled();uploadFail=false;
    await storagePage.getByRole('button',{name:'Recuperar el mismo envío',exact:true}).click();await storagePage.waitForURL('**/orden/confirmacion');assert.equal(await orderCount(),storageCount+1);
    // A short-lived immutable fixture expires without submitting or creating an order.
    const expiring=await checkout(1,10),expiredContext=await browser.newContext({viewport:{width:390,height:844}});contexts.push(expiredContext);
    await expiredContext.addCookies([{name:'sorteos_guest',value:expiring.cookie.split('=')[1],url:'http://127.0.0.1:3106',httpOnly:true,sameSite:'Lax'}]);
    await expiredContext.addInitScript(value=>sessionStorage.setItem('sorteos:checkout:intent:v1',JSON.stringify(value)),{key:randomUUID(),raffleId:expiring.raffle,slug:'demo-'+expiring.raffle,quantity:1,holdId:expiring.holdId,sessionReady:true,rulesVersion:'B4-TEST',rules:['NO TRANSFERIR'],title:'PREMIO TEST'});
    const expired=await expiredContext.newPage();await expired.goto('http://127.0.0.1:3105/rifas/demo-'+expiring.raffle+'/participar');
    await enter(expired);await attach(expired);await expired.getByRole('checkbox').check();const expiredCount=await orderCount();
    await expired.getByText('Reserva vencida',{exact:true}).waitFor();await expect(expired.getByRole('button',{name:'Enviar orden'})).toBeDisabled();
    assert.equal(await orderCount(),expiredCount);assert.equal(await expired.getByRole('list',{name:'Números asignados a la orden'}).count(),0);
    await expired.screenshot({path:output+'/vencimiento-mobile.png',fullPage:true});
    for(const [engine,label,mime]of [[firefox,'firefox','image/jpeg'],[webkit,'webkit-mobile','application/pdf']]){
      const actual=await engine.launch();try{
        const view=await actual.newPage({viewport:{width:390,height:844}});await start(view);await enter(view);await attach(view,mime==='application/pdf'?pdf:jpg,mime);await view.getByRole('checkbox').check();
        await view.getByRole('button',{name:'Enviar orden'}).click();await view.waitForURL('**/orden/confirmacion');await view.getByRole('heading',{name:'Orden recibida',exact:true}).waitFor();
        assert.equal(await view.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await view.screenshot({path:output+'/confirmacion-'+label+'.png',fullPage:true});
      }finally{await actual.close();}
    }
  }finally{for(const context of contexts)await context.close();await browser.close();}
});
`;
const temporary = path.join(backend, ".tmp/f4-live.integration.ts"); fs.writeFileSync(temporary, source);
const result = spawnSync(process.execPath, ["-r", backendRequire.resolve("ts-node/register"), "--test", temporary], { cwd: backend, stdio: "inherit", env: { ...process.env, NODE_ENV: "test", TS_NODE_TRANSPILE_ONLY: "true", TS_NODE_PROJECT: path.join(backend, "apps/api/tsconfig.json") } });
process.exitCode = result.status ?? 1;
