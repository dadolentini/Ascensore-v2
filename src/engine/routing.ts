import type { CabinCapacity, CarSnapshot, PolicyId, RequestOutcome, ScenarioV2 } from '../model/contracts';
import { travelSeconds } from '../model/physics';

export type Task = { kind:'P'|'D'; requestId:number } | { kind:'R'; floor:number };
export interface CarState extends Omit<CarSnapshot,'onboardIds'> {
  onboardIds:number[]; plan:Task[]; doorEndS:number|null; idleSinceS:number;
}
export interface RouteEvaluation {
  pickups:Map<number,number>; drops:Map<number,number>; endS:number; feasible:boolean; cost:number;
}
export interface Assignment {
  carId:number; plan:Task[]; evaluation:RouteEvaluation; score:number; beforeCost:number;
  deltaCost:number; etaS:number; rideS:number; inducedDelayS:number;
}
export function taskFloor(task:Task,requests:ReadonlyMap<number,RequestOutcome>):number {
  if(task.kind==='R') return task.floor;
  const request=requests.get(task.requestId)!;
  return task.kind==='P'?request.origin:request.destination;
}

/** A stop consists only of consecutive tasks sharing a floor. Both models unload first. */
export function evaluateRoute(car:CarState,plan:readonly Task[],requests:ReadonlyMap<number,RequestOutcome>,scenario:ScenarioV2,capacity:CabinCapacity,now:number):RouteEvaluation {
  const pickups=new Map<number,number>(), drops=new Map<number,number>();
  const boarded=new Set(car.onboardIds);
  let time=now, floor=car.floor, feasible=true;
  if(car.mode==='moving') {
    time=Math.max(now,car.arrivalS!); floor=car.nextFloor!;
    if(!plan.length || taskFloor(plan[0],requests)!==floor) feasible=false;
  } else if(car.mode==='dwelling') time=Math.max(now,car.doorEndS!);
  let index=0;
  while(index<plan.length) {
    const target=taskFloor(plan[index],requests);
    if(!(index===0&&car.mode==='moving')) time+=travelSeconds(floor,target,scenario.physical);
    floor=target;
    const stop:Task[]=[];
    while(index<plan.length&&taskFloor(plan[index],requests)===target) stop.push(plan[index++]);
    let transfers=0;
    // Drops of existing occupants precede all pickups at the same stop.
    for(const task of stop) if(task.kind==='D'&&boarded.has(task.requestId)) {
      boarded.delete(task.requestId); drops.set(task.requestId,time); transfers++;
    }
    for(const task of stop) if(task.kind==='P') {
      const request=requests.get(task.requestId)!;
      if(request.state==='DONE'||boarded.has(task.requestId)) continue;
      boarded.add(task.requestId); pickups.set(task.requestId,time); transfers++;
      if(boarded.size>capacity.plannedPeople) feasible=false;
    }
    // Defensive same-stop P/D support; normal datasets forbid zero-length trips.
    for(const task of stop) if(task.kind==='D'&&!drops.has(task.requestId)&&boarded.has(task.requestId)) {
      boarded.delete(task.requestId); drops.set(task.requestId,time); transfers++;
    }
    if(transfers) time+=scenario.physical.doorBaseS+scenario.physical.passengerTransferS*transfers;
  }
  let cost=0;
  for(const [id,pick] of pickups) {
    const request=requests.get(id)!;
    if(request.state!=='WAIT') continue;
    cost+=Math.max(0,pick-now)+scenario.dispatch.lateWaitFactor/100*Math.max(0,pick-request.bornS-scenario.dispatch.fairnessThresholdS)**2;
  }
  for(const [id,drop] of drops) {
    const request=requests.get(id)!;
    const start=request.state==='ONBOARD'?now:pickups.get(id);
    if(start!==undefined) cost+=scenario.dispatch.rideTimeFactor*Math.max(0,drop-start);
  }
  return {pickups,drops,endS:time,feasible,cost:feasible?cost:Infinity};
}

/** Exhaustive insertion, bounded exactly as the source; this is a greedy local choice. */
export function chooseAssignment(request:RequestOutcome,cars:readonly CarState[],requests:ReadonlyMap<number,RequestOutcome>,scenario:ScenarioV2,capacities:readonly CabinCapacity[],now:number,policy:PolicyId,alternativeEta=false,excludedCarId?:number):Assignment|null {
  let best:Assignment|null=null;
  const capById=new Map(capacities.map(c=>[c.carId,c]));
  for(const car of cars) {
    if(car.id===excludedCarId||car.plan.length>=28||capById.get(car.id)!.plannedPeople<1) continue;
    const before=evaluateRoute(car,car.plan,requests,scenario,capById.get(car.id)!,now);
    const start=car.mode==='moving'&&car.plan.length?1:0;
    for(let pickIndex=start;pickIndex<=car.plan.length;pickIndex++) {
      for(let dropIndex=pickIndex+1;dropIndex<=car.plan.length+1;dropIndex++) {
        const plan:Task[]=[...car.plan.slice(0,pickIndex),{kind:'P',requestId:request.id},...car.plan.slice(pickIndex,dropIndex-1),{kind:'D',requestId:request.id},...car.plan.slice(dropIndex-1)];
        const after=evaluateRoute(car,plan,requests,scenario,capById.get(car.id)!,now);
        if(!after.feasible) continue;
        const etaS=after.pickups.get(request.id)!-now;
        const rideS=after.drops.get(request.id)!-after.pickups.get(request.id)!;
        let inducedDelayS=0;
        for(const [id,pickup] of before.pickups) inducedDelayS+=Math.max(0,(after.pickups.get(id)??now)-pickup);
        const beforeCost=Number.isFinite(before.cost)?before.cost:1e7;
        const deltaCost=after.cost-beforeCost;
        const score=alternativeEta?etaS:policy==='fifo'?etaS+.28*rideS+.32*inducedDelayS:deltaCost+(car.mode==='idle'&&!car.plan.length?.001*Math.abs(car.floor-request.origin):0);
        const candidate:Assignment={carId:car.id,plan,evaluation:after,score,beforeCost,deltaCost,etaS,rideS,inducedDelayS};
        if(!best || score<best.score || (score===best.score && ((policy!=='fifo'&&!alternativeEta&&after.cost<best.evaluation.cost) || ((policy==='fifo'||alternativeEta||after.cost===best.evaluation.cost)&&car.id<best.carId)))) best=candidate;
      }
    }
  }
  return best;
}
