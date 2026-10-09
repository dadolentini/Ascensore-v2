import { describe, expect, it } from 'vitest';
import { simulate } from '../../src/engine';
import { SimulationError } from '../../src/engine/errors';
import { travelSeconds } from '../../src/model/physics';
import { context, dataset, request, scenario } from './fixtures';

describe('finite event simulation', () => {
  it.each(['fifo','optimal','adaptive'] as const)('serves one passenger at actual arrival before dwell (%s)', policy => {
    const s = scenario({endS:30});
    const result = simulate(s, dataset([request()]), policy, context(s), true);
    const arrival = s.physical.doorBaseS + s.physical.passengerTransferS + travelSeconds(0,1,s.physical);
    expect(result.outcomes[0]).toMatchObject({ state:'DONE', pickupS:0, finishS:arrival });
    expect(result.kpis).toMatchObject({ generated:1, pickedUp:1, completed:1, waiting:0, onboard:0, unfinished:0, meanWaitS:0, meanRideS:arrival, distanceFloors:1, doorStops:2 });
    expect(result.initialSnapshot?.cars[0]).toMatchObject({ floor:0, mode:'idle', actualWeightKg:0 });
    expect(result.trace?.find(e => e.kind === 'PICKUP')?.carChanges[0].actualWeightKg).toBe(80);
  });
  it('returns null completed-only metrics for empty and unfinished runs', () => {
    const s = scenario({endS:1});
    const empty = simulate(s,dataset(),'fifo',context(s),false);
    expect(empty.kpis).toMatchObject({ completed:0, meanWaitS:null, p95WaitS:null, waitOver120Pct:null });
    expect(empty.trace).toBeNull(); expect(empty.initialSnapshot).toBeNull();
    const unfinished = simulate(s,dataset([request()]),'fifo',context(s),true);
    expect(unfinished.kpis).toMatchObject({ generated:1, pickedUp:1, completed:0, onboard:1, waiting:0, unfinished:1, distanceFloors:0, meanRideS:null });
    expect(unfinished.outcomes[0].finishS).toBeNull();
  });
  it('keeps all demand WAIT when every planned capacity is zero, without retries at the same instant', () => {
    const s = scenario({ cabins:[{id:0,ratedLoadKg:80,maxPeople:1}] });
    const result = simulate(s,dataset([request(),request(1)]),'adaptive',context(s),true);
    expect(result.kpis).toMatchObject({ generated:2, waiting:2, completed:0, unfinished:2, adaptiveParkingDecisions:0 });
    expect(result.trace!.filter(e=>e.kind==='RETRY')).toHaveLength(0);
  });
  it('repeats identical runs without mutating shared inputs', () => {
    const s = scenario(); const d = dataset([request(),request(1,1,1,2),request(2,1,0,2)]); const c = context(s);
    const before = JSON.stringify([s,d,c]);
    expect(simulate(s,d,'adaptive',c,true)).toEqual(simulate(s,d,'adaptive',c,true));
    expect(JSON.stringify([s,d,c])).toBe(before);
  });
  it('rejects stale capacity context and non-80kg input', () => {
    const s=scenario(); const c=context(s);
    expect(()=>simulate(s,dataset([{...request(),weightKg:81} as never]),'fifo',c,false)).toThrow(/80/);
    expect(()=>simulate(s,dataset(),'fifo',{...c,scenarioFingerprint:'stale'},false)).toThrow(/fingerprint/);
    expect(()=>simulate(s,dataset(),'fifo',{...c,capacityByCar:[{...c.capacityByCar[0],plannedPeople:1}]},false)).toThrow(/capacit/i);
  });
  it('unloads before boarding at a full cabin stop with one shared dwell',()=>{
    const s=scenario({cabins:[{id:0,ratedLoadKg:90,maxPeople:1}],endS:60});
    const result=simulate(s,dataset([request(0,0,0,1),request(1,1,1,2)]),'fifo',context(s),true);
    const r0=result.outcomes[0],r1=result.outcomes[1];
    expect(r1.pickupS).toBe(r0.finishS); expect(result.kpis.bypasses).toBe(0);
    const transfers=result.trace!.filter(e=>e.timeS===r0.finishS&&['DROP','PICKUP'].includes(e.kind));
    expect(transfers.map(e=>e.kind)).toEqual(['DROP','PICKUP']);
    const departure=result.trace!.find(e=>e.kind==='DEPART'&&e.fromFloor===1&&e.toFloor===2)!;
    expect(departure.departureS).toBe(r0.finishS!+s.physical.doorBaseS+2*s.physical.passengerTransferS);
  });
  it('preserves heap counter ordering for simultaneous calls and zero-distance arrivals',()=>{
    const s=scenario({endS:30});
    const result=simulate(s,dataset([request(9),request(3)]),'fifo',context(s),true);
    const atZero=result.trace!.filter(e=>e.timeS===0&&['NEW','PICKUP'].includes(e.kind));
    expect(atZero.slice(0,2).map(e=>[e.kind,e.requestId])).toEqual([['NEW',9],['NEW',3]]);
    expect(result.kpis.completed).toBe(2);
    expect(result.outcomes[0].pickupS).toBe(result.outcomes[1].pickupS);
  });
  it('does not reset an idle cabin timer when unrelated calls arrive',()=>{
    const s=scenario({startS:12*3600-35,endS:12*3600+30,upperFloors:1,cabins:[0,1,2,3,4].map(id=>({id,ratedLoadKg:1000,maxPeople:13}))});
    const c=context(s);
    c.officeModels=[{officeId:'office',floor:1,employees:1000,learnedLunchHour:12.2,learnedSdMinutes:9,learnedParticipation:.8}];
    const result=simulate(s,dataset([request(0,s.startS,0,1),request(1,s.startS+10,0,1),request(2,s.startS+20,0,1)]),'adaptive',c,true);
    const firstParking=result.trace!.find(e=>e.kind==='PARK');
    expect(firstParking?.timeS).toBe(s.startS+35);
    expect(firstParking?.carId).not.toBe(0);
  });
  it('ignores a stale PARK event after service has started and never reroutes the started segment',()=>{
    const s=scenario({startS:12*3600-35,endS:12*3600+80,upperFloors:20,cabins:[0,1].map(id=>({id,ratedLoadKg:1000,maxPeople:13}))});
    const c=context(s); c.officeModels=[{officeId:'office',floor:20,employees:1000,learnedLunchHour:12.2,learnedSdMinutes:9,learnedParticipation:.8}];
    const result=simulate(s,dataset([request(0,s.startS+34,0,20),request(1,s.startS+36,1,2)]),'adaptive',c,true);
    expect(result.trace!.filter(e=>e.kind==='PARK'&&e.carId===0&&e.timeS===s.startS+35)).toHaveLength(0);
    const segments=result.trace!.filter(e=>e.kind==='DEPART'&&e.carId===0);
    const firstNonzero=segments.find(e=>e.toFloor!==e.fromFloor)!;
    const arrival=result.trace!.find(e=>e.kind==='ARRIVE'&&e.carId===0&&e.departureS===firstNonzero.departureS);
    expect(arrival?.toFloor).toBe(firstNonzero.toFloor); expect(arrival?.arrivalS).toBe(firstNonzero.arrivalS);
  });
  it('never prepositions one adaptive cabin even under intense forecast demand',()=>{
    const s=scenario({startS:43200,endS:43800}); const c=context(s);
    c.officeModels=[{officeId:'office',floor:1,employees:10000,learnedLunchHour:12.2,learnedSdMinutes:9,learnedParticipation:.9}];
    const result=simulate(s,dataset(),'adaptive',c,true);
    expect(result.kpis).toMatchObject({adaptiveParkingDecisions:0,parkingFloors:0,maxGroupedSameFloor:0});
    expect(result.trace!.filter(e=>e.kind==='PARK'||e.kind==='DEPART')).toHaveLength(0);
  });
  it('fails explicitly at the request memory guard, rather than returning a partial sample',()=>{
    const s=scenario();
    expect(()=>simulate(s,dataset(Array.from({length:20001},(_,id)=>request(id))),'fifo',context(s),true)).toThrow(/limit/i);
  });
  it('retains burst demand behind the 28-task insertion bound until a route frees space',()=>{
    const s=scenario({endS:2000,cabins:[{id:0,ratedLoadKg:90,maxPeople:1}]});
    const result=simulate(s,dataset(Array.from({length:40},(_,id)=>request(id))),'fifo',context(s),false);
    expect(result.kpis).toMatchObject({generated:40,completed:40,waiting:0,onboard:0,bypasses:0});
    expect(result.outcomes.every(r=>r.state==='DONE')).toBe(true);
  });
  it('emits replayable deltas whose moving snapshots retain a real immutable segment',()=>{
    const s=scenario({endS:100});
    const result=simulate(s,dataset([request(0,0,0,3),request(1,2,1,2)]),'optimal',context(s),true);
    const replayRequests=new Map(result.initialSnapshot!.requests.map(r=>[r.id,r]));
    for(const event of result.trace!) {
      for(const r of event.requestChanges) replayRequests.set(r.id,r);
      for(const car of event.carChanges) if(car.mode==='moving') {
        expect(car.nextFloor).not.toBeNull(); expect(car.departureS).not.toBeNull(); expect(car.arrivalS).not.toBeNull();
        expect(car.arrivalS!).toBeGreaterThanOrEqual(event.timeS);
      }
    }
    expect([...replayRequests.values()]).toEqual(result.outcomes);
  });
  it('reports trace memory exhaustion explicitly without silently truncating a selected run',()=>{
    const s=scenario({endS:360_000});
    let error:unknown;
    try { simulate(s,dataset(Array.from({length:12_000},(_,id)=>request(id,id*30))),'fifo',context(s),true); }
    catch(caught) { error=caught; }
    expect(error).toBeInstanceOf(SimulationError);
    expect((error as SimulationError).kind).toBe('unsupported');
    expect((error as SimulationError).issues[0].code).toBe('resource-trace');
  });
});
