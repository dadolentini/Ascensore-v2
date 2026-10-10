import type { PolicyId, PolicyResult, RequestOutcome } from '../../model/contracts';
import { mean } from '../../model/numerics';

export { POLICY_NAMES } from '../../content/model';
export const POLICY_COLORS:Record<PolicyId,string> = {fifo:'#25637D',optimal:'#73569C',adaptive:'#32685A'};
export const seconds = (value:number|null) => value === null ? 'Non disponibile' : `${new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(value)} s`;
export const secondsDifference = (value:number) => value>0&&value<.1?'meno di 0,1 s':seconds(value);
export function aggregatePolicies(results:readonly PolicyResult[]) {
  return (['fifo','optimal','adaptive'] as const).filter(policy=>results.some(r=>r.policy===policy)).map(policy=>{
    const rows=results.filter(r=>r.policy===policy);
    const total=(key:'generated'|'completed'|'unfinished'|'waiting'|'onboard'|'pickedUp'|'distanceFloors'|'parkingFloors'|'doorStops')=>rows.reduce((sum,r)=>sum+r.kpis[key],0);
    const average=(key:'meanWaitS'|'p95WaitS'|'meanRideS'|'meanJourneyS')=>mean(rows.flatMap(r=>r.kpis[key]===null?[]:[r.kpis[key]!]));
    const generated=total('generated'),completed=total('completed');
    return {policy,rows,generated,completed,unfinished:total('unfinished'),waiting:total('waiting'),onboard:total('onboard'),pickedUp:total('pickedUp'),
      servedPct:generated?100*completed/generated:0,meanWaitS:average('meanWaitS'),p95WaitS:average('p95WaitS'),
      meanRideS:average('meanRideS'),meanJourneyS:average('meanJourneyS'),distanceFloors:total('distanceFloors'),parkingFloors:total('parkingFloors'),doorStops:total('doorStops')};
  });
}
export function compareMeans(baseline:number|null,value:number|null) {
  if(baseline===null||value===null)return null;
  return {deltaS:baseline-value,percent:baseline===0?null:100*(baseline-value)/baseline};
}
export function timelineRows(outcomes:readonly RequestOutcome[]) {
  return outcomes.map(r=>({...r,waitS:r.pickupS===null?null:r.pickupS-r.bornS,
    rideS:r.pickupS===null||r.finishS===null?null:r.finishS-r.pickupS,
    journeyS:r.finishS===null?null:r.finishS-r.bornS}));
}
export function completedWaits(results:readonly PolicyResult[],policy:PolicyId) {
  return results.filter(r=>r.policy===policy).flatMap(r=>r.outcomes.filter(o=>o.state==='DONE'&&o.pickupS!==null&&o.finishS!==null).map(o=>o.pickupS!-o.bornS)).sort((a,b)=>a-b);
}
/** Half-open call-time buckets; the horizon's final endpoint belongs to the last bucket.
 * Only occupied buckets are allocated, so fine imported resolutions do not allocate an empty day.
 */
export function timeBuckets(outcomes:readonly RequestOutcome[],startS:number,endS:number,minutes:number) {
  const width=minutes*60,last=Math.max(0,Math.ceil((endS-startS)/width)-1);
  const buckets=new Map<number,RequestOutcome[]>();
  for(const r of outcomes){const index=Math.min(last,Math.max(0,Math.floor((r.bornS-startS)/width)));const rows=buckets.get(index)??[];rows.push(r);buckets.set(index,rows);}
  return [...buckets].sort(([a],[b])=>a-b).map(([index,rows])=>{
    const done=rows.filter(r=>r.state==='DONE'&&r.pickupS!==null&&r.finishS!==null);
    return {startS:startS+index*width,endS:Math.min(endS,startS+(index+1)*width),generated:rows.length,completed:done.length,unfinished:rows.length-done.length,meanWaitS:mean(done.map(r=>r.pickupS!-r.bornS))};
  });
}
export function downloadJson(value:unknown,name:string) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function downloadCsv(results:readonly PolicyResult[]) {
  const keys=['policy','seed','generated','completed','unfinished','meanWaitS','p95WaitS','meanRideS','meanJourneyS','distanceFloors','parkingFloors'] as const;
  const csv=[keys.join(','),...results.map(r=>keys.map(k=>k==='policy'?r.policy:k==='seed'?r.seed:r.kpis[k]??'').join(','))].join('\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ascensori-metriche.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
