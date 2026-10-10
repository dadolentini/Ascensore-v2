import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import type {ExperimentResult} from '../../src/model/contracts';

async function configure(page:Page) {
  await page.goto('/#simulatore');
  await page.getByLabel('Piani sopra terra',{exact:true}).fill('3');
  await page.getByLabel('Uffici per piano',{exact:true}).fill('1');
  await page.getByLabel('Persone per ufficio',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Distribuisci gli uffici',exact:true}).click();
  await page.getByText('Giornate e impostazioni del confronto',{exact:true}).click();
  await page.getByLabel('Giornate da confrontare',{exact:true}).fill('1');
  await page.evaluate(()=>Object.assign(window,{__regressionDocument:'unchanged'}));
}
async function run(page:Page) {
  await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.getByText('Confronto completato. I risultati sono disponibili qui sotto.',{exact:true})).toBeVisible();
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Dati completi JSON',exact:false}).click();
  const download=await pending;
  return JSON.parse(await readFile((await download.path())!,'utf8')) as ExperimentResult;
}
test('il numero di ascensori si cancella e si riscrive anche su mobile',async({page})=>{
  await page.setViewportSize({width:390,height:844});await configure(page);
  const input=page.getByLabel('Numero di ascensori',{exact:true});
  await input.focus();await input.press('ControlOrMeta+A');await input.press('Backspace');
  await expect(input).toHaveValue('');
  await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.locator('.form-errors')).toContainText('da 1 a 8 ascensori');
  await expect(input).toBeFocused();
  await input.pressSequentially('3');await expect(input).toHaveValue('3');
  const result=await run(page);expect(result.scenario.cabins).toHaveLength(3);
  await input.fill('9');await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.locator('.form-errors')).toContainText('da 1 a 8 ascensori');
  await input.fill('8');const maximum=await run(page);expect(maximum.scenario.cabins).toHaveLength(8);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});
test('nuovi uffici e ascensori entrano in quattro confronti senza ricaricare',async({page})=>{
  await configure(page);const first=await run(page);
  expect(first.scenario.offices.reduce((sum,office)=>sum+office.employees,0)).toBe(6);
  await page.getByLabel('Persone per ufficio',{exact:true}).fill('5');
  await expect(page.locator('.run-actions button[type="submit"]')).toContainText('nuovi uffici');
  const second=await run(page);
  expect(second.scenario.offices.reduce((sum,office)=>sum+office.employees,0)).toBe(15);
  expect(second.datasets[0].datasetHash).not.toBe(first.datasets[0].datasetHash);
  await page.getByLabel('Numero di ascensori',{exact:true}).fill('1');
  const third=await run(page);expect(third.scenario.cabins).toHaveLength(1);
  expect(third.datasets[0].datasetHash).toBe(second.datasets[0].datasetHash);
  expect(third.results.every(result=>result.initialSnapshot?.cars.length===1||result.initialSnapshot===null)).toBeTruthy();
  await page.getByLabel('Uffici per piano',{exact:true}).fill('2');
  const fourth=await run(page);expect(fourth.scenario.offices).toHaveLength(6);
  expect(fourth.scenario.offices.reduce((sum,office)=>sum+office.employees,0)).toBe(30);
  expect(fourth.datasets[0].datasetHash).not.toBe(third.datasets[0].datasetHash);
  expect(await page.evaluate(()=>(window as unknown as {__regressionDocument:string}).__regressionDocument)).toBe('unchanged');
});
test('il replay precedente si ferma durante un nuovo confronto e riparte dai nuovi dati',async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;let count=0;
    window.Worker=class extends NativeWorker {
      postMessage(message:unknown,transfer:Transferable[]|StructuredSerializeOptions=[]) {
        if((message as {type:string}).type==='RUN'&&++count===2) {
          const receive=this.onmessage;
          this.onmessage=event=>{
            // Delay delivery of the real completed result; keep all computed data intact.
            if(event.data.type==='DONE')setTimeout(()=>receive?.call(this,event),1500);
            else receive?.call(this,event);
          };
        }
        if(Array.isArray(transfer))super.postMessage(message,transfer);
        else super.postMessage(message,transfer);
      }
    };
  });
  await configure(page);await run(page);
  await page.locator('.replay-details summary').click();
  await page.getByRole('button',{name:'Successivo',exact:true}).click();
  await expect(page.locator('.replay input[type="range"]')).toHaveValue('0');
  await page.getByLabel('Numero di ascensori',{exact:true}).fill('1');
  await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.locator('.run-actions button[type="submit"]')).toBeDisabled();
  await expect(page.locator('.simulation-results')).toHaveCount(0);
  await expect(page.getByText('Confronto completato. I risultati sono disponibili qui sotto.',{exact:true})).toBeVisible();
  await page.locator('.replay-details summary').click();
  await expect(page.locator('.replay input[type="range"]')).toHaveValue('-1');
  await expect(page.locator('.cabins-state>div')).toHaveCount(1);
});
test('giornata e organizzazione selezionano i dati corretti e si azzerano a ogni confronto',async({page})=>{
  await configure(page);await page.getByLabel('Giornate da confrontare',{exact:true}).fill('2');
  const experiment=await run(page);
  await page.getByRole('combobox',{name:'Giornata da vedere',exact:true}).selectOption('1');
  await page.getByRole('combobox',{name:'Organizzazione degli ascensori',exact:true}).selectOption('adaptive');
  await page.locator('.metrics-detail summary').click();
  const chosen=experiment.results.find(result=>result.seed==='202'&&result.policy==='adaptive')!;
  const table=page.locator('.metrics-detail table').first();
  await expect(table.locator('caption')).toContainText('Giornata 2, codice 202');
  await expect(table.locator('tbody tr').nth(0).locator('td')).toHaveText(new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(chosen.kpis.meanRideS!)+' s');
  const repeated=await run(page);
  expect(repeated.datasets).toEqual(experiment.datasets);
  expect(repeated.results.map(result=>result.kpis)).toEqual(experiment.results.map(result=>result.kpis));
  await expect(page.getByRole('combobox',{name:'Giornata da vedere',exact:true})).toHaveValue('0');
  await expect(page.getByRole('combobox',{name:'Organizzazione degli ascensori',exact:true})).toHaveValue('fifo');
  await expect(page.locator('.metrics-detail')).not.toHaveAttribute('open');
});
