import { describe, expect, it } from 'vitest';
import { evaluateRoute, chooseAssignment, type CarState, type Task } from '../../src/engine/routing';
import { context, request, scenario } from './fixtures';
import type { RequestOutcome } from '../../src/model/contracts';

function car(overrides: Partial<CarState> = {}): CarState {
  return { id:0, floor:0, nextFloor:null, mode:'idle', onboardIds:[], actualWeightKg:0, departureS:null, arrivalS:null, eventVersion:0, doorEndS:null, idleSinceS:0, plan:[], ...overrides };
}
function outcome(id:number,origin:number,destination:number,state:RequestOutcome['state']='WAIT'):RequestOutcome {
  return { ...request(id,0,origin,destination), state, pickupS:state==='ONBOARD'?0:null, finishS:null, assignedCarId:0 };
}
describe('ETA and contiguous stop evaluation',()=>{
  it('uses real remaining movement and door time',()=>{
    const s=scenario(); const requests=new Map([[0,outcome(0,1,2)]]);
    const plan:Task[]=[{kind:'P',requestId:0},{kind:'D',requestId:0}];
    const moving=evaluateRoute(car({mode:'moving',nextFloor:1,arrivalS:12,departureS:5,plan}),plan,requests,s,context(s).capacityByCar[0],10);
    expect(moving.pickups.get(0)).toBe(12);
    const dwelling=evaluateRoute(car({floor:1,mode:'dwelling',doorEndS:17,plan}),plan,requests,s,context(s).capacityByCar[0],10);
    expect(dwelling.pickups.get(0)).toBe(17);
  });
  it('unloads before pickups at one contiguous stop and charges one door',()=>{
    const s=scenario({cabins:[{id:0,ratedLoadKg:90,maxPeople:1}]}); const cap=context(s).capacityByCar[0];
    const requests=new Map([[0,outcome(0,0,1,'ONBOARD')],[1,outcome(1,1,2)]]);
    const plan:Task[]=[{kind:'P',requestId:1},{kind:'D',requestId:0},{kind:'D',requestId:1}];
    const evaluation=evaluateRoute(car({floor:1,onboardIds:[0],actualWeightKg:80,plan}),plan,requests,s,cap,10);
    expect(evaluation.feasible).toBe(true); expect(evaluation.pickups.get(1)).toBe(10); expect(evaluation.drops.get(0)).toBe(10);
    // Base4 + two transfers2 + triangular movement sqrt(12).
    expect(evaluation.drops.get(1)).toBeCloseTo(16+Math.sqrt(12),10);
  });
  it('does not merge equal floors separated by another floor',()=>{
    const s=scenario(); const requests=new Map([[0,outcome(0,0,1)],[1,outcome(1,0,2)]]);
    const plan:Task[]=[{kind:'P',requestId:0},{kind:'D',requestId:0},{kind:'P',requestId:1},{kind:'D',requestId:1}];
    const e=evaluateRoute(car(),plan,requests,s,context(s).capacityByCar[0],0);
    expect(e.pickups.get(1)).toBeGreaterThan(e.drops.get(0)!);
  });
  it('preserves the immutable first task of a moving car',()=>{
    const s=scenario(); const requests=new Map([[0,outcome(0,0,3,'ONBOARD')],[1,outcome(1,1,2)]]);
    const c=car({mode:'moving',nextFloor:3,arrivalS:20,departureS:0,onboardIds:[0],actualWeightKg:80,plan:[{kind:'D',requestId:0}]});
    const chosen=chooseAssignment(requests.get(1)!,[c],requests,s,context(s).capacityByCar,5,'optimal');
    expect(chosen?.plan[0]).toEqual({kind:'D',requestId:0});
    expect(chosen?.evaluation.pickups.get(1)).toBeGreaterThan(20);
  });
  it('evaluates the actual source FIFO and marginal-J coefficients on a simple real route',()=>{
    const s=scenario(); const r=outcome(0,0,1);const requests=new Map([[0,r]]),c=car();
    const baseline=chooseAssignment(r,[c],requests,s,context(s).capacityByCar,0,'fifo')!;
    const greedy=chooseAssignment(r,[c],requests,s,context(s).capacityByCar,0,'optimal')!;
    const adaptive=chooseAssignment(r,[c],requests,s,context(s).capacityByCar,0,'adaptive')!;
    const expectedRide=5+Math.sqrt(12);
    expect(baseline.score).toBeCloseTo(.28*expectedRide,12);
    expect(greedy.score).toBeCloseTo(.33*expectedRide,12);
    expect(greedy).toEqual(adaptive);
  });
  it('accounts for completed moving time when ranking new calls, with no half-segment approximation',()=>{
    const s=scenario(); const requests=new Map([[0,outcome(0,0,3,'ONBOARD')],[1,outcome(1,3,2)]]);
    const plan:Task[]=[{kind:'D',requestId:0},{kind:'P',requestId:1},{kind:'D',requestId:1}];
    const c=car({mode:'moving',nextFloor:3,arrivalS:50,departureS:0,onboardIds:[0],actualWeightKg:80,plan});
    expect(evaluateRoute(c,plan,requests,s,context(s).capacityByCar[0],49).pickups.get(1)).toBe(50);
  });
});
