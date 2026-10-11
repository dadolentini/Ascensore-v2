import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import type {ExperimentResult} from '../../src/model/contracts';

async function smallScenario(page:Page) {
  await page.goto('/#simulatore');
  await page.getByLabel('Piani sopra terra',{exact:true}).fill('3');
  await page.getByLabel('Uffici per piano',{exact:true}).fill('1');
  await page.getByLabel('Persone per ufficio',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Applica la distribuzione',exact:true}).click();
  await page.getByText('Giornate e impostazioni del confronto',{exact:true}).click();
  await page.getByLabel('Giornate da confrontare',{exact:true}).fill('1');
}
async function run(page:Page) {
  await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.locator('.run-status')).toContainText('Confronto completato. I risultati sono disponibili qui sotto.');
  await expect(page.locator('.result-card')).toHaveCount(3);
}
async function result(page:Page) {
  const pending=page.waitForEvent('download');
  await page.getByRole('button',{name:'Dati completi JSON',exact:false}).click();
  const download=await pending;
  return JSON.parse(await readFile((await download.path())!,'utf8')) as ExperimentResult;
}

test('un tentativo non valido distingue i risultati precedenti e riparte dopo la correzione',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;
    Object.assign(window,{__statusRuns:0});
    window.Worker=class extends NativeWorker {
      postMessage(message:unknown,transfer:Transferable[]|StructuredSerializeOptions=[]) {
        if((message as {type:string}).type==='RUN') {
          const state=window as unknown as {__statusRuns:number};state.__statusRuns++;
        }
        if(Array.isArray(transfer))super.postMessage(message,transfer);else super.postMessage(message,transfer);
      }
    };
  });
  await page.goto('/#simulatore');
  await page.getByText('Personalizza uffici e pause',{exact:true}).click();
  await page.getByLabel('ID ufficio 1',{exact:true}).fill('U-PERSONALIZZATO');
  await page.getByText('Personalizza uffici e pause',{exact:true}).click();
  await run(page);const first=await result(page);
  await page.getByLabel('Piani sopra terra',{exact:true}).fill('3');
  await expect(page.locator('.previous-notice')).toBeVisible();
  await page.locator('.run-actions button[type="submit"]').focus();await page.keyboard.press('Enter');
  await expect(page.locator('.run-status')).toContainText('Il nuovo confronto non è partito');
  await expect(page.locator('.run-status')).not.toContainText('Confronto completato.');
  await expect(page.locator('.form-errors li')).toHaveCount(1);
  await expect(page.locator('.form-errors')).toContainText('24 uffici');
  await expect(page.getByLabel('Piano ufficio 1',{exact:true})).toBeFocused();
  await expect(page.getByLabel('ID ufficio 1',{exact:true})).toHaveValue('U-PERSONALIZZATO');
  await expect(page.getByLabel('Piano ufficio 1',{exact:true})).toHaveValue('12');
  await expect(page.getByLabel('Piano ufficio 30',{exact:true})).toHaveValue(String(first.scenario.offices[29].floor));
  await expect(page.locator('.result-heading .eyebrow')).toContainText('Confronto precedente');
  expect(await result(page)).toEqual(first);
  expect(await page.evaluate(()=>(window as unknown as {__statusRuns:number}).__statusRuns)).toBe(1);
  await page.getByLabel('Uffici per piano',{exact:true}).fill('1');
  await page.getByLabel('Persone per ufficio',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Applica la distribuzione',exact:true}).click();
  await expect(page.locator('.run-status')).not.toContainText('Confronto completato.');
  await page.getByText('Giornate e impostazioni del confronto',{exact:true}).click();
  await page.getByLabel('Giornate da confrontare',{exact:true}).fill('1');
  await run(page);const corrected=await result(page);
  expect(corrected.scenario.upperFloors).toBe(3);
  expect(corrected.scenario.offices).toHaveLength(3);
  expect(corrected.scenario.offices.reduce((sum,office)=>sum+office.employees,0)).toBe(6);
  expect(corrected.datasets[0].datasetHash).not.toBe(first.datasets[0].datasetHash);
  await expect(page.locator('.previous-notice')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});

