import type { Dataset, OfficeEstimate, ScenarioV2 } from './contracts';
import { generateDataset } from './demand';
import { mean, normalCdf } from './numerics';

/** Exposed separately so numerical oracles can use a shared OD corpus. */
export function estimateOfficeModels(scenario:ScenarioV2, training:readonly Dataset[]):OfficeEstimate[] {
  const observations=new Map<string,number[]>();
  for(const day of training) for(const request of day.requests) if(request.tripType==='lunch_exit') {
    const times=observations.get(request.officeId)??[];times.push(request.bornS/3600);observations.set(request.officeId,times);
  }
  const prior=scenario.learning.priorEvents,alpha=scenario.learning.priorWorkerDays,sigmaPrior=scenario.traffic.lunchSdMinutes/60;
  return scenario.offices.map(office=>{
    const times=observations.get(office.id)??[],n=times.length,average=mean(times);
    const learnedLunchHour=n?(n*average!+prior*office.lunchStartHour)/(n+prior):office.lunchStartHour;
    const phat=(n+alpha*office.lunchParticipation)/(Math.max(1,office.employees*training.length)+alpha);
    let sigma=sigmaPrior;
    if(n>2) {
      const observedVariance=times.reduce((sum,t)=>sum+(t-average!)**2,0)/(n-1);
      sigma=Math.sqrt((n*observedVariance+prior*sigmaPrior**2)/(n+prior));
    }
    return {officeId:office.id,floor:office.floor,employees:office.employees,learnedLunchHour,
      learnedSdMinutes:Math.max(4,Math.min(30,sigma*60)),learnedParticipation:Math.max(.01,Math.min(.99,phat))};
  });
}

function expected(model:OfficeEstimate,startHour:number,endHour:number,mu=model.learnedLunchHour):number {
  const sd=model.learnedSdMinutes/60;
  return Math.max(0,model.employees*model.learnedParticipation*(normalCdf((endHour-mu)/sd)-normalCdf((startHour-mu)/sd)));
}

export function officeHoldoutMae(models:readonly OfficeEstimate[],holdout:readonly Dataset[]):number|null {
  if(!holdout.length||!models.length) return null;
  const errors:number[]=[];
  for(const day of holdout) {
    const counts=new Map<string,number[]>();
    for(const request of day.requests) if(request.tripType==='lunch_exit') {
      const hour=request.bornS/3600;
      if(hour<11.5||hour>15) continue;
      const i=Math.min(41,Math.floor((hour-11.5)*12));
      const bins=counts.get(request.officeId)??Array(42).fill(0);bins[i]++;counts.set(request.officeId,bins);
    }
    for(const model of models) {
      const bins=counts.get(model.officeId)??Array(42).fill(0);
      for(let i=0;i<42;i++) errors.push(Math.abs(bins[i]-expected(model,11.5+i/12,11.5+(i+1)/12)));
    }
  }
  return mean(errors);
}

export async function learnOfficeModels(scenario:ScenarioV2):Promise<{models:OfficeEstimate[];holdoutMae:number|null}> {
  // Independent corpus; no validation or simulation seed is included in learning.
  const training:Dataset[]=[],holdout:Dataset[]=[];
  for(const seed of scenario.seeds.training) training.push(await generateDataset(scenario,seed));
  for(const seed of scenario.seeds.validation) holdout.push(await generateDataset(scenario,seed));
  const models=estimateOfficeModels(scenario,training);
  return {models,holdoutMae:officeHoldoutMae(models,holdout)};
}

const cache=new WeakMap<readonly OfficeEstimate[],WeakMap<ScenarioV2,Map<number,Record<number,number>>>>();
export function floorDemand(models:readonly OfficeEstimate[],scenario:ScenarioV2,nowS:number):Record<number,number> {
  const block=Math.floor(nowS/300);
  let byScenario=cache.get(models);if(!byScenario) {byScenario=new WeakMap();cache.set(models,byScenario);}
  let blocks=byScenario.get(scenario);if(!blocks) {blocks=new Map();byScenario.set(scenario,blocks);}
  const existing=blocks.get(block);if(existing) return existing;
  const hour=(block*300+150)/3600,start=hour+scenario.learning.leadMinutes/60,
    end=start+scenario.learning.forecastHorizonMinutes/60;
  const demand:Record<number,number>={0:0};
  for(const model of models) {
    demand[model.floor]=(demand[model.floor]??0)+expected(model,start,end);
    demand[0]+=expected(model,start,end,model.learnedLunchHour+scenario.traffic.lunchDurationMinutes/60);
  }
  // Model/scenario objects are immutable inputs for a run. Weak identity avoids
  // cross-run contamination, matching the source's 5min identity cache.
  Object.freeze(demand); blocks.set(block,demand);return demand;
}
