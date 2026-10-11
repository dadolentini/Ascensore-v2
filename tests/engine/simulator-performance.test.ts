import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { simulate } from '../../src/engine/simulator';
import { context, dataset, request, scenario } from './fixtures';

function congestedFixture(endS=4000) {
  const s=scenario({upperFloors:7,endS,cabins:[{id:7,ratedLoadKg:170,maxPeople:2},{id:2,ratedLoadKg:250,maxPeople:3},{id:11,ratedLoadKg:1000,maxPeople:13}]});
  const d=dataset(Array.from({length:96},(_,id)=>{
    const origin=id%4===0?0:id%7+1;
    const destination=id%4===0?id%7+1:0;
    return request(id,Math.floor(id/12)*3,origin,destination);
  }));
  return {s,d,c:context(s)};
}
function parkingFixture() {
  const s=scenario({upperFloors:7,startS:43165,endS:43380,cabins:[7,2,11,4].map(id=>({id,ratedLoadKg:1000,maxPeople:13}))});
  const c=context(s);
  c.officeModels=[{officeId:'office',floor:7,employees:1000,learnedLunchHour:12.2,learnedSdMinutes:9,learnedParticipation:1}];
  const d=dataset([request(0,43199,0,7),request(1,43201,1,2),request(2,43210,7,0)]);
  return {s,d,c};
}
const fingerprint=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Captured from the immutable pre-fix engine, including every trace event/link,
// request outcome and KPI. Congestion forces retries and the 28-task bound.
const originalHashes:Record<string,string>={
  'congestion/fifo':'5b283a696ceedd1e2509a504fc7474d1f37410b3b37d0e9df475793070acbdc4',
  'horizon/fifo':'54ac694d7c9be55e4a48bc44f6cc3cbabccd9608eae0eef7f8f5e58d1e35d0de',
  'parking/fifo':'df318bd684e4ba436704c02895a3704551fe44aa55a27b80bb0ddb2814ca721d',
  'congestion/optimal':'5f459dd2e6dfbb128de370b3e51dea6ee9f24f2ff79fe50817eec0c497805f23',
  'horizon/optimal':'82a53c146434ca8c7436060b316c850c1fda4f44efc6ff7a0b42b500f59ce564',
  'parking/optimal':'8a7d05d48f7868956bffb4f7276c49e0eda4aa1122fa996cee9a54f4ed485437',
  'congestion/adaptive':'d96708bf14d2e7622351c325d7449248e3ee98c825329ad377435eeca0badd0e',
  'horizon/adaptive':'104e922eb6aa41a85058e337490c6aaaf7d97812b7f92cc1af680da2355dbb7b',
  'parking/adaptive':'e6e2c782231bec4a57c4430ec7a016b3be6c59b646fa1c113137cc845fd2b3dd',
};

describe('exact simulation performance regressions',()=>{
  it.each(['fifo','optimal','adaptive'] as const)('preserves complete original congestion/parking results and traces (%s)',policy=>{
    for(const [name,fixture] of [['congestion',congestedFixture()],['horizon',congestedFixture(120)],['parking',parkingFixture()]] as const) {
      const {s,d,c}=fixture;
      const result=simulate(s,d,policy,c,true);
      expect(fingerprint(result),`${name}/${policy}`).toBe(originalHashes[`${name}/${policy}`]);
    }
  });
  it('reports throttled internal progress during blocked retries without changing the result',()=>{
    const {s,d,c}=congestedFixture(120);
    const baseline=simulate(s,d,'fifo',c,true);
    let clock=0;
    const clockSpy=vi.spyOn(performance,'now').mockImplementation(()=>clock+=75);
    const updates:{processedEvents:number;simulationTimeS:number;wallMs:number}[]=[];
    try {
      const result=simulate(s,d,'fifo',c,true,progress=>updates.push({...progress,wallMs:clock}));
      expect(result).toEqual(baseline);
      expect(updates[0]).toEqual({processedEvents:0,simulationTimeS:s.startS,wallMs:75});
      expect(updates.length).toBeGreaterThan(2);
      expect(updates.some((update,index)=>index>0&&update.processedEvents===updates[index-1].processedEvents)).toBe(true);
      for(let index=1;index<updates.length-1;index++) {
        expect(updates[index].wallMs-updates[index-1].wallMs).toBeGreaterThanOrEqual(150);
        expect(updates[index].processedEvents).toBeGreaterThanOrEqual(updates[index-1].processedEvents);
        expect(updates[index].simulationTimeS).toBeGreaterThanOrEqual(updates[index-1].simulationTimeS);
      }
      expect(updates.at(-1)!.processedEvents).toBeGreaterThan(0);
      expect(updates.at(-1)!.simulationTimeS).toBeLessThanOrEqual(s.endS);
    } finally {clockSpy.mockRestore();}
  });
});
