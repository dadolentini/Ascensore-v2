import type { CabinCapacity, CarSnapshot, PolicyId, RequestOutcome, ScenarioV2 } from '../model/contracts';
import { travelSeconds } from '../model/physics';

export type Task = { kind:'P'|'D'; requestId:number } | { kind:'R'; floor:number };
export interface CarState extends Omit<CarSnapshot,'onboardIds'> {
  onboardIds:number[]; plan:Task[]; doorEndS:number|null; idleSinceS:number;
}
export interface RouteEvaluation {
  pickups:Map<number,number>; drops:Map<number,number>; endS:number; feasible:boolean; cost:number;
}
/** Only reuse within a retry pass at the same time; invalidate a changed plan. */
export type AssignmentRouteCache=Map<number,{floors:number[];evaluation:RouteEvaluation}>;
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
  return evaluatePreparedRoute(car,plan,requests,scenario,capacity,now);
}

function evaluatePreparedRoute(car:CarState,plan:readonly Task[],requests:ReadonlyMap<number,RequestOutcome>,scenario:ScenarioV2,capacity:CabinCapacity,now:number,floors?:readonly number[],stopWhenInfeasible=false):RouteEvaluation {
  const pickups=new Map<number,number>(), drops=new Map<number,number>();
  const boarded=new Set(car.onboardIds);
  let time=now, floor=car.floor, feasible=true;
  if(car.mode==='moving') {
    time=Math.max(now,car.arrivalS!); floor=car.nextFloor!;
    if(!plan.length || (floors?floors[0]:taskFloor(plan[0],requests))!==floor) feasible=false;
  } else if(car.mode==='dwelling') time=Math.max(now,car.doorEndS!);
  if(!feasible&&stopWhenInfeasible) return {pickups,drops,endS:time,feasible:false,cost:Infinity};
  let index=0;
  while(index<plan.length) {
    const target=floors?floors[index]:taskFloor(plan[index],requests);
    if(!(index===0&&car.mode==='moving')) time+=travelSeconds(floor,target,scenario.physical);
    floor=target;
    const stopStart=index++;
    while(index<plan.length&&(floors?floors[index]:taskFloor(plan[index],requests))===target) index++;
    let transfers=0;
    // Drops of existing occupants precede all pickups at the same stop.
    for(let at=stopStart;at<index;at++) {
      const task=plan[at];
      if(task.kind==='D'&&boarded.has(task.requestId)) {
        boarded.delete(task.requestId); drops.set(task.requestId,time); transfers++;
      }
    }
    for(let at=stopStart;at<index;at++) {
      const task=plan[at];
      if(task.kind!=='P') continue;
      const request=requests.get(task.requestId)!;
      if(request.state==='DONE'||boarded.has(task.requestId)) continue;
      boarded.add(task.requestId); pickups.set(task.requestId,time); transfers++;
      if(boarded.size>capacity.plannedPeople) {
        feasible=false;
        // The original feasibility flag never becomes true again. Insertion
        // search discards this candidate without reading its times or cost.
        if(stopWhenInfeasible) return {pickups,drops,endS:time,feasible:false,cost:Infinity};
      }
    }
    // Defensive same-stop P/D support; normal datasets forbid zero-length trips.
    for(let at=stopStart;at<index;at++) {
      const task=plan[at];
      if(task.kind==='D'&&!drops.has(task.requestId)&&boarded.has(task.requestId)) {
        boarded.delete(task.requestId); drops.set(task.requestId,time); transfers++;
      }
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
export function chooseAssignment(request:RequestOutcome,cars:readonly CarState[],requests:ReadonlyMap<number,RequestOutcome>,scenario:ScenarioV2,capacities:readonly CabinCapacity[],now:number,policy:PolicyId,alternativeEta=false,excludedCarId?:number,routeCache?:AssignmentRouteCache):Assignment|null {
  let best:Assignment|null=null;
  const capById=new Map(capacities.map(c=>[c.carId,c]));
  const pickup:Task={kind:'P',requestId:request.id},drop:Task={kind:'D',requestId:request.id};
  for(const car of cars) {
    if(car.id===excludedCarId||car.plan.length>=28||capById.get(car.id)!.plannedPeople<1) continue;
    let cached=routeCache?.get(car.id);
    if(!cached) {
      const floors=car.plan.map(task=>taskFloor(task,requests));
      cached={floors,evaluation:evaluatePreparedRoute(car,car.plan,requests,scenario,capById.get(car.id)!,now,floors)};
      routeCache?.set(car.id,cached);
    }
    const carFloors=cached.floors,before=cached.evaluation;
    const start=car.mode==='moving'&&car.plan.length?1:0;
    const plan:Task[]=new Array(car.plan.length+2),floors:number[]=new Array(plan.length);
    for(let pickIndex=start;pickIndex<=car.plan.length;pickIndex++) {
      // Reuse one candidate buffer. Advancing the drop position swaps only two
      // tasks; retain a separate copy whenever it becomes the winning plan.
      for(let at=0,source=0;at<plan.length;at++) {
        if(at===pickIndex) {plan[at]=pickup;floors[at]=request.origin;}
        else if(at===pickIndex+1) {plan[at]=drop;floors[at]=request.destination;}
        else {plan[at]=car.plan[source];floors[at]=carFloors[source++];}
      }
      for(let dropIndex=pickIndex+1;dropIndex<=car.plan.length+1;dropIndex++) {
        if(dropIndex>pickIndex+1) {
          plan[dropIndex-1]=plan[dropIndex];floors[dropIndex-1]=floors[dropIndex];
          plan[dropIndex]=drop;floors[dropIndex]=request.destination;
        }
        const after=evaluatePreparedRoute(car,plan,requests,scenario,capById.get(car.id)!,now,floors,true);
        if(!after.feasible) continue;
        const etaS=after.pickups.get(request.id)!-now;
        const rideS=after.drops.get(request.id)!-after.pickups.get(request.id)!;
        let inducedDelayS=0;
        for(const [id,pickup] of before.pickups) inducedDelayS+=Math.max(0,(after.pickups.get(id)??now)-pickup);
        const beforeCost=Number.isFinite(before.cost)?before.cost:1e7;
        const deltaCost=after.cost-beforeCost;
        const score=alternativeEta?etaS:policy==='fifo'?etaS+.28*rideS+.32*inducedDelayS:deltaCost+(car.mode==='idle'&&!car.plan.length?.001*Math.abs(car.floor-request.origin):0);
        if(!best || score<best.score || (score===best.score && ((policy!=='fifo'&&!alternativeEta&&after.cost<best.evaluation.cost) || ((policy==='fifo'||alternativeEta||after.cost===best.evaluation.cost)&&car.id<best.carId)))) best={carId:car.id,plan:[...plan],evaluation:after,score,beforeCost,deltaCost,etaS,rideS,inducedDelayS};
      }
    }
  }
  return best;
}
