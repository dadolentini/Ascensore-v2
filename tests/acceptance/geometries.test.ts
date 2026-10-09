import { describe, expect, it } from 'vitest';
import { simulate } from '../../src/engine';
import { context, dataset, request, scenario } from '../engine/fixtures';

describe('all supported cabin/floor geometries',()=>{
  it('conserves people, deterministic masses and physical cabin limits on 400 small real runs',()=>{
    for (let upperFloors=1;upperFloors<=50;upperFloors++) {
      for (let count=1;count<=8;count++) {
        const s=scenario({upperFloors,endS:1000,cabins:Array.from({length:count},(_,id)=>({id,ratedLoadKg:90+80*(id%3),maxPeople:1+(id%3)}))});
        const result=simulate(s,dataset([request(0,0,0,upperFloors),request(1,1,upperFloors,0),request(2,2,0,1)]),'adaptive',context(s),true);
        expect(result.kpis.waiting+result.kpis.onboard+result.kpis.completed).toBe(3);
        expect(result.kpis.pickedUp).toBe(result.kpis.completed+result.kpis.onboard);
        expect(result.kpis.generated-result.kpis.completed).toBe(result.kpis.unfinished);
        for (const event of result.trace!) for (const car of event.carChanges) {
          const cabin=s.cabins.find(c=>c.id===car.id)!;
          expect(car.actualWeightKg).toBe(80*car.onboardIds.length);
          expect(car.actualWeightKg).toBeLessThanOrEqual(cabin.ratedLoadKg);
          expect(car.onboardIds.length).toBeLessThanOrEqual(cabin.maxPeople);
          expect(car.floor).toBeGreaterThanOrEqual(0); expect(car.floor).toBeLessThanOrEqual(upperFloors);
        }
      }
    }
  });
  it.each([[1,50],[8,1],[8,50]])('dense traffic at %i cabins and %i upper floors has finite, conserved outcomes', (count,upperFloors)=>{
    const s=scenario({upperFloors,endS:1800,cabins:Array.from({length:count},(_,id)=>({id,ratedLoadKg:[640,800,1000][id%3],maxPeople:[10,10,13][id%3]}))});
    const od=dataset(Array.from({length:120},(_,id)=>request(id,id*.2,id%2?upperFloors:0,id%2?0:upperFloors)));
    for(const policy of ['fifo','optimal','adaptive'] as const){
      const result=simulate(s,od,policy,context(s),true);
      expect(result.kpis.generated).toBe(120);expect(result.kpis.waiting+result.kpis.onboard+result.kpis.completed).toBe(120);
      expect(result.kpis.pickedUp).toBe(result.kpis.completed+result.kpis.onboard);
      expect(result.outcomes.every(r=>r.pickupS===null||r.pickupS>=r.bornS)).toBe(true);
      for(const event of result.trace!)for(const car of event.carChanges){const c=s.cabins[car.id];expect(car.actualWeightKg).toBe(80*car.onboardIds.length);expect(car.actualWeightKg).toBeLessThanOrEqual(c.ratedLoadKg);expect(car.onboardIds.length).toBeLessThanOrEqual(c.maxPeople);}
    }
  });
});
