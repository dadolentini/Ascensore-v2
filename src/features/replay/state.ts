import type { ReplaySnapshot, TraceEvent } from '../../model/contracts';

/** Discrete event state; display time never affects the simulation. */
export function replayAt(initial:ReplaySnapshot,events:readonly TraceEvent[],index:number):ReplaySnapshot {
  const cars=new Map(initial.cars.map(c=>[c.id,c])),requests=new Map(initial.requests.map(r=>[r.id,r]));
  let timeS=initial.timeS;
  for(let i=0;i<=Math.min(index,events.length-1);i++) {
    const event=events[i];timeS=event.timeS;
    for(const car of event.carChanges) cars.set(car.id,car);
    for(const request of event.requestChanges) requests.set(request.id,request);
  }
  return {timeS,cars:[...cars.values()],requests:[...requests.values()]};
}
