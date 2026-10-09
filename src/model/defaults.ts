import type { ScenarioV2 } from './contracts';

export const MODEL_VERSION = 'v2.fixed80.corrected.1';
export const GENERATOR_VERSION = 'v2.sfc32.boxmuller.fixed80.1';

/** Source defaults, with the approved deterministic 80kg profile.
 * The source's automatic office distribution is resolved into an explicit list.
 */
export function createDefaultScenario(): ScenarioV2 {
  const lunchHours = [12, 13, 14];
  return {
    schemaVersion: '2', modelVersion: MODEL_VERSION, upperFloors: 15,
    cabins: Array.from({length:4},(_,id)=>({id,ratedLoadKg:1000,maxPeople:13})),
    physical: {floorHeightM:3.3,speedMps:2.5,accelerationMps2:1,doorBaseS:5.5,passengerTransferS:.8,
      passengerWeightKg:80,maxPlannedLoadFraction:.96},
    traffic: {arrivalMeanHour:7.88,arrivalSdMinutes:16,departureMeanHour:19.06,departureSdMinutes:17,
      lunchDurationMinutes:60,lunchSdMinutes:9,lunchStartHours:lunchHours,internalTripsProbability:.09},
    dispatch: {fairnessThresholdS:120,rideTimeFactor:.33,lateWaitFactor:.035,relocationIdleDelayS:35},
    learning: {habitSdMinutes:9,dailyJitterMinutes:2.5,priorEvents:22,priorWorkerDays:12,forecastHorizonMinutes:12,
      leadMinutes:3,reserveIdleCars:1,effectiveCapacityFraction:.82,minPredictedCalls:3,movementPenaltyPerS:.1,
      coveragePenalty:.1,maxGroupedCarsPerFloor:3},
    offices: [{id:'U12-FOCUS',floor:12,employees:65,lunchStartHour:13,lunchParticipation:.72},
      ...Array.from({length:29},(_,i)=>({id:`U${String(i+1).padStart(2,'0')}`,floor:i%15+1,
        employees:i<25?16:15,lunchStartHour:lunchHours[(i*7+i%15+1)%3],lunchParticipation:.72}))],
    seeds: {simulation:['101','202','303','404','505','606','707','808'],habits:'917',
      training:Array.from({length:12},(_,i)=>String(1101+i)),validation:Array.from({length:4},(_,i)=>String(2201+i))},
    startS:7*3600,endS:21*3600,fitTrainingDays:6,arrivalBinMinutes:10,chartBinMinutes:30,
    sourceOnlyMetadata: {sourceProfile:'original.numpy.variable-weight',historicalWeightMeanKg:76,
      historicalWeightSdKg:14,historicalWeightMinKg:48,historicalWeightMaxKg:115,historicalReserveKg:87,
      inactiveLunchStartProbabilities:[.35,.43,.22],defaultOfficesResolved:true},
  };
}
