import {it,expect} from 'vitest';
import {createDefaultScenario} from '../../src/model/defaults';
import {generateDataset} from '../../src/model/demand';
import {validateScenario} from '../../src/model/validate';

it('uses a stable clipped habit offset and one shared daily office shift',async()=>{
  const s=createDefaultScenario();s.offices=[{id:'shared',floor:1,employees:40,lunchStartHour:13,lunchParticipation:1}];
  s.traffic.lunchSdMinutes=0;s.traffic.internalTripsProbability=0;s.learning.dailyJitterMinutes=0;
  const a=await generateDataset(s,'101'),b=await generateDataset(s,'202');
  const times=(d:typeof a)=>d.requests.filter(r=>r.tripType==='lunch_exit').map(r=>r.bornS);
  expect(new Set(times(a)).size).toBe(1);expect(times(a)).toEqual(times(b));
  expect(Math.abs(times(a)[0]-13*3600)).toBeLessThanOrEqual(19*60);
  s.learning.dailyJitterMinutes=4;
  const c=await generateDataset(s,'101'),d=await generateDataset(s,'202');
  expect(new Set(times(c)).size).toBe(1);expect(new Set(times(d)).size).toBe(1);
  expect(times(c)[0]).not.toBe(times(d)[0]);
});

it('retains the approved source internal destination bias (next floor probability 2/N)',async()=>{
  const s=createDefaultScenario();s.upperFloors=4;s.offices=[{id:'bias',floor:1,employees:6000,lunchStartHour:13,lunchParticipation:0}];
  s.traffic.internalTripsProbability=1;
  const d=await generateDataset(s,'303'),internal=d.requests.filter(r=>r.tripType==='internal');
  expect(internal.length).toBe(6000);expect(internal.every(r=>r.origin===1&&r.destination!==1&&r.bornS>=9*3600&&r.bornS<18*3600)).toBe(true);
  for(const [floor,probability] of [[2,.5],[3,.25],[4,.25]]) {
    const observed=internal.filter(r=>r.destination===floor).length/internal.length;
    expect(Math.abs(observed-probability)).toBeLessThan(.025);
  }
});

it('N=1 preserves entrance, departure and lunch through lobby while eliminating internal travel',async()=>{
  const s=createDefaultScenario();s.upperFloors=1;s.offices=[{id:'single',floor:1,employees:10,lunchStartHour:13,lunchParticipation:1}];
  s.traffic.internalTripsProbability=0;expect(validateScenario(s).ok).toBe(true);
  const d=await generateDataset(s,'101');expect(d.requests.length).toBe(40);
  expect(d.requests.every(r=>r.origin!==r.destination && [r.origin,r.destination].every(f=>f===0||f===1))).toBe(true);
  expect(d.requests.some(r=>r.tripType==='internal')).toBe(false);
});

it('clips times to source horizon, retains stable generation order on ties, and never draws masses',async()=>{
  const s=createDefaultScenario();s.offices=[{id:'edge',floor:1,employees:3,lunchStartHour:13,lunchParticipation:0}];
  s.traffic.arrivalMeanHour=0;s.traffic.arrivalSdMinutes=0;s.traffic.departureMeanHour=24;s.traffic.departureSdMinutes=0;s.traffic.internalTripsProbability=0;
  const d=await generateDataset(s,'101');expect(d.requests.map(r=>r.bornS)).toEqual([s.startS+1,s.startS+1,s.startS+1,s.endS-1,s.endS-1,s.endS-1]);
  expect(d.requests.map(r=>r.id)).toEqual([0,1,2,3,4,5]);expect(d.requests.every(r=>r.weightKg===80)).toBe(true);
});

it('rejects finite input whose approved travel law overflows instead of starting a nonfinite engine',()=>{
  const s=createDefaultScenario();s.physical.floorHeightM=Number.MAX_VALUE;
  expect(validateScenario(s).ok).toBe(false);
});
