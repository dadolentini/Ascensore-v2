import type { Dataset, OdRequest, ScenarioV2, TripType } from './contracts';
import { GENERATOR_VERSION } from './defaults';
import { hashValue } from './reproducibility';

/** xmur3 seed expansion (UTF-16 seed label), sfc32 (12 warm-up rounds),
 * Box–Muller with cached second normal; all are part of GENERATOR_VERSION.
 * Habits and daily traffic have independent labelled streams. No mass draws.
 */
function randomStream(seed:string,domain:'habits'|'main') {
  if(!/^(0|[1-9][0-9]*)$/.test(seed)||seed.length>20||BigInt(seed)>18446744073709551615n) throw new TypeError('Noncanonical uint64 seed');
  const label=`${GENERATOR_VERSION}:${domain}:${seed}`;
  let h=1779033703^label.length;
  for(let i=0;i<label.length;i++) {h=Math.imul(h^label.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19);}
  const expand=()=>{h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return (h^=h>>>16)>>>0;};
  let a=expand(),b=expand(),c=expand(),d=expand();
  const uniform=()=>{
    a|=0;b|=0;c|=0;d|=0;
    let t=((a+b)|0)+d|0;d=(d+1)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);c=(c+t)|0;
    return (t>>>0)/4294967296;
  };
  for(let i=0;i<12;i++) uniform();
  let spare:number|null=null;
  const normal=(mu:number,sd:number)=>{
    if(spare!==null) {const z=spare;spare=null;return mu+sd*z;}
    // 1-u is in (0,1], preventing log(0) without consuming an extra draw.
    const radius=Math.sqrt(-2*Math.log(1-uniform())),theta=2*Math.PI*uniform();
    spare=radius*Math.sin(theta);return mu+sd*radius*Math.cos(theta);
  };
  return {uniform,normal};
}

export async function generateDataset(scenario:ScenarioV2,seed:string):Promise<Dataset> {
  const rng=randomStream(seed,'main'),habits=randomStream(scenario.seeds.habits,'habits');
  const requests:OdRequest[]=[], t=scenario.traffic;
  function add(bornS:number,origin:number,destination:number,officeId:string,tripType:TripType) {
    requests.push({id:requests.length,officeId,bornS:Math.max(scenario.startS+1,Math.min(scenario.endS-1,bornS)),origin,destination,weightKg:80,tripType});
  }
  for(const office of scenario.offices) {
    const offset=Math.max(-19,Math.min(19,habits.normal(0,scenario.learning.habitSdMinutes)));
    const dailyShift=rng.normal(0,scenario.learning.dailyJitterMinutes)*60;
    const lunchCenter=office.lunchStartHour*3600+offset*60+dailyShift;
    for(let worker=0;worker<office.employees;worker++) {
      add(rng.normal(t.arrivalMeanHour*3600,t.arrivalSdMinutes*60),0,office.floor,office.id,'arrival');
      add(rng.normal(t.departureMeanHour*3600,t.departureSdMinutes*60),office.floor,0,office.id,'departure');
      if(rng.uniform()<office.lunchParticipation) {
        const born=rng.normal(lunchCenter,t.lunchSdMinutes*60);
        add(born,office.floor,0,office.id,'lunch_exit');
        add(born+t.lunchDurationMinutes*60,0,office.floor,office.id,'lunch_return');
      }
      if(rng.uniform()<t.internalTripsProbability) {
        let destination=1+Math.floor(rng.uniform()*scenario.upperFloors);
        if(destination===office.floor) destination=office.floor%scenario.upperFloors+1;
        add((9+9*rng.uniform())*3600,office.floor,destination,office.id,'internal');
      }
    }
  }
  requests.sort((a,b)=>a.bornS-b.bornS||a.id-b.id);
  requests.forEach((r,i)=>{r.id=i;});
  const content={generatorVersion:GENERATOR_VERSION,seed,requests};
  return {...content,datasetHash:await hashValue(content)};
}
