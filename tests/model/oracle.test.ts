import { describe,it,expect } from 'vitest';
import oracle from '../oracle/fixture-numeriche.json';
import type {Dataset,OfficeEstimate} from '../../src/model/contracts';
import { createDefaultScenario } from '../../src/model/defaults';
import { travelSeconds,deriveCapacities } from '../../src/model/physics';
import { normalCdf,quantile,pairedConfidenceInterval,nnls,mean } from '../../src/model/numerics';
import { estimateOfficeModels,floorDemand } from '../../src/model/officeModel';

const {originalInvariant:original,approvedFixed80Extension:fixed,recommendedAbsoluteTolerances:tol}=oracle;
const near=(actual:number|null|undefined,expected:number,tolerance:number)=>{
  expect(typeof actual).toBe('number'); expect(Math.abs(actual!-expected)).toBeLessThanOrEqual(tolerance);
};
describe('offline Python / NumPy / SciPy oracle on shared numerical inputs',()=>{
  it('nontrivial NNLS matches SciPy with active nonnegativity and nonzero residual',()=>{
    const c=original.nnlsGaussianCase;
    const coefficients=nnls(c.A,c.bTrainMeanRequestsPerMinute);
    coefficients.forEach((x,i)=>near(x,c.expectedCoefficients[i],1e-8));
    expect(coefficients[1]).toBe(0);
    const predicted=c.A.map(row=>row.reduce((sum,x,i)=>sum+x*coefficients[i],0));
    predicted.forEach((x,i)=>near(x,c.expectedPredictedRequestsPerMinute[i],1e-8));
    near(Math.hypot(...predicted.map((x,i)=>x-c.bTrainMeanRequestsPerMinute[i])),c.expectedResidualL2,1e-8);
    near(mean(predicted.map((x,i)=>Math.abs(x-c.holdoutMeanRequestsPerMinute[i]))),c.expectedMaeRequestsPerMinute,1e-8);
    const average=mean(c.holdoutMeanRequestsPerMinute)!;
    const r2=1-predicted.reduce((sum,x,i)=>sum+(x-c.holdoutMeanRequestsPerMinute[i])**2,0)/c.holdoutMeanRequestsPerMinute.reduce((sum,x)=>sum+(x-average)**2,0);
    near(r2,c.expectedR2,1e-8);
  });
  it.each(original.travel)('travel $id',c=>{
    const p={...createDefaultScenario().physical,floorHeightM:c.floorHeightM,speedMps:c.speedMps,accelerationMps2:c.accelerationMps2};
    near(travelSeconds(c.fromFloor,c.toFloor,p),c.expectedSeconds,tol.travelSeconds);
  });
  it.each(original.normalCdf)('normal CDF z=$z',c=>near(normalCdf(c.z),c.expected,tol.normalCdf));
  it.each(original.linearQuantile)('linear quantile p=$probability for $values',c=>near(quantile(c.values,c.probability),c.expected,tol.linearQuantile));
  it.each(original.studentQuantile.filter(c=>c.probability===.975))('Student .975 df=$degreesOfFreedom',c=>{
    // For arbitrary paired sample, recover t from CI width / standard error.
    const n=c.degreesOfFreedom+1,a=Array.from({length:n},(_,i)=>i),b=Array(n).fill(0),m=(n-1)/2;
    const sd=Math.sqrt(a.reduce((sum,x)=>sum+(x-m)**2,0)/(n-1));
    const ci=pairedConfidenceInterval(a,b)!;
    near((ci.upper-ci.mean)/(sd/Math.sqrt(n)),c.expected,tol.studentQuantile);
  });
  it('paired CI agrees with SciPy Student and NumPy ddof1',()=>{
    const c=original.pairedStudentInterval,ci=pairedConfidenceInterval(c.differencesSeconds,c.differencesSeconds.map(()=>0))!;
    near(ci.mean,c.meanSeconds,1e-12);near(ci.lower,c.ci95Seconds[0],tol.studentQuantile);near(ci.upper,c.ci95Seconds[1],tol.studentQuantile);
  });
  it('fits office shrinkage using the identical four-event training corpus',()=>{
    const c=original.shrinkage,s=createDefaultScenario();
    s.offices=[{id:c.office.id,floor:c.office.floor,employees:c.office.employees,lunchStartHour:c.office.scheduledHour,lunchParticipation:c.office.participationPrior}];
    s.learning.priorEvents=c.priorEvents;s.learning.priorWorkerDays=c.priorWorkerDays;s.traffic.lunchSdMinutes=c.priorSigmaMinutes;
    const days:Dataset[]=c.trainingTimesHour.map((times,day)=>({generatorVersion:'oracle',seed:String(day),datasetHash:'shared-corpus',
      requests:times.map((h,id)=>({id,officeId:c.office.id,bornS:h*3600,origin:1,destination:0,weightKg:80,tripType:'lunch_exit'}))}));
    const model=estimateOfficeModels(s,days)[0],empty=estimateOfficeModels(s,days.map(d=>({...d,requests:[]})))[0];
    for(const [actual,expected] of [[model,c.expectedModel],[empty,c.emptyTwoDayTrainingExpectedModel]] as const) {
      near(actual.learnedLunchHour,expected.estimated_hour,tol.shrinkage);
      near(actual.learnedSdMinutes/60,expected.estimated_sigma_hours,tol.shrinkage);
      near(actual.learnedParticipation,expected.estimated_participation,tol.shrinkage);
    }
  });
  it.each(original.forecast.floorCases)('floor forecast at $nowSeconds seconds',c=>{
    const m=original.forecast.model,s=createDefaultScenario();
    const models:OfficeEstimate[]=[{officeId:m.id,floor:m.floor,employees:m.employees,learnedLunchHour:m.estimated_hour,
      learnedSdMinutes:m.estimated_sigma_hours*60,learnedParticipation:m.estimated_participation}];
    const result=floorDemand(models,s,c.nowSeconds);
    for(const [floor,count] of Object.entries(c.expectedByFloor)) near(result[Number(floor)],count,tol.forecastCalls);
  });
  it.each(fixed.capacityCases)('individual capacity Q=$ratedLoadKg C=$maxPeople',c=>{
    const s=createDefaultScenario();s.cabins=[{id:0,ratedLoadKg:c.ratedLoadKg,maxPeople:c.maxPeople}];
    const capacity=deriveCapacities(s)[0];expect(capacity.physicalPeople).toBe(c.expectedRealPeople);
    expect(capacity.plannedPeople).toBe(c.expectedPlannedPeople);near(capacity.effectiveCoverage,c.expectedCoverageCalls,1e-12);
  });
});
