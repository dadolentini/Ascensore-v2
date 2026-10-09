import type { Issue, Physical, ScenarioV2 } from './contracts';
import { MODEL_VERSION } from './defaults';
import { canonicalStringify } from './reproducibility';
import { travelSeconds } from './physics';

export type ValidationResult={ok:true;scenario:ScenarioV2}|{ok:false;issues:Issue[]};
type ObjectValue=Record<string,unknown>;

export function validateScenario(value: unknown): ValidationResult {
  const issues:Issue[]=[];
  const issue=(path:string,message:string,code='invalid')=>issues.push({code,path,message});
  const object=(v:unknown,path:string,keys:readonly string[]):ObjectValue=>{
    if(v===null||typeof v!=='object'||Array.isArray(v)) {issue(path,'È richiesto un oggetto.');return {};}
    const obj=v as ObjectValue;
    for(const key of keys) if(!Object.hasOwn(obj,key)) issue(path?`${path}.${key}`:key,'Campo obbligatorio.');
    for(const key of Object.keys(obj)) if(!keys.includes(key)) issue(path?`${path}.${key}`:key,'Campo operativo non riconosciuto.');
    return obj;
  };
  const numeric=(v:unknown,path:string,min:number,max=Number.MAX_VALUE,integer=false):v is number=>{
    if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isSafeInteger(v))) {
      issue(path,`Numero ${integer?'intero sicuro ':''}finito richiesto nell’intervallo [${min}, ${max}].`);return false;
    } return true;
  };
  const positive=(v:unknown,path:string)=>{
    if(!numeric(v,path,0)) return false;
    if(v===0) {issue(path,'Il valore deve essere positivo.');return false;}return true;
  };
  const fixed=(v:unknown,path:string,expected:unknown)=>{if(v!==expected) issue(path,`Il profilo approvato richiede ${String(expected)}.`,'profile');};
  const list=(v:unknown,path:string,min=0,max=Number.MAX_SAFE_INTEGER):unknown[]=>{
    if(!Array.isArray(v)) {issue(path,'È richiesta una lista.');return [];}
    if(v.length<min||v.length>max) issue(path,`Sono richiesti da ${min} a ${max} elementi.`);
    return v;
  };
  const s=object(value,'',['schemaVersion','modelVersion','upperFloors','cabins','physical','traffic','dispatch','learning',
    'offices','seeds','startS','endS','fitTrainingDays','arrivalBinMinutes','chartBinMinutes','sourceOnlyMetadata']);
  fixed(s.schemaVersion,'schemaVersion','2'); fixed(s.modelVersion,'modelVersion',MODEL_VERSION);
  numeric(s.upperFloors,'upperFloors',1,50,true);
  const carIds=new Set<number>();
  list(s.cabins,'cabins',1,8).forEach((v,i)=>{
    const p=`cabins[${i}]`,c=object(v,p,['id','ratedLoadKg','maxPeople']);
    if(numeric(c.id,`${p}.id`,0,Number.MAX_SAFE_INTEGER,true)) {
      if(carIds.has(c.id)) issue(`${p}.id`,'ID cabina duplicato.'); carIds.add(c.id);
    }
    positive(c.ratedLoadKg,`${p}.ratedLoadKg`);numeric(c.maxPeople,`${p}.maxPeople`,1,Number.MAX_SAFE_INTEGER,true);
  });
  const p=object(s.physical,'physical',['floorHeightM','speedMps','accelerationMps2','doorBaseS','passengerTransferS','passengerWeightKg','maxPlannedLoadFraction']);
  for(const key of ['floorHeightM','speedMps','accelerationMps2']) positive(p[key],`physical.${key}`);
  for(const key of ['doorBaseS','passengerTransferS']) numeric(p[key],`physical.${key}`,0);
  fixed(p.passengerWeightKg,'physical.passengerWeightKg',80);fixed(p.maxPlannedLoadFraction,'physical.maxPlannedLoadFraction',.96);
  if(typeof s.upperFloors==='number'&&s.upperFloors>=1&&s.upperFloors<=50&&
      ['floorHeightM','speedMps','accelerationMps2'].every(key=>typeof p[key]==='number'&&Number.isFinite(p[key])&&(p[key] as number)>0)&&
      !Number.isFinite(travelSeconds(0,s.upperFloors,p as unknown as Physical))) {
    issue('physical','Questi parametri producono un tempo di moto non finito.','numerical-range');
  }
  const t=object(s.traffic,'traffic',['arrivalMeanHour','arrivalSdMinutes','departureMeanHour','departureSdMinutes','lunchDurationMinutes','lunchSdMinutes','lunchStartHours','internalTripsProbability']);
  for(const key of ['arrivalMeanHour','departureMeanHour']) numeric(t[key],`traffic.${key}`,0,24);
  for(const key of ['arrivalSdMinutes','departureSdMinutes','lunchDurationMinutes','lunchSdMinutes']) numeric(t[key],`traffic.${key}`,0);
  list(t.lunchStartHours,'traffic.lunchStartHours',1).forEach((v,i)=>numeric(v,`traffic.lunchStartHours[${i}]`,0,24));
  numeric(t.internalTripsProbability,'traffic.internalTripsProbability',0,1);
  if(s.upperFloors===1&&t.internalTripsProbability!==0) issue('traffic.internalTripsProbability','Con N=1 la probabilità di viaggi interni deve essere 0.','single-floor');
  const d=object(s.dispatch,'dispatch',['fairnessThresholdS','rideTimeFactor','lateWaitFactor','relocationIdleDelayS']);
  for(const key of ['fairnessThresholdS','rideTimeFactor','lateWaitFactor']) numeric(d[key],`dispatch.${key}`,0);
  fixed(d.relocationIdleDelayS,'dispatch.relocationIdleDelayS',35);
  const l=object(s.learning,'learning',['habitSdMinutes','dailyJitterMinutes','priorEvents','priorWorkerDays','forecastHorizonMinutes','leadMinutes','reserveIdleCars','effectiveCapacityFraction','minPredictedCalls','movementPenaltyPerS','coveragePenalty','maxGroupedCarsPerFloor']);
  for(const key of ['habitSdMinutes','dailyJitterMinutes','priorEvents','priorWorkerDays','leadMinutes','minPredictedCalls','movementPenaltyPerS','coveragePenalty']) numeric(l[key],`learning.${key}`,0);
  fixed(l.forecastHorizonMinutes,'learning.forecastHorizonMinutes',12);fixed(l.reserveIdleCars,'learning.reserveIdleCars',1);
  fixed(l.effectiveCapacityFraction,'learning.effectiveCapacityFraction',.82);fixed(l.maxGroupedCarsPerFloor,'learning.maxGroupedCarsPerFloor',3);
  const officeIds=new Set<string>();
  list(s.offices,'offices',1).forEach((v,i)=>{
    const path=`offices[${i}]`,o=object(v,path,['id','floor','employees','lunchStartHour','lunchParticipation']);
    if(typeof o.id!=='string'||!o.id.trim()) issue(`${path}.id`,'ID ufficio non vuoto richiesto.');
    else {if(officeIds.has(o.id)) issue(`${path}.id`,'ID ufficio duplicato.');officeIds.add(o.id);}
    numeric(o.floor,`${path}.floor`,1,typeof s.upperFloors==='number'&&Number.isFinite(s.upperFloors)?s.upperFloors:50,true);
    numeric(o.employees,`${path}.employees`,1,Number.MAX_SAFE_INTEGER,true);
    numeric(o.lunchStartHour,`${path}.lunchStartHour`,0,24);numeric(o.lunchParticipation,`${path}.lunchParticipation`,0,1);
  });
  const seeds=object(s.seeds,'seeds',['simulation','habits','training','validation']), seenSeeds=new Set<string>();
  const seed=(v:unknown,path:string)=>{
    if(typeof v!=='string'||!/^(0|[1-9][0-9]*)$/.test(v)||v.length>20||(v.length<=20&&BigInt(v)>18446744073709551615n)) {
      issue(path,'Seed richiesto come stringa decimale canonica uint64.','seed');return;
    }
    if(seenSeeds.has(v)) issue(path,'Seed duplicato: corpus di simulazione, abitudini, training e holdout devono essere disgiunti.','seed-overlap');
    seenSeeds.add(v);
  };
  seed(seeds.habits,'seeds.habits');
  for(const key of ['simulation','training','validation']) list(seeds[key],`seeds.${key}`,key==='validation'?0:1).forEach((v,i)=>seed(v,`seeds.${key}[${i}]`));
  const startOk=numeric(s.startS,'startS',0,86400), endOk=numeric(s.endS,'endS',0,86400);
  if(startOk&&endOk&&(s.endS as number)-(s.startS as number)<=2) issue('endS','L’orizzonte deve superare startS di più di 2 secondi.');
  numeric(s.fitTrainingDays,'fitTrainingDays',1,Number.MAX_SAFE_INTEGER,true);
  positive(s.arrivalBinMinutes,'arrivalBinMinutes');positive(s.chartBinMinutes,'chartBinMinutes');
  if(s.sourceOnlyMetadata===null||typeof s.sourceOnlyMetadata!=='object'||Array.isArray(s.sourceOnlyMetadata)) issue('sourceOnlyMetadata','Metadati JSON oggetto richiesti.');
  else {try {canonicalStringify(s.sourceOnlyMetadata);}catch {issue('sourceOnlyMetadata','I metadati devono essere JSON finito, senza cicli.');}}
  return issues.length?{ok:false,issues}:{ok:true,scenario:value as ScenarioV2};
}
