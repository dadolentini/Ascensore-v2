import type { CabinCapacity, ScenarioV2 } from '../model/contracts';
import { travelSeconds } from '../model/physics';

export interface IdleCar { id:number; floor:number; }
export interface ParkingAssignment { carId:number; floor:number; demand:number; coverageBefore:number; effectiveCoverage:number; marginal:number; travelS:number; distanceFloors:number; }
export interface GroupingDecision { assignments:ParkingAssignment[]; keepCarIds:number[]; budget:number; eligible:number; maxGrouped:number; }
export function coverageGain(demand:number,coverage:number):number {
  return 30*(demand**1.25-Math.max(0,demand-coverage)**1.25)/Math.max(1,demand**.25);
}

/** D6 count-equivalent coverage, not empirical throughput; no global optimum claim. */
export function chooseGrouping(scenario:ScenarioV2,capacities:readonly CabinCapacity[],matureIdleCars:readonly IdleCar[],demand:Readonly<Record<number,number>>):GroupingDecision {
  const capacityById=new Map(capacities.map(c=>[c.carId,c]));
  let free=matureIdleCars.filter(c=>capacityById.get(c.id)!.plannedPeople>=1).sort((a,b)=>a.id-b.id);
  const eligible=free.length, budget=Math.max(0,eligible-1);
  const assignments:ParkingAssignment[]=[],coverage=new Map<number,number>(),counts=new Map<number,number>();
  for(let slot=0;slot<budget;slot++) {
    let best:ParkingAssignment|null=null;
    for(const car of free) for(let floor=0;floor<=scenario.upperFloors;floor++) {
      const d=demand[floor]??0;
      if(d<(floor===0?Math.max(5,scenario.learning.minPredictedCalls):scenario.learning.minPredictedCalls)) continue;
      if((counts.get(floor)??0)>=3) continue;
      const effectiveCoverage=capacityById.get(car.id)!.effectiveCoverage;
      const coverageBefore=coverage.get(floor)??0;
      const travelS=travelSeconds(car.floor,floor,scenario.physical),distanceFloors=Math.abs(car.floor-floor);
      const marginal=coverageGain(d,coverageBefore+effectiveCoverage)-coverageGain(d,coverageBefore)-scenario.learning.movementPenaltyPerS*travelS-scenario.learning.coveragePenalty*distanceFloors;
      const choice={carId:car.id,floor,demand:d,coverageBefore,effectiveCoverage,marginal,travelS,distanceFloors};
      if(!best||marginal>best.marginal||(marginal===best.marginal&&(car.id<best.carId||(car.id===best.carId&&floor<best.floor)))) best=choice;
    }
    if(!best||best.marginal<=0) break;
    assignments.push(best); coverage.set(best.floor,best.coverageBefore+best.effectiveCoverage);
    counts.set(best.floor,(counts.get(best.floor)??0)+1); free=free.filter(c=>c.id!==best!.carId);
  }
  // A non-positive zonal fallback cannot improve this objective. KEEP preserves the budget/reserve.
  return {assignments,keepCarIds:free.map(c=>c.id),budget,eligible,maxGrouped:Math.max(0,...counts.values())};
}

export function pythonRound(value:number):number {
  const lower=Math.floor(value),fraction=value-lower;
  return fraction===.5?(lower%2===0?lower:lower+1):Math.round(value);
}
export function hourlyParkingFloor(scenario:ScenarioV2,now:number,carIndex:number):number {
  const hour=now/3600;
  const midday=scenario.traffic.lunchStartHours.some(x=>Math.abs(hour-x)<.27||Math.abs(hour-(x+1))<.27);
  const zone=pythonRound(carIndex*scenario.upperFloors/Math.max(1,scenario.cabins.length-1));
  let target:number|null=(hour<9||12.6<hour&&hour<15.35||hour<11.7||hour>19.5)?0:null;
  if(18.55<hour&&hour<19.55||midday&&scenario.traffic.lunchStartHours.some(x=>Math.abs(hour-x)<.27)) target=zone;
  return target??zone;
}
