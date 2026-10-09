import { describe, it, expect } from 'vitest';
import { createDefaultScenario } from '../../src/model/defaults';
import { validateScenario } from '../../src/model/validate';
import { travelSeconds, deriveCapacities } from '../../src/model/physics';
import { mean, quantile, normalCdf, nnls, pairedConfidenceInterval } from '../../src/model/numerics';
import { generateDataset } from '../../src/model/demand';
import { canonicalStringify, hashValue } from '../../src/model/reproducibility';
import { learnOfficeModels, floorDemand } from '../../src/model/officeModel';
import { fitFlow } from '../../src/model/flowFit';

describe('numerical reference and fixed80 physics', () => {
  it('resolves source defaults without latent uniform population assumptions', () => {
    const s = createDefaultScenario();
    expect(s.offices.length).toBe(30); expect(s.offices.reduce((n,o)=>n+o.employees,0)).toBe(525);
    expect(s.offices[0]).toEqual({id:'U12-FOCUS',floor:12,employees:65,lunchStartHour:13,lunchParticipation:.72});
    expect(validateScenario(s).ok).toBe(true);
  });
  it('preserves triangular / cruise transition and heterogeneous capacity thresholds', () => {
    const s = createDefaultScenario();
    expect(travelSeconds(0,1,s.physical)).toBeCloseTo(3.63318042491699,12);
    expect(travelSeconds(0,15,s.physical)).toBeCloseTo(22.3,12);
    s.cabins = [1000,640,800,80,80/.96].map((q,id)=>({id,ratedLoadKg:q,maxPeople:13}));
    expect(deriveCapacities(s).map(x=>x.plannedPeople)).toEqual([12,7,9,0,1]);
    expect(deriveCapacities(s)[1].effectiveCoverage).toBeCloseTo(5.74,12);
  });
  it('matches linear quantiles, normal CDF, active-set NNLS and paired Student t', () => {
    expect(mean([1,2,3])).toBe(2); expect(quantile([4,1,2,3],.95)).toBeCloseTo(3.85);
    expect(normalCdf(1.96)).toBeCloseTo(.9750021048517795,12);
    const x=nnls([[1,0],[0,1],[1,1]],[1,-1,0]); expect(x[0]).toBeCloseTo(.5,12); expect(x[1]).toBe(0);
    const ci = pairedConfidenceInterval([2,4,6,8],[1,1,1,1]);
    expect(ci?.mean).toBe(4); expect(ci?.lower).toBeCloseTo(-.10852051352,8);
    expect(pairedConfidenceInterval([1],[0])).toBeNull();
  });
  it('solves correlated NNLS columns with constrained active-set residuals', () => {
    const A=[[1,.8,.2],[1,.9,.1],[1,.1,.9],[1,.2,.8],[1,.5,.5]];
    const b=[1.8,1.9,1.1,1.2,1.5];
    const x=nnls(A,b); const pred=A.map(row=>row.reduce((v,a,i)=>v+a*x[i],0));
    pred.forEach((v,i)=>expect(v).toBeCloseTo(b[i],10));
    expect(x.every(v=>v>=0)).toBe(true);
    expect(mean([])).toBeNull(); expect(quantile([],.5)).toBeNull();
  });
});

describe('scenario validation', () => {
  it.each([null,[],{}, {upperFloors:'15'},NaN])('rejects malformed unknown input %j safely', value => {
    expect(validateScenario(value).ok).toBe(false);
  });
  it('rejects nonfinite, duplicate IDs, noncanonical or overlapping seeds, and N1 internal trips', () => {
    const s = createDefaultScenario(); s.physical.speedMps=Infinity;
    expect(validateScenario(s).ok).toBe(false);
    const t = createDefaultScenario(); t.offices=t.offices.map((o,i)=>i===1?{...o,id:t.offices[0].id}:o);
    expect(validateScenario(t).ok).toBe(false);
    const u = createDefaultScenario(); u.seeds.simulation=['01']; expect(validateScenario(u).ok).toBe(false);
    const v = createDefaultScenario(); v.seeds.validation=[v.seeds.training[0]]; expect(validateScenario(v).ok).toBe(false);
    const w = createDefaultScenario(); w.upperFloors=1; w.offices=w.offices.map(o=>({...o,floor:1}));
    expect(validateScenario(w).ok).toBe(false); w.traffic.internalTripsProbability=0; expect(validateScenario(w).ok).toBe(true);
  });
  it('accepts physically and conservatively zero-capacity scenarios without clamping', () => {
    const s=createDefaultScenario(); s.cabins=[{id:0,ratedLoadKg:1,maxPeople:1}];
    expect(validateScenario(s).ok).toBe(true); expect(deriveCapacities(s)[0].plannedPeople).toBe(0);
  });
});

