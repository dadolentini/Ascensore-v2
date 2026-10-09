import type { Physical, ScenarioV2, CabinCapacity } from './contracts';

export function travelSeconds(from: number, to: number, physical: Physical): number {
  const distance=Math.abs(from-to)*physical.floorHeightM;
  if (distance===0) return 0;
  const v=physical.speedMps, a=physical.accelerationMps2;
  return distance<=v*v/a ? 2*Math.sqrt(distance/a) : distance/v+v/a;
}

export function deriveCapacities(scenario: ScenarioV2): CabinCapacity[] {
  return scenario.cabins.map(cabin=>{
    const physicalPeople=Math.min(cabin.maxPeople,Math.floor(cabin.ratedLoadKg/80));
    const plannedPeople=Math.min(cabin.maxPeople,Math.floor(.96*cabin.ratedLoadKg/80));
    return {carId:cabin.id,physicalPeople,plannedPeople,effectiveCoverage:.82*plannedPeople};
  });
}
