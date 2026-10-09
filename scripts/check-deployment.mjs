import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base=new URL(process.argv[2]||'https://dadolentini.github.io/Ascensore-v2/');
assert(['http:','https:'].includes(base.protocol),'Use an HTTP(S) site URL.');
if(!base.pathname.endsWith('/'))base.pathname+='/';
const browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[],failedRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)failedRequests.push(`${response.status()} ${response.url()}`);});
  for(const [route,title] of [['','Il tempo'],['come-funziona/','Una chiamata'],['gli-algoritmi/','Le regole']]) {
    const response=await page.goto(new URL(route,base).href,{waitUntil:'networkidle'});
    assert.equal(response.status(),200,`${route||'Home'} must return HTTP 200.`);
    await expect(page.getByRole('heading',{level:1})).toContainText(title);
    assert.equal((await page.reload({waitUntil:'networkidle'})).status(),200,'Refresh must return HTTP 200.');
    await expect(page.getByRole('heading',{level:1})).toContainText(title);
  }
  const pdf=await page.request.get(new URL('model/rapporto_ascensori.pdf',base).href);
  assert.equal(pdf.status(),200);
  assert((await pdf.body()).equals(await readFile(new URL('../public/model/rapporto_ascensori.pdf',import.meta.url))),'The public PDF must match the original.');
  for(const asset of ['assets/tower.webp','assets/entrance.webp','assets/lift.webp','model/parametri_ascensori.json'])assert.equal((await page.request.get(new URL(asset,base).href)).status(),200,asset);

  await page.goto(new URL('#simulatore',base).href,{waitUntil:'networkidle'});
  await page.evaluate(()=>{window.__publicationDocument='same-document';});
  await page.getByLabel('Piani sopra terra',{exact:true}).fill('3');
  await page.getByLabel('Uffici per piano',{exact:true}).fill('1');
  await page.getByLabel('Persone per ufficio',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Distribuisci gli uffici',exact:true}).click();
  await page.getByText('Confronto e riproducibilità',{exact:true}).click();
  await page.getByLabel('Numero di repliche',{exact:true}).fill('1');
  async function run(){
    await page.getByRole('button',{name:'Esegui il confronto',exact:false}).click();
    await expect(page.getByText('Confronto completato. I risultati sono disponibili qui sotto.',{exact:true})).toBeVisible({timeout:60000});
    await expect(page.locator('.result-card')).toHaveCount(3);
  }
  await run();
  const firstHash=await page.locator('.dataset-hashes li').first().textContent();
  await page.getByLabel('Numero di ascensori',{exact:true}).fill('1');
  await run();
  assert.equal(await page.locator('.dataset-hashes li').first().textContent(),firstHash,'Changing the fleet must preserve traffic data.');
  const navigation=page.getByRole('navigation',{name:'Navigazione principale'});
  await navigation.getByRole('link',{name:'Come funziona',exact:true}).click();
  assert.equal(new URL(page.url()).pathname,base.pathname+'come-funziona');
  await page.getByRole('button',{name:'Osserva l’automazione',exact:false}).click();
  await expect(page.getByText('3 di 3 persone arrivate a destinazione.',{exact:true})).toBeVisible({timeout:60000});
  await navigation.getByRole('link',{name:'Gli algoritmi',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toContainText('Le regole');
  await page.goBack();await expect(page.getByRole('heading',{level:1})).toContainText('Una chiamata');
  await navigation.getByRole('link',{name:'Simulatore',exact:true}).click();
  assert.equal(new URL(page.url()).hash,'#simulatore');
  await expect(page.getByLabel('Numero di ascensori',{exact:true})).toHaveValue('1');
  assert.equal(await page.evaluate(()=>window.__publicationDocument),'same-document','Navigation and reruns must preserve the document.');

  const jsonPending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Dati completi JSON',exact:false}).click();
  const jsonDownload=await jsonPending,experiment=JSON.parse(await readFile(await jsonDownload.path(),'utf8'));
  assert.equal(experiment.scenario.cabins.length,1);
  assert.equal(experiment.scenario.upperFloors,3);
  assert.equal(experiment.results.length,3);
  assert(experiment.results.every(result=>result.outcomes.length>0&&result.outcomes.every(outcome=>outcome.weightKg===80)));
  const csvPending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Metriche CSV',exact:false}).click();
  const csvDownload=await csvPending;
  assert((await readFile(await csvDownload.path(),'utf8')).includes('policy,seed,generated'));
  await page.setViewportSize({width:320,height:800});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile content must fit the viewport.');
  assert.deepEqual(errors,[],'No browser JavaScript errors.');
  assert.deepEqual(failedRequests,[],'No missing assets, fonts, pages or worker scripts.');
  console.log(`Verified ${base.href}: direct links, refresh, original PDF, assets, two simulation runs, interactive example, navigation, JSON/CSV exports and mobile layout.`);
} finally {
  await browser.close();
}
