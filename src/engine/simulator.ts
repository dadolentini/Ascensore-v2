import type { CarSnapshot, Dataset, Kpis, PolicyId, PolicyResult, RequestOutcome, ScenarioV2, SimulationContext, TraceEvent, TraceLink } from '../model/contracts';
import { deriveCapacities, travelSeconds } from '../model/physics';
import { canonicalStringify } from '../model/reproducibility';
import { floorDemand } from '../model/officeModel';
import { EventHeap, type ScheduledEvent } from './heap';
import { chooseAssignment, taskFloor, type CarState, type Task } from './routing';
import { chooseGrouping, hourlyParkingFloor } from './parking';
import { SimulationError } from './errors';

const MAX_REQUESTS=25_000;
const MAX_EVENTS=1_000_000;
const MAX_TRACE_BYTES=32*1024*1024;
const MAX_TRACE_EVENTS=150_000;
interface BlockedRequest { signature:string; rejectedCarId?:number; }
const link=(equationId:string,symbolValues:Record<string,number>,codeRef:string,outputField:string):TraceLink=>({equationId,symbolValues,codeRef,outputField});

function validate(scenario:ScenarioV2,dataset:Dataset,policy:PolicyId,context:SimulationContext):void {
  const fail=(code:string,message:string,path:string):never=>{throw new SimulationError('invalid',code,message,path);};
  if(!['fifo','optimal','adaptive'].includes(policy)) fail('policy','Unknown policy','policy');
  if(scenario.physical.passengerWeightKg!==80||scenario.physical.maxPlannedLoadFraction!==.96) fail('fixed80','Physical mass must be 80 kg and planning fraction .96','physical');
  if(!Number.isFinite(scenario.startS)||!Number.isFinite(scenario.endS)||scenario.endS<=scenario.startS) fail('horizon','A finite increasing horizon is required','endS');
  if(context.scenarioFingerprint!==canonicalStringify(scenario)) fail('context-fingerprint','Scenario fingerprint differs from the simulation context','context.scenarioFingerprint');
  if(canonicalStringify(context.capacityByCar)!==canonicalStringify(deriveCapacities(scenario))) fail('context-capacity','Cabin capacities differ from the immutable simulation context','context.capacityByCar');
  const carIds=new Set(scenario.cabins.map(c=>c.id));
  if(carIds.size!==scenario.cabins.length) fail('car-ids','Cabin IDs must be unique','cabins');
  if(dataset.requests.length>MAX_REQUESTS) throw new SimulationError('unsupported','resource-requests',`Request limit ${MAX_REQUESTS} exceeded; no partial run returned`,'dataset.requests');
  const ids=new Set<number>();
  for(const request of dataset.requests) {
    if(request.weightKg!==80) fail('request-weight','Every dataset request must weigh exactly 80 kg','dataset.requests.weightKg');
    if(ids.has(request.id)) fail('request-ids','Request IDs must be unique','dataset.requests.id');
    ids.add(request.id);
    if(!Number.isFinite(request.bornS)||request.bornS<scenario.startS||request.bornS>scenario.endS) fail('request-time','Request birth must lie within the finite horizon','dataset.requests.bornS');
    if(!Number.isInteger(request.origin)||!Number.isInteger(request.destination)||request.origin<0||request.destination<0||request.origin>scenario.upperFloors||request.destination>scenario.upperFloors||request.origin===request.destination) fail('request-floors','Request floors must be distinct valid levels 0..N','dataset.requests');
  }
}
function snapshot(car:CarState):CarSnapshot {
  return {id:car.id,floor:car.floor,nextFloor:car.nextFloor,mode:car.mode,onboardIds:[...car.onboardIds],actualWeightKg:car.actualWeightKg,departureS:car.departureS,arrivalS:car.arrivalS,eventVersion:car.eventVersion};
}
function percentile(values:readonly number[],p:number):number|null {
  if(!values.length) return null;
  const ordered=[...values].sort((a,b)=>a-b),position=(ordered.length-1)*p,lower=Math.floor(position);
  return ordered[lower]+(ordered[Math.ceil(position)]-ordered[lower])*(position-lower);
}
function average(values:readonly number[]):number|null {return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;}

