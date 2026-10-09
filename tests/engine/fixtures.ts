import type { Dataset, OdRequest, ScenarioV2, SimulationContext } from '../../src/model/contracts';
import { deriveCapacities } from '../../src/model/physics';
import { canonicalStringify } from '../../src/model/reproducibility';

export function scenario(overrides: Partial<ScenarioV2> = {}): ScenarioV2 {
  return {
    schemaVersion: '2', modelVersion: 'fixed80-v2', upperFloors: 3,
    cabins: [{ id: 0, ratedLoadKg: 1000, maxPeople: 13 }],
    physical: { floorHeightM: 3, speedMps: 2, accelerationMps2: 1, doorBaseS: 4, passengerTransferS: 1, passengerWeightKg: 80, maxPlannedLoadFraction: .96 },
    traffic: { arrivalMeanHour: 8, arrivalSdMinutes: 10, departureMeanHour: 19, departureSdMinutes: 10, lunchDurationMinutes: 60, lunchSdMinutes: 9, lunchStartHours: [12,13,14], internalTripsProbability: .1 },
    dispatch: { fairnessThresholdS: 120, rideTimeFactor: .33, lateWaitFactor: .035, relocationIdleDelayS: 35 },
    learning: { habitSdMinutes: 9, dailyJitterMinutes: 2, priorEvents: 22, priorWorkerDays: 12, forecastHorizonMinutes: 12, leadMinutes: 3, reserveIdleCars: 1, effectiveCapacityFraction: .82, minPredictedCalls: 3, movementPenaltyPerS: .1, coveragePenalty: .1, maxGroupedCarsPerFloor: 3 },
    offices: [{ id: 'office', floor: 1, employees: 10, lunchStartHour: 12, lunchParticipation: .8 }],
    seeds: { simulation: ['1'], habits: '1', training: ['2'], validation: ['3'] },
    startS: 0, endS: 120, fitTrainingDays: 1, arrivalBinMinutes: 10, chartBinMinutes: 10, sourceOnlyMetadata: {}, ...overrides,
  };
}
export function request(id = 0, bornS = 0, origin = 0, destination = 1): OdRequest {
  return { id, bornS, origin, destination, weightKg: 80, officeId: 'office', tripType: 'internal' };
}
export function dataset(requests: readonly OdRequest[] = []): Dataset {
  return { requests, seed: 'test', generatorVersion: 'fixture-fixed80', datasetHash: 'fixture' };
}
export function context(s: ScenarioV2): SimulationContext {
  return { scenarioFingerprint: canonicalStringify(s), capacityByCar: deriveCapacities(s), officeModels: [] };
}