describe('versioned finite-population demand and diagnostics', () => {
  it('canonicalizes objects and hashes identically across key order', async () => {
    expect(canonicalStringify({z:1,a:[2,3]})).toBe('{"a":[2,3],"z":1}');
    expect(await hashValue({b:1,a:2})).toBe(await hashValue({a:2,b:1}));
    expect(()=>canonicalStringify({a:Infinity})).toThrow();
  });
  it('repeats corpus exactly, separates seeds, fixes weight and preserves paired lunch duration', async () => {
    const s=createDefaultScenario(); const a=await generateDataset(s,'101'),b=await generateDataset(s,'101'),c=await generateDataset(s,'202');
    expect(a).toEqual(b); expect(a.datasetHash).not.toBe(c.datasetHash);
    expect(a.requests.every(r=>r.weightKg===80 && r.origin!==r.destination && r.bornS>=s.startS+1 && r.bornS<=s.endS-1)).toBe(true);
    expect(a.requests.filter(r=>r.tripType==='arrival').length).toBe(525);
    for(const office of s.offices) {
      const exits=a.requests.filter(r=>r.officeId===office.id&&r.tripType==='lunch_exit');
      const returns=a.requests.filter(r=>r.officeId===office.id&&r.tripType==='lunch_return');
      expect(exits.length).toBe(returns.length); exits.forEach((r,i)=>expect(returns[i].bornS-r.bornS).toBeCloseTo(3600,9));
    }
  });
  it('learns offline, keeps prior shrinkage for zero lunch events, and bins demand at 5min centers', async () => {
    const s=createDefaultScenario(); s.offices=[{id:'zero',floor:1,employees:10,lunchStartHour:13,lunchParticipation:0}];
    s.seeds.training=['1101','1102']; s.seeds.validation=['2201'];
    const result=await learnOfficeModels(s);
    expect(result.models[0].learnedLunchHour).toBe(13); expect(result.models[0].learnedParticipation).toBe(.01);
    expect(result.models[0].learnedSdMinutes).toBe(9); expect(result.holdoutMae).toBeGreaterThan(0);
    expect(floorDemand(result.models,s,46801)).toEqual(floorDemand(result.models,s,47099));
    expect(floorDemand(result.models,s,46801)[0]).toBeGreaterThanOrEqual(0);
  });
  it('fits actual per-minute histograms and reports constant holdout R2 as null', () => {
    const s=createDefaultScenario(); const blank={generatorVersion:'x',seed:'1',datasetHash:'x',requests:[]};
    expect(fitFlow(s,[blank])).toBeNull(); const f=fitFlow(s,[blank,blank]);
    expect(f?.up.unit).toBe('requests/min'); expect(f?.up.coefficients).toEqual([0,0,0,0,0]); expect(f?.up.r2).toBeNull(); expect(f?.up.mae).toBe(0);
  });
  it('converts counts to requests/min before fitting and includes both internal directions', () => {
    const s=createDefaultScenario(); const request={id:0,officeId:'U01',bornS:s.startS+20,origin:1,destination:2,weightKg:80 as const,tripType:'internal' as const};
    const day={generatorVersion:'x',seed:'1',datasetHash:'x',requests:[request,{...request,id:1,origin:2,destination:1}]};
    const f=fitFlow(s,[day,day]); expect(f?.up.trainMean[0]).toBe(.1); expect(f?.down.trainMean[0]).toBe(.1);
  });
});
