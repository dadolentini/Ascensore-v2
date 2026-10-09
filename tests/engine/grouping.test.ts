import { describe, expect, it } from 'vitest';
import { chooseGrouping, coverageGain } from '../../src/engine/parking';
import { context, scenario } from './fixtures';

describe('D6 individual coverage allocation',()=>{
  it('reduces exactly to q times k for homogeneous cars',()=>{
    const d=12,q=9.84,k=2;
    expect(coverageGain(d,k*q)).toBeCloseTo(30*(d**1.25-Math.max(0,d-k*q)**1.25)/Math.max(1,d**.25),12);
  });
  it('reserves one eligible car and excludes cap0 from eligibility and coverage',()=>{
    const s=scenario({cabins:[{id:0,ratedLoadKg:1000,maxPeople:13},{id:1,ratedLoadKg:80,maxPeople:1}]});
    const choice=chooseGrouping(s,context(s).capacityByCar,[{id:0,floor:0},{id:1,floor:0}],{1:100});
    expect(choice.assignments).toHaveLength(0); expect(choice.budget).toBe(0);
  });
  it('counts lobby and zero-distance targets in per-decision cap3 and allocation budget',()=>{
    const s=scenario({upperFloors:1,cabins:Array.from({length:8},(_,id)=>({id,ratedLoadKg:1000,maxPeople:13}))});
    const choice=chooseGrouping(s,context(s).capacityByCar,s.cabins.map(c=>({id:c.id,floor:0})),{0:1000,1:1000});
    expect(choice.budget).toBe(7); expect(choice.assignments).toHaveLength(6);
    expect(choice.assignments.filter(a=>a.floor===0)).toHaveLength(3);
    expect(choice.assignments.filter(a=>a.floor===1)).toHaveLength(3);
    expect(choice.keepCarIds).toHaveLength(2);
  });
  it('does not force fallback targets when no positive marginal passes the demand thresholds',()=>{
    const s=scenario({cabins:Array.from({length:3},(_,id)=>({id,ratedLoadKg:1000,maxPeople:13}))});
    const choice=chooseGrouping(s,context(s).capacityByCar,s.cabins.map(c=>({id:c.id,floor:0})),{0:4.99,1:2.99});
    expect(choice.assignments).toHaveLength(0); expect(choice.keepCarIds).toEqual([0,1,2]);
  });
});
