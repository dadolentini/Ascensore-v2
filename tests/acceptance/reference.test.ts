import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from 'vitest';
import { createDefaultScenario } from '../../src/model/defaults';
import { runExperiment } from '../../src/worker/runner';
import { aggregatePolicies } from '../../src/features/results/data';

test('riferimento fixed80: 24 run complete, corpus condivisi e trace verificabile',async()=>{
  const started=performance.now(),scenario=createDefaultScenario();
  const experiment=await runExperiment(scenario,['fifo','optimal','adaptive'],{policy:'adaptive',seed:'101'});
  expect(experiment.datasets).toHaveLength(8);expect(experiment.results).toHaveLength(24);
  for(const dataset of experiment.datasets){
    expect(dataset.requests.every(r=>r.weightKg===80&&r.origin!==r.destination)).toBe(true);
    expect(new Set(experiment.results.filter(r=>r.seed===dataset.seed).map(r=>r.datasetHash))).toEqual(new Set([dataset.datasetHash]));
  }
  for(const result of experiment.results){
    expect(result.kpis.generated).toBe(result.kpis.completed+result.kpis.unfinished);
    expect(result.kpis.pickedUp).toBe(result.kpis.completed+result.kpis.onboard);
    expect(result.kpis.completed).toBe(result.kpis.generated);
    for(const event of result.trace??[])for(const c of event.carChanges){
      const cabin=scenario.cabins.find(car=>car.id===c.id)!;
      expect(c.actualWeightKg).toBe(80*c.onboardIds.length);expect(c.actualWeightKg).toBeLessThanOrEqual(cabin.ratedLoadKg);expect(c.onboardIds.length).toBeLessThanOrEqual(cabin.maxPeople);
    }
  }
  const summaries=aggregatePolicies(experiment.results).map(({rows,...summary})=>summary);
  const report={modelVersion:scenario.modelVersion,elapsedMs:performance.now()-started,geometry:{cars:4,upperFloors:15,groundFloor:0},people:525,massKg:80,
    replicas:8,runs:24,summaries,datasets:experiment.datasets.map(({requests,...meta})=>({...meta,requestCount:requests.length})),
    tracedEvents:experiment.results.find(r=>r.trace)?.trace?.length,officeHoldoutMae:experiment.officeHoldoutMae,flowFit:experiment.flowFit,
    limitation:'Risultati sintetici del profilo V2; non ereditano i risultati originali né validano empiricamente 0.82.'};
  mkdirSync('/tmp/ascensori-v2-verification',{recursive:true});writeFileSync('/tmp/ascensori-v2-verification/reference-summary.json',JSON.stringify(report,null,2));
  console.info(JSON.stringify({runs:24,elapsedMs:report.elapsedMs,tracedEvents:report.tracedEvents,summaries}));
},120000);