test('annullare la stessa configurazione conserva e identifica il confronto precedente',async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;let runs=0;
    window.Worker=class extends NativeWorker {
      postMessage(message:unknown,transfer:Transferable[]|StructuredSerializeOptions=[]) {
        if((message as {type:string}).type==='RUN'&&++runs===2) {
          const receive=this.onmessage;
          this.onmessage=event=>{
            // Hold the genuine computed result while the user cancels this run.
            if(event.data.type==='DONE')setTimeout(()=>this.onmessage&&receive?.call(this,event),2000);
            else receive?.call(this,event);
          };
        }
        if(Array.isArray(transfer))super.postMessage(message,transfer);else super.postMessage(message,transfer);
      }
    };
  });
  await smallScenario(page);await run(page);const first=await result(page);
  await page.locator('.run-actions button[type="submit"]').click();
  await page.getByRole('button',{name:'Annulla il calcolo',exact:true}).click();
  await expect(page.locator('.run-status')).toContainText('Calcolo annullato');
  await expect(page.locator('.result-heading .eyebrow')).toContainText('Confronto precedente');
  await expect(page.locator('.previous-notice')).not.toContainText('La configurazione è cambiata');
  expect(await result(page)).toEqual(first);
  await run(page);await expect(page.locator('.previous-notice')).toHaveCount(0);
});

test('un errore del worker distingue i risultati conservati anche senza modificare la bozza',async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;let runs=0;
    window.Worker=class extends NativeWorker {
      postMessage(message:unknown,transfer:Transferable[]|StructuredSerializeOptions=[]) {
        if((message as {type:string}).type==='RUN'&&++runs===2) {
          const receive=this.onmessage;
          this.onmessage=event=>{
            // Exercise the ERROR boundary after a real run, preserving the previous experiment.
            if(event.data.type==='DONE')receive?.call(this,new MessageEvent('message',{data:{type:'ERROR',jobId:event.data.jobId,kind:'internal',issues:[{code:'test-runtime',path:'worker',message:'Errore di prova del worker.'}]}}));
            else receive?.call(this,event);
          };
        }
        if(Array.isArray(transfer))super.postMessage(message,transfer);else super.postMessage(message,transfer);
      }
    };
  });
  await smallScenario(page);await run(page);const first=await result(page);
  await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.locator('.run-status')).toContainText('Il calcolo non è stato completato');
  await expect(page.locator('.form-errors')).toContainText('Errore di prova del worker');
  await expect(page.locator('.result-heading .eyebrow')).toContainText('Confronto precedente');
  await expect(page.locator('.previous-notice')).not.toContainText('La configurazione è cambiata');
  expect(await result(page)).toEqual(first);
  await run(page);await expect(page.locator('.previous-notice')).toHaveCount(0);
});

test('la prima simulazione mostra giornata e avanzamento reale prima di completarne una',async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker {
      postMessage(message:unknown,transfer:Transferable[]|StructuredSerializeOptions=[]) {
        if((message as {type:string}).type==='RUN') {
          const receive=this.onmessage;let held=false;let released=false;const pending:MessageEvent[]=[];
          Object.assign(window,{__releaseStatusProgress:()=>{released=true;for(const event of pending)receive?.call(this,event);pending.length=0;}});
          this.onmessage=event=>{
            if(held&&!released){pending.push(event);return;}
            receive?.call(this,event);
            // Hold subsequent genuine messages to inspect the first internal progress update.
            if(event.data.type==='PROGRESS'&&event.data.phase==='simulation'&&(event.data.policy||event.data.completedRuns===1)) {
              held=true;Object.assign(window,{__statusProgress:event.data});
            }
          };
        }
        if(Array.isArray(transfer))super.postMessage(message,transfer);else super.postMessage(message,transfer);
      }
    };
  });
  await smallScenario(page);await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.locator('.run-status')).toContainText('Giornata 1 di 1');
  await expect(page.locator('.run-status')).toContainText('codice 101');
  await expect(page.locator('.run-status')).toContainText('Solo su chiamata');
  await expect(page.locator('.run-status')).toContainText('Simulazioni completate: 0 di 3');
  const progress=await page.evaluate(()=>(window as unknown as {__statusProgress:{simulationTimeS:number;processedEvents:number}}).__statusProgress);
  const minutes=Math.floor(progress.simulationTimeS/60),clock=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  await expect(page.locator('.run-status [aria-live="off"]')).toContainText(`Orario simulato: ${clock}`);
  await expect(page.locator('.run-status [aria-live="off"]')).toContainText(`Eventi elaborati: ${progress.processedEvents}`);
  await expect(page.locator('.run-status [role="status"]')).not.toContainText('Eventi elaborati');
  await page.evaluate(()=>(window as unknown as {__releaseStatusProgress:()=>void}).__releaseStatusProgress());
  await expect(page.locator('.run-status')).toContainText('Confronto completato.');
});

