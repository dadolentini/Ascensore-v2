import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import type { ExperimentResult, ScenarioV2 } from '../../src/model/contracts';

async function configureSmall(page:Page,navigate=true) {
  if(navigate)await page.goto('/#simulatore');
  await page.getByLabel('Piani sopra terra',{exact:true}).fill('3');
  await page.getByLabel('Uffici per piano',{exact:true}).fill('1');
  await page.getByLabel('Persone per ufficio',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Distribuisci gli uffici',exact:true}).click();
  await page.getByText('Confronto e riproducibilità',{exact:true}).click();
  await page.getByLabel('Numero di repliche',{exact:true}).fill('1');
}
async function run(page:Page) {
  await page.getByRole('button',{name:'Esegui il confronto',exact:false}).click();
  await expect(page.getByText('Confronto completato. I risultati sono disponibili qui sotto.',{exact:true})).toBeVisible();
  await expect(page.locator('.result-card')).toHaveCount(3);
}
test('landing chiara, pagine progressive, PDF autentico e nessun errore JS',async({page,request})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{level:1})).toContainText('Il tempo');
  await expect(page.locator('.site-header .brand')).toHaveText('Elevator');
  await expect(page).toHaveTitle(/Elevator/);
  await expect(page.getByText('FIG. 01 / VERTICALITÀ',{exact:true})).toHaveCount(0);
  await expect(page.locator('#landing-main .katex')).toHaveCount(0);
  await page.getByRole('navigation',{name:'Navigazione principale'}).getByRole('link',{name:'Come funziona',exact:true}).click();
  await expect(page).toHaveURL(/come-funziona/);await expect(page.getByRole('heading',{level:1})).toContainText('Una chiamata');
  const pdf=await request.get('/model/rapporto_ascensori.pdf');expect(pdf.ok()).toBeTruthy();expect((await pdf.body()).subarray(0,5).toString()).toBe('%PDF-');
  await page.getByRole('navigation',{name:'Navigazione principale'}).getByRole('link',{name:'Gli algoritmi',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toContainText('Le regole');await expect(page.locator('.katex-mathml').first()).toBeAttached();
  expect(errors).toEqual([]);
});
test('partecipazione in percentuale, conversione del dato e limiti senza cambiare il modello',async({page})=>{
  await configureSmall(page);
  await page.getByText('Personalizza uffici e pause',{exact:true}).click();
  const participation=page.getByLabel('Partecipazione ufficio 1',{exact:true});
  await expect(participation).toHaveValue('72');
  for(const percentage of [0,29,71.5,100]) {
    await participation.fill(String(percentage));
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'Salva configurazione',exact:true}).click();
    const download=await pending,scenario=JSON.parse(await readFile((await download.path())!,'utf8')) as ScenarioV2;
    expect(scenario.offices[0].lunchParticipation).toBe(percentage/100);
  }
  await participation.fill('101');await page.getByRole('button',{name:'Esegui il confronto',exact:false}).click();
  await expect(page.locator('.form-errors')).toContainText('fra 0% e 100%');
  await expect(participation).toBeFocused();
  await participation.fill('50');await run(page);
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Dati completi JSON',exact:false}).click();
  const download=await pending,experiment=JSON.parse(await readFile((await download.path())!,'utf8')) as ExperimentResult;
  expect(experiment.scenario.offices[0].lunchParticipation).toBe(.5);
});
test('punti del grafico e confronto base/adattivo corrispondono ai risultati esportati',async({page})=>{
  await configureSmall(page);await run(page);
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Dati completi JSON',exact:false}).click();
  const download=await pending,experiment=JSON.parse(await readFile((await download.path())!,'utf8')) as ExperimentResult;
  const format=(n:number)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(n);
  const baseline=experiment.results.find(r=>r.policy==='fifo')!,adaptive=experiment.results.find(r=>r.policy==='adaptive')!;
  const rows=page.locator('.system-comparison tbody tr');
  for(const [index,key] of (['meanWaitS','meanRideS','meanJourneyS'] as const).entries()) {
    const base=baseline.kpis[key]!,value=adaptive.kpis[key]!,delta=base-value;
    await expect(rows.nth(index).locator('td').nth(0)).toHaveText(`${format(base)} s`);
    await expect(rows.nth(index).locator('td').nth(1)).toHaveText(`${format(value)} s`);
    await expect(rows.nth(index).locator('td').nth(2)).toContainText(delta===0?'Nessuna differenza':`${format(Math.abs(delta))} s ${delta>0?'in meno':'in più'}`);
  }
  const graph=page.getByRole('img',{name:'Distribuzione cumulata dei tempi d’attesa',exact:false});
  await graph.scrollIntoViewIfNeeded();const box=(await graph.boundingBox())!;
  await page.mouse.move(box.x+box.width*.52,box.y+box.height*.55);
  const readout=page.locator('.cdf-point-readout');await expect(readout).toHaveAttribute('data-wait-seconds',/.+/);
  const threshold=Number(await readout.getAttribute('data-wait-seconds'));
  for(const [index,policy] of (['fifo','optimal','adaptive'] as const).entries()) {
    const waits=experiment.results.filter(r=>r.policy===policy).flatMap(r=>r.outcomes.filter(o=>o.state==='DONE'&&o.pickupS!==null&&o.finishS!==null).map(o=>o.pickupS!-o.bornS));
    const count=waits.filter(w=>w<=threshold).length;
    await expect(readout.locator('li').nth(index)).toContainText(`${format(100*count/waits.length)}%`);
    await expect(readout.locator('li').nth(index)).toContainText(`${count} / ${waits.length} viaggi completati`);
  }
  const slider=page.getByRole('slider',{name:'Attesa da esplorare',exact:true});
  await slider.focus();await slider.press('End');
  for(const row of await readout.locator('li').all())await expect(row).toContainText('100%');
  await page.setViewportSize({width:320,height:800});await slider.press('Home');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await expect(readout).toBeVisible();
});
test('quattro simulazioni consecutive senza reload, con nuovi input e bozza conservata',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await configureSmall(page);
  await page.evaluate(()=>Object.assign(window,{__runPersistence:'same-document'}));
  await run(page);const firstHash=await page.locator('.dataset-hashes li').first().textContent();
  await page.getByLabel('Numero di ascensori',{exact:true}).fill('1');await expect(page.locator('.previous-notice')).toBeVisible();
  await run(page);expect(await page.locator('.dataset-hashes li').first().textContent()).toBe(firstHash);
  await page.getByLabel('Persone per ufficio',{exact:true}).fill('3');await page.getByRole('button',{name:'Distribuisci gli uffici',exact:true}).click();await run(page);
  expect(await page.locator('.dataset-hashes li').first().textContent()).not.toBe(firstHash);
  await page.getByLabel('Numero di repliche',{exact:true}).fill('2');await run(page);await expect(page.locator('.dataset-hashes li')).toHaveCount(2);
  await page.getByRole('navigation',{name:'Navigazione principale'}).getByRole('link',{name:'Come funziona',exact:true}).click();
  await page.getByRole('navigation',{name:'Navigazione principale'}).getByRole('link',{name:'Simulatore',exact:true}).click();
  await expect(page.getByLabel('Numero di ascensori',{exact:true})).toHaveValue('1');await expect(page.locator('.result-card')).toHaveCount(3);
  expect(await page.evaluate(()=>(window as unknown as {__runPersistence:string}).__runPersistence)).toBe('same-document');
  await page.getByLabel('Piani sopra terra',{exact:true}).fill('');await page.getByRole('button',{name:'Esegui il confronto',exact:false}).click();await expect(page.getByRole('heading',{name:'Correggi la configurazione'})).toBeVisible();
  expect(errors).toEqual([]);
});
test('Come funziona calcola due casi e aggiorna grafici e decisioni',async({page})=>{
  await page.goto('/come-funziona');await page.getByRole('button',{name:'Osserva l’automazione',exact:false}).click();
  await expect(page.getByText('3 di 3 persone arrivate a destinazione.',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Attesa e viaggio, per persona'})).toBeVisible();await expect(page.getByRole('heading',{name:'Carico delle cabine durante il servizio'})).toBeVisible();
  const first=await page.locator('.example-outcome').textContent();await page.getByLabel('Cabine disponibili',{exact:true}).selectOption('1');await page.getByLabel('Posti per cabina',{exact:true}).selectOption('1');await page.getByRole('button',{name:'Osserva l’automazione',exact:false}).click();
  await expect(page.getByText('3 di 3 persone arrivate a destinazione.',{exact:true})).toBeVisible();
  await expect(page.locator('.example-output')).not.toHaveClass(/is-previous/);expect(await page.locator('.example-outcome').textContent()).not.toBe(first);
});
test('annullamento e nuova run conservano una UI funzionante',async({page})=>{
  await page.goto('/#simulatore');await page.getByRole('button',{name:'Esegui il confronto',exact:false}).click();await page.getByRole('button',{name:'Annulla il calcolo',exact:true}).click();
  await expect(page.getByText('Calcolo annullato. Puoi modificare la configurazione e rieseguire.',{exact:true})).toBeVisible();
  await configureSmall(page,false);await run(page);
});
test('mobile 320px, tastiera e reduced motion mantengono contenuti e azioni',async({page})=>{
  await page.setViewportSize({width:320,height:800});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Vai al contenuto'})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'Menu',exact:false}).click();await page.getByRole('navigation',{name:'Navigazione principale'}).getByRole('link',{name:'Come funziona',exact:true}).click();
  await page.getByRole('button',{name:'Osserva l’automazione',exact:false}).click();await expect(page.getByText('3 di 3 persone arrivate a destinazione.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Riproduci eventi'})).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  await page.getByRole('button',{name:'Menu',exact:false}).click();await page.getByRole('navigation',{name:'Navigazione principale'}).getByRole('link',{name:'Gli algoritmi',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toContainText('Le regole');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});
test('accessibilità automatica delle tre pagine e dei grafici calcolati',async({page})=>{
  for(const path of ['/','/gli-algoritmi','/come-funziona','/#simulatore']) {
    await page.goto(path);await expect(page.getByRole('heading',{level:1})).toBeVisible();
    if(path==='/come-funziona'){await page.getByRole('button',{name:'Osserva l’automazione',exact:false}).click();await expect(page.getByText('3 di 3 persone arrivate a destinazione.',{exact:true})).toBeVisible();}
    if(path==='/#simulatore'){await configureSmall(page,false);await run(page);await page.getByText('Tempi, fermate e richieste della replica',{exact:true}).click();await page.getByRole('slider',{name:'Attesa da esplorare',exact:true}).focus();await page.keyboard.press('End');}
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  }
});
