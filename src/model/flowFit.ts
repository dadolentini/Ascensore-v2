import type { Dataset, FlowFit, ScenarioV2 } from './contracts';
import { mean, nnls } from './numerics';

export function fitFlow(scenario:ScenarioV2,datasets:readonly Dataset[]):Record<'up'|'down',FlowFit>|null {
  if(datasets.length<2) return null;
  const t=scenario.traffic;
  // Degenerate normals are valid demand inputs but cannot define Gaussian bases.
  if(t.arrivalSdMinutes<=0||t.departureSdMinutes<=0||t.lunchSdMinutes<=0) return null;
  const width=scenario.arrivalBinMinutes/60,start=scenario.startS/3600,end=scenario.endS/3600;
  const edgeCount=Math.floor((end+.0001-start)/width)+1;
  if(edgeCount<2) return null;
  if(edgeCount>20000) throw new RangeError('Flow fitting exceeds 20000 histogram edges');
  const edges=Array.from({length:edgeCount},(_,i)=>start+i*width);
  const centers=edges.slice(1).map((e,i)=>(e+edges[i])/2);
  const split=Math.min(scenario.fitTrainingDays,datasets.length-1);
  const result={} as Record<'up'|'down',FlowFit>;
  for(const direction of ['up','down'] as const) {
    const centersHour=direction==='up'?[t.arrivalMeanHour,...t.lunchStartHours.map(h=>h+t.lunchDurationMinutes/60)]:[...t.lunchStartHours,t.departureMeanHour];
    const sigmasHour=direction==='up'?[t.arrivalSdMinutes/60,...t.lunchStartHours.map(()=>t.lunchSdMinutes/60)]:[...t.lunchStartHours.map(()=>t.lunchSdMinutes/60),t.departureSdMinutes/60];
    const A=centers.map(h=>[1,...centersHour.map((mu,j)=>Math.exp(-.5*((h-mu)/sigmasHour[j])**2))]);
    const observations=datasets.map(day=>{
      const counts=Array(centers.length).fill(0) as number[];
      for(const r of day.requests) {
        if(direction==='up'?r.destination<=r.origin:r.destination>=r.origin) continue;
        const hour=r.bornS/3600;
        if(hour<edges[0]||hour>edges[edges.length-1]) continue;
        // Binary search reproduces numpy.histogram's left-closed bins and final
        // right-closed bin even at non-integral widths.
        let lo=0,hi=edges.length-1;
        while(lo<hi) {const mid=Math.ceil((lo+hi)/2);if(edges[mid]<=hour) lo=mid;else hi=mid-1;}
        counts[Math.min(lo,counts.length-1)]++;
      }
      return counts.map(count=>count/scenario.arrivalBinMinutes);
    });
    const trainMean=centers.map((_,i)=>mean(observations.slice(0,split).map(row=>row[i]))!),
      holdoutMean=centers.map((_,i)=>mean(observations.slice(split).map(row=>row[i]))!);
    const coefficients=nnls(A,trainMean),predicted=A.map(row=>row.reduce((sum,x,i)=>sum+x*coefficients[i],0));
    const average=mean(holdoutMean)!,ss=holdoutMean.reduce((sum,y)=>sum+(y-average)**2,0),
      squaredError=holdoutMean.reduce((sum,y,i)=>sum+(y-predicted[i])**2,0);
    result[direction]={coefficients,centersHour,sigmasHour,binEdgesHour:edges,unit:'requests/min',trainMean,holdoutMean,predicted,
      mae:mean(holdoutMean.map((y,i)=>Math.abs(y-predicted[i]))),r2:ss===0?null:1-squaredError/ss};
  }
  return result;
}
