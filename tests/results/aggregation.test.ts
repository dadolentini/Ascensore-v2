import { describe, expect, it } from 'vitest';
import { aggregatePolicies, compareMeans, timelineRows, timeBuckets } from '../../src/features/results/data';
import type { PolicyResult, RequestOutcome } from '../../src/model/contracts';

function result(mean:number|null, generated:number, completed:number, seed:string):PolicyResult {
  return {policy:'fifo',seed,datasetHash:'x',modelVersion:'v',outcomes:[],initialSnapshot:null,trace:null,
    kpis:{generated,completed,pickedUp:completed,waiting:generated-completed,onboard:0,unfinished:generated-completed,
      servedPct:generated?100*completed/generated:0,meanWaitS:mean,medianWaitS:mean,p90WaitS:mean,p95WaitS:mean,
      waitOver120Pct:mean===null?null:0,meanRideS:mean,meanJourneyS:mean,bypasses:0,distanceFloors:0,
      parkingFloors:0,doorStops:0,adaptiveParkingDecisions:0,maxGroupedSameFloor:0}};
}
describe('risultati con popolazioni esplicite',()=>{
  it('distingue media delle giornate e tasso totale di servizio',()=>{
    const [summary]=aggregatePolicies([result(10,100,100,'1'),result(30,1,1,'2')]);
    expect(summary.meanWaitS).toBe(20); expect(summary.generated).toBe(101);expect(summary.servedPct).toBe(100);
  });
  it('non trasforma un campione vuoto in zero attesa',()=>{
    const [summary]=aggregatePolicies([result(null,4,0,'1')]);
    expect(summary.meanWaitS).toBeNull();expect(summary.unfinished).toBe(4);expect(summary.servedPct).toBe(0);
  });
  it('rappresenta peggioramenti e baseline zero',()=>{
    expect(compareMeans(10,15)).toEqual({deltaS:-5,percent:-50});
    expect(compareMeans(0,0)).toEqual({deltaS:0,percent:null});expect(compareMeans(null,1)).toBeNull();
  });
  it('la timeline conserva richieste incomplete e distingue attesa da viaggio',()=>{
    const request:RequestOutcome={id:0,officeId:'u',bornS:10,origin:0,destination:1,weightKg:80,tripType:'arrival',
      pickupS:15,finishS:25,state:'DONE',assignedCarId:0};
    const rows=timelineRows([request,{...request,id:1,pickupS:null,finishS:null,state:'WAIT'}]);
    expect(rows[0]).toMatchObject({waitS:5,rideS:10,journeyS:15});expect(rows[1].waitS).toBeNull();
  });
  it('raggruppa per orario della chiamata, include il bordo finale e conserva gli incompleti',()=>{
    const r:RequestOutcome={id:0,officeId:'u',bornS:0,origin:0,destination:1,weightKg:80,tripType:'arrival',pickupS:10,finishS:20,state:'DONE',assignedCarId:0};
    const rows=timeBuckets([r,{...r,id:1,bornS:30,pickupS:null,finishS:null,state:'WAIT'},{...r,id:2,bornS:60,pickupS:80,finishS:90}],0,60,.5);
    expect(rows).toEqual([{startS:0,endS:30,generated:1,completed:1,unfinished:0,meanWaitS:10},{startS:30,endS:60,generated:2,completed:1,unfinished:1,meanWaitS:20}]);
    expect(timeBuckets([{...r,pickupS:null,finishS:null,state:'WAIT'}],0,60,1)[0].meanWaitS).toBeNull();
  });
});