test('la registrazione indisponibile è spiegata durante il calcolo e nei risultati completi',async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker {
      postMessage(message:unknown,transfer:Transferable[]|StructuredSerializeOptions=[]) {
        if((message as {type:string}).type==='RUN') {
          const receive=this.onmessage;let held=false;let released=false;const pending:MessageEvent[]=[];
          const deliver=(event:MessageEvent)=>{
            if(event.data.type==='DONE') {
              const experiment=event.data.experiment;
              Object.assign(window,{__statusFallbackKpis:experiment.results.map((row:{kpis:unknown})=>row.kpis)});
              // Model the genuine runner's trace fallback at its UI message boundary.
              receive?.call(this,new MessageEvent('message',{data:{...event.data,experiment:{...experiment,
                results:experiment.results.map((row:object)=>({...row,trace:null,initialSnapshot:null})),
                diagnosticsIssues:[...experiment.diagnosticsIssues,{code:'trace-unavailable',path:'traceFor',message:'La registrazione dei movimenti della giornata con codice 101 ha superato il limite di memoria. La stessa simulazione è stata ricalcolata senza registrazione, conservando tutte le richieste e le metriche.'}],
              }}}));
            } else receive?.call(this,event);
          };
          Object.assign(window,{__releaseStatusFallback:()=>{released=true;for(const event of pending)deliver(event);pending.length=0;}});
          this.onmessage=event=>{
            if(held&&!released){pending.push(event);return;}
            if(event.data.type==='PROGRESS'&&event.data.phase==='simulation'&&event.data.policy&&!held) {
              held=true;deliver(new MessageEvent('message',{data:{...event.data,recordingUnavailable:true}}));
            } else deliver(event);
          };
        }
        if(Array.isArray(transfer))super.postMessage(message,transfer);else super.postMessage(message,transfer);
      }
    };
  });
  await smallScenario(page);await page.locator('.run-actions button[type="submit"]').click();
  await expect(page.locator('.recording-unavailable-notice')).toContainText('Il calcolo continua senza registrazione');
  await page.evaluate(()=>(window as unknown as {__releaseStatusFallback:()=>void}).__releaseStatusFallback());
  await expect(page.locator('.run-status')).toContainText('Confronto completato.');
  await expect(page.locator('.trace-unavailable-notice')).toBeVisible();
  await expect(page.locator('.trace-unavailable-notice')).toContainText('Tutti i risultati del confronto sono stati calcolati');
  await expect(page.locator('.trace-unavailable-notice')).toContainText('registrazione dei movimenti');
  await expect(page.locator('.trace-unavailable-notice')).toContainText('non è disponibile');
  await expect(page.getByLabel('Registra chiamate e movimenti',{exact:false})).toBeChecked();
  await expect(page.locator('.result-card')).toHaveCount(3);
  await expect(page.locator('.replay-details')).toHaveCount(0);
  const experiment=await result(page);
  expect(experiment.results.map(row=>row.kpis)).toEqual(await page.evaluate(()=>(window as unknown as {__statusFallbackKpis:unknown}).__statusFallbackKpis));
  expect(experiment.diagnosticsIssues.some(issue=>issue.code==='trace-unavailable')).toBeTruthy();
});