/** Finite DES: transfers occur at ARRIVE, before the shared door/transfer dwell. No drain. */
export function simulate(scenario:ScenarioV2,dataset:Dataset,policy:PolicyId,context:SimulationContext,traceEnabled:boolean):PolicyResult {
  validate(scenario,dataset,policy,context);
  const cars:CarState[]=scenario.cabins.map(c=>({id:c.id,floor:0,nextFloor:null,mode:'idle',onboardIds:[],actualWeightKg:0,departureS:null,arrivalS:null,eventVersion:0,doorEndS:null,idleSinceS:scenario.startS,plan:[]}));
  const carById=new Map(cars.map(c=>[c.id,c]));
  const outcomes:RequestOutcome[]=dataset.requests.map(r=>({...r,pickupS:null,finishS:null,state:'WAIT',assignedCarId:null}));
  const requests=new Map(outcomes.map(r=>[r.id,r]));
  const capacities=new Map(context.capacityByCar.map(c=>[c.carId,c]));
  const initialSnapshot=traceEnabled?{timeS:scenario.startS,cars:cars.map(snapshot),requests:outcomes.map(r=>({...r}))}:null;
  const trace:TraceEvent[]|null=traceEnabled?[]:null;
  const heap=new EventHeap(),blocked=new Map<number,BlockedRequest>();
  const parkingPending=new Map<number,number>(),parkingEvaluated=new Map<number,string>();
  let now=scenario.startS,activeEvent:ScheduledEvent|null=null,traceBytes=0,processedEvents=0;
  let bypasses=0,distanceFloors=0,parkingFloors=0,doorStops=0,adaptiveParkingDecisions=0,maxGroupedSameFloor=0;
  for(const request of outcomes) heap.push({timeS:request.bornS,kind:'NEW',requestId:request.id});

  function emit(kind:TraceEvent['kind'],car?:CarState,request?:RequestOutcome,links:TraceLink[]=[],extra:Partial<TraceEvent>={}):void {
    if(!trace) return;
    const event:TraceEvent={sequence:trace.length,timeS:now,heapOrder:activeEvent?.order,eventVersion:car?.eventVersion,kind,carId:car?.id,requestId:request?.id,carChanges:car?[snapshot(car)]:[],requestChanges:request?[{...request}]:[],links,...extra};
    traceBytes+=280+event.carChanges.reduce((sum,c)=>sum+160+8*c.onboardIds.length,0)+event.requestChanges.length*180+links.length*200;
    if(trace.length>=MAX_TRACE_EVENTS||traceBytes>MAX_TRACE_BYTES) throw new SimulationError('unsupported','resource-trace','Trace memory limit exceeded; no silent truncation or partial result returned','trace');
    trace.push(event);
  }
  function stateSignature():string {
    return cars.map(c=>`${c.id}:${c.eventVersion}:${c.mode}:${c.floor}:${c.onboardIds.join(',')}:${c.plan.map(t=>t.kind==='R'?`R${t.floor}`:`${t.kind}${t.requestId}`).join(',')}`).join('|');
  }
  function assign(request:RequestOutcome,alternativeEta=false,excludedCarId?:number):boolean {
    const choice=chooseAssignment(request,cars,requests,scenario,context.capacityByCar,now,policy,alternativeEta,excludedCarId);
    if(!choice) return false;
    const car=carById.get(choice.carId)!;
    car.plan=choice.plan; request.assignedCarId=car.id;
    const values={t_s:now,a_r_s:request.bornS,pick_hat_s:choice.evaluation.pickups.get(request.id)!,drop_hat_s:choice.evaluation.drops.get(request.id)!,eta_s:choice.etaS,ride_s:choice.rideS,induced_delay_s:choice.inducedDelayS,J_before_s:choice.beforeCost,J_after_s:choice.evaluation.cost,delta_J_s:choice.deltaCost,score_s:choice.score,alpha:scenario.dispatch.rideTimeFactor,zeta:scenario.dispatch.lateWaitFactor,w0_s:scenario.dispatch.fairnessThresholdS,mass_kg:80,rho:.96};
    emit('ASSIGN',car,request,[link(alternativeEta?'D3-ETA':policy==='fifo'?'SOURCE-FIFO':'EQ9-10',values,'src/engine/routing.ts:chooseAssignment','assignedCarId')]);
    return true;
  }
  function schedule(car:CarState):void {
    if(car.mode!=='idle'||!car.plan.length) return;
    const target=taskFloor(car.plan[0],requests),from=car.floor;
    car.eventVersion++; car.nextFloor=target;car.mode='moving';car.departureS=now;
    car.arrivalS=now+travelSeconds(from,target,scenario.physical);car.doorEndS=null;
    heap.push({timeS:car.arrivalS,kind:'ARRIVE',carId:car.id,version:car.eventVersion});
    emit('DEPART',car,undefined,[link('EQ5',{from_floor:from,to_floor:target,T_motion_s:car.arrivalS-now,h_m:scenario.physical.floorHeightM,v_mps:scenario.physical.speedMps,a_mps2:scenario.physical.accelerationMps2},'src/model/physics.ts:travelSeconds','arrivalS')],{fromFloor:from,toFloor:target,departureS:now,arrivalS:car.arrivalS});
  }
  function setIdle(car:CarState):void {
    car.mode='idle';car.idleSinceS=now;car.eventVersion++;car.nextFloor=null;car.departureS=null;car.arrivalS=null;car.doorEndS=null;
  }
  function retryAll():void {
    for(const [id,retry] of blocked) {
      const request=requests.get(id)!;
      if(request.state!=='WAIT') {blocked.delete(id);continue;}
      const signature=stateSignature();
      if(signature===retry.signature) continue;
      emit('RETRY',undefined,request,[link('D3',{mass_kg:80,alternative_eta:retry.rejectedCarId===undefined?0:1},'src/engine/simulator.ts:retryAll','assignedCarId')]);
      if(assign(request,retry.rejectedCarId!==undefined,retry.rejectedCarId)) blocked.delete(id);
      else retry.signature=signature;
    }
    for(const car of cars) schedule(car);
  }
  function armParking():void {
    if(policy==='fifo'||blocked.size) return;
    for(const car of cars) {
      if(car.mode!=='idle'||car.plan.length||car.onboardIds.length||capacities.get(car.id)!.plannedPeople<1) continue;
      const at=Math.max(now,car.idleSinceS+35),key=`${car.eventVersion}:${Math.floor(at/300)}`;
      if(parkingPending.get(car.id)===car.eventVersion||parkingEvaluated.get(car.id)===key) continue;
      parkingPending.set(car.id,car.eventVersion);heap.push({timeS:at,kind:'PARK',carId:car.id,version:car.eventVersion});
    }
  }
  function processArrival(car:CarState):void {
    const from=car.floor,to=car.nextFloor!,departure=car.departureS!,arrival=car.arrivalS!;
    const parking=car.plan[0]?.kind==='R';
    distanceFloors+=Math.abs(to-from);if(parking) parkingFloors+=Math.abs(to-from);
    car.floor=to;car.nextFloor=null;car.departureS=null;car.arrivalS=null;car.mode='idle';
    emit('ARRIVE',car,undefined,[],{fromFloor:from,toFloor:to,departureS:departure,arrivalS:arrival});
    const stop:Task[]=[];
    while(car.plan.length&&taskFloor(car.plan[0],requests)===to) stop.push(car.plan.shift()!);
    let transfers=0;
    const drop=(id:number):void=>{
      const request=requests.get(id)!;
      if(request.state!=='ONBOARD'||!car.onboardIds.includes(id)) return;
      request.finishS=now;request.state='DONE';car.onboardIds=car.onboardIds.filter(i=>i!==id);car.actualWeightKg=80*car.onboardIds.length;transfers++;
      emit('DROP',car,request,[link('EQ2',{W_s:request.pickupS!-request.bornS,R_s:now-request.pickupS!,T_s:now-request.bornS},'src/engine/simulator.ts:processArrival','finishS')]);
    };
    for(const task of stop) if(task.kind==='D') drop(task.requestId);
    for(const task of stop) if(task.kind==='P') {
      const request=requests.get(task.requestId)!;
      if(request.state!=='WAIT') continue;
      const cabin=scenario.cabins.find(c=>c.id===car.id)!;
      if(car.actualWeightKg+80<=cabin.ratedLoadKg&&car.onboardIds.length+1<=cabin.maxPeople) {
        request.pickupS=now;request.state='ONBOARD';car.onboardIds.push(request.id);car.actualWeightKg=80*car.onboardIds.length;transfers++;
        emit('PICKUP',car,request,[link('EQ6-7',{load_kg:car.actualWeightKg,Q_kg:cabin.ratedLoadKg,people:car.onboardIds.length,C_people:cabin.maxPeople,mass_kg:80},'src/engine/simulator.ts:processArrival','pickupS')]);
      } else {
        bypasses++;request.assignedCarId=null;
        car.plan=car.plan.filter(t=>!(t.kind==='D'&&t.requestId===request.id));
        blocked.set(request.id,{signature:stateSignature(),rejectedCarId:car.id});
        emit('RETRY',car,request,[link('D3',{load_kg:car.actualWeightKg,Q_kg:cabin.ratedLoadKg,people:car.onboardIds.length,mass_kg:80,physical_rejection:1},'src/engine/simulator.ts:processArrival','assignedCarId')]);
      }
    }
    for(const task of stop) if(task.kind==='D') drop(task.requestId);
    if(transfers) {
      doorStops++;car.mode='dwelling';car.doorEndS=now+scenario.physical.doorBaseS+scenario.physical.passengerTransferS*transfers;
      heap.push({timeS:car.doorEndS,kind:'DOOR',carId:car.id,version:car.eventVersion});
      emit('ARRIVE',car,undefined,[link('EQ5-STOP',{b_s:scenario.physical.doorBaseS,u_s_per_person:scenario.physical.passengerTransferS,n_transfer:transfers,T_stop_s:car.doorEndS-now},'src/engine/simulator.ts:processArrival','mode')]);
    } else {setIdle(car);emit('ARRIVE',car);schedule(car);}
    retryAll();
  }
  armParking();
  while(heap.size) {
    const event=heap.pop()!;
    if(event.timeS>scenario.endS) break;
    now=event.timeS;activeEvent=event;
    if(++processedEvents>MAX_EVENTS) throw new SimulationError('unsupported','resource-events','Processed-event limit exceeded; no partial run returned');
    if(event.kind==='NEW') {
      const request=requests.get(event.requestId)!;
      emit('NEW',undefined,request,[],{fromFloor:request.origin,toFloor:request.destination});
      if(!assign(request)) blocked.set(request.id,{signature:stateSignature()});
      for(const car of cars) schedule(car);
      armParking();continue;
    }
    const car=carById.get(event.carId)!;
    if(event.version!==car.eventVersion) continue;
    if(event.kind==='ARRIVE') {
      if(car.mode!=='moving') continue;
      processArrival(car);armParking();continue;
    }
    if(event.kind==='DOOR') {
      if(car.mode!=='dwelling') continue;
      setIdle(car);emit('DOOR',car);schedule(car);retryAll();armParking();continue;
    }
    parkingPending.delete(car.id);
    if(car.mode!=='idle'||car.plan.length||car.onboardIds.length||blocked.size||now-car.idleSinceS<35) continue;
    const key=`${car.eventVersion}:${Math.floor(now/300)}`;
    if(parkingEvaluated.get(car.id)===key) continue;
    if(policy==='adaptive') {
      const mature=cars.filter(c=>c.mode==='idle'&&!c.plan.length&&!c.onboardIds.length&&now-c.idleSinceS>=35&&capacities.get(c.id)!.plannedPeople>=1);
      const decision=chooseGrouping(scenario,context.capacityByCar,mature,floorDemand(context.officeModels,scenario,now));
      // One eligible cabin supplies the reserve: a single-cabin fleet never proactively moves.
      if(!decision.budget) {for(const c of mature) parkingEvaluated.set(c.id,`${c.eventVersion}:${Math.floor(now/300)}`);emit('KEEP',car);continue;}
      adaptiveParkingDecisions++;maxGroupedSameFloor=Math.max(maxGroupedSameFloor,decision.maxGrouped);
      for(const c of mature) parkingEvaluated.set(c.id,`${c.eventVersion}:${Math.floor(now/300)}`);
      for(const assignment of decision.assignments) {
        const target=carById.get(assignment.carId)!;
        emit('PARK',target,undefined,[link('D6-EQ17-19',{D_f:assignment.demand,B_before:assignment.coverageBefore,q_e:assignment.effectiveCoverage,marginal_s_equiv:assignment.marginal,T_ef_s:assignment.travelS,distance_floors:assignment.distanceFloors,budget:decision.budget,eligible:decision.eligible,target_floor:assignment.floor,max_grouped:decision.maxGrouped},'src/engine/parking.ts:chooseGrouping','nextFloor')],{fromFloor:target.floor,toFloor:assignment.floor});
        if(target.floor!==assignment.floor) {target.plan=[{kind:'R',floor:assignment.floor}];schedule(target);}
      }
      for(const id of decision.keepCarIds) emit('KEEP',carById.get(id),undefined,[link('D6-RESERVE',{budget:decision.budget,allocated:decision.assignments.length,eligible:decision.eligible},'src/engine/parking.ts:chooseGrouping','mode')]);
    } else if(policy==='optimal') {
      parkingEvaluated.set(car.id,key);
      const target=hourlyParkingFloor(scenario,now,cars.indexOf(car));
      emit(target===car.floor?'KEEP':'PARK',car,undefined,[link('SOURCE-HOURLY-PARK',{hour:now/3600,target_floor:target,idle_s:now-car.idleSinceS},'src/engine/parking.ts:hourlyParkingFloor','nextFloor')],{fromFloor:car.floor,toFloor:target});
      if(target!==car.floor) {car.plan=[{kind:'R',floor:target}];schedule(car);}
    }
  }
  const completed=outcomes.filter(r=>r.state==='DONE');
  const waits=completed.map(r=>r.pickupS!-r.bornS),rides=completed.map(r=>r.finishS!-r.pickupS!),journeys=completed.map(r=>r.finishS!-r.bornS);
  const waiting=outcomes.filter(r=>r.state==='WAIT').length,onboard=outcomes.filter(r=>r.state==='ONBOARD').length;
  const kpis:Kpis={generated:outcomes.length,pickedUp:completed.length+onboard,completed:completed.length,waiting,onboard,unfinished:waiting+onboard,servedPct:outcomes.length?100*completed.length/outcomes.length:0,meanWaitS:average(waits),medianWaitS:percentile(waits,.5),p90WaitS:percentile(waits,.9),p95WaitS:percentile(waits,.95),waitOver120Pct:completed.length?100*waits.filter(w=>w>120).length/completed.length:null,meanRideS:average(rides),meanJourneyS:average(journeys),bypasses,distanceFloors,parkingFloors,doorStops,adaptiveParkingDecisions,maxGroupedSameFloor};
  return {policy,seed:dataset.seed,datasetHash:dataset.datasetHash,modelVersion:scenario.modelVersion,kpis,outcomes,initialSnapshot,trace};
}
