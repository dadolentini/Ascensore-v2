import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import type {ExperimentResult} from '../../src/model/contracts';

test('30 piani e 1800 persone: confronto completo e nuova simulazione senza ricaricare',async({page})=>{
  test.setTimeout(360000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/#simulatore');
  await page.evaluate(()=>Object.assign(window,{__heavySimulationDocument:'same-document'}));
  await page.getByLabel('Piani sopra terra',{exact:true}).fill('30');
  await page.getByLabel('Numero di ascensori',{exact:true}).fill('4');
  await page.getByLabel('Uffici per piano',{exact:true}).fill('3');
  await page.getByLabel('Persone per ufficio',{exact:true}).fill('20');
  await page.getByRole('button',{name:'Applica la distribuzione',exact:true}).click();
  await expect(page.locator('.scenario-summary')).toContainText('1800 persone');
  const started=Date.now();
  await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.getByText('Confronto completato. I risultati sono disponibili qui sotto.',{exact:true})).toBeVisible({timeout:300000});
  const elapsedMs=Date.now()-started;
  await expect(page.locator('.result-card')).toHaveCount(3);
  const downloadPending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Dati completi JSON',exact:false}).click();
  const download=await downloadPending;
  const experiment=JSON.parse(await readFile((await download.path())!,'utf8')) as ExperimentResult;
  expect(experiment.scenario.upperFloors).toBe(30);
  expect(experiment.scenario.cabins).toHaveLength(4);
  expect(experiment.scenario.offices).toHaveLength(90);
  expect(experiment.scenario.offices.every(office=>office.employees===20&&office.lunchParticipation===1)).toBe(true);
  expect(experiment.datasets).toHaveLength(8);
  expect(experiment.results).toHaveLength(24);
  for(const dataset of experiment.datasets){
    const rows=experiment.results.filter(result=>result.seed===dataset.seed);
    expect(new Set(rows.map(result=>result.policy))).toEqual(new Set(['fifo','optimal','adaptive']));
    expect(rows.every(result=>result.datasetHash===dataset.datasetHash)).toBe(true);
    for(const result of rows){
      expect(result.kpis.generated).toBe(dataset.requests.length);
      expect(result.kpis.generated).toBe(result.kpis.completed+result.kpis.waiting+result.kpis.onboard);
      expect(result.outcomes.every(outcome=>outcome.weightKg===80)).toBe(true);
    }
  }
  const traced=experiment.results.find(result=>result.trace!==null);
  if(traced)expect(traced.trace!.length).toBeGreaterThan(0);
  else {
    expect(experiment.diagnosticsIssues.some(issue=>issue.code==='trace-unavailable')).toBe(true);
    await expect(page.locator('.trace-unavailable-notice')).toBeVisible();
    await expect(page.locator('.trace-unavailable-notice')).toContainText('registrazione');
  }
  for(const event of traced?.trace??[])for(const car of event.carChanges){
    const capacity=experiment.scenario.cabins.find(cabin=>cabin.id===car.id)!;
    expect(car.actualWeightKg).toBe(80*car.onboardIds.length);
    expect(car.actualWeightKg).toBeLessThanOrEqual(capacity.ratedLoadKg);
    expect(car.onboardIds.length).toBeLessThanOrEqual(capacity.maxPeople);
  }
  await mkdir('/tmp/elevator-heavy-verification',{recursive:true});
  await writeFile(`/tmp/elevator-heavy-verification/${test.info().project.name||'chromium'}.json`,JSON.stringify({elapsedMs,floors:30,cars:4,offices:90,people:1800,days:8,runs:24,tracedEvents:traced?.trace?.length??0,recordingUnavailable:experiment.diagnosticsIssues.some(issue=>issue.code==='trace-unavailable'),results:experiment.results.map(result=>({policy:result.policy,seed:result.seed,kpis:result.kpis}))},null,2));
  console.info(JSON.stringify({scenario:'30 floors / 1800 people',elapsedMs,runs:24}));

  await page.getByLabel('Persone per ufficio',{exact:true}).fill('2');
  await page.getByLabel('Numero di ascensori',{exact:true}).fill('8');
  await page.getByText('Giornate e impostazioni del confronto',{exact:true}).click();
  await page.getByLabel('Giornate da confrontare',{exact:true}).fill('1');
  await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.getByText('Confronto completato. I risultati sono disponibili qui sotto.',{exact:true})).toBeVisible({timeout:30000});
  const repeatedPending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Dati completi JSON',exact:false}).click();
  const repeatedDownload=await repeatedPending;
  const repeated=JSON.parse(await readFile((await repeatedDownload.path())!,'utf8')) as ExperimentResult;
  expect(repeated.scenario.cabins).toHaveLength(8);
  expect(repeated.scenario.offices.reduce((sum,office)=>sum+office.employees,0)).toBe(180);
  expect(repeated.results).toHaveLength(3);
  expect(repeated.datasets[0].datasetHash).not.toBe(experiment.datasets[0].datasetHash);
  expect(await page.evaluate(()=>(window as unknown as {__heavySimulationDocument:string}).__heavySimulationDocument)).toBe('same-document');
  expect(errors).toEqual([]);
});
