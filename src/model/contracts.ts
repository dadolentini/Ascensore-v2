export type PolicyId = 'fifo' | 'optimal' | 'adaptive';
export type Seconds = number; type Floor = number; type Seed = string;
export type JsonValue = string|number|boolean|null|readonly JsonValue[]|{readonly [key: string]: JsonValue};
export type TripType = 'arrival' | 'departure' | 'lunch_exit' | 'lunch_return' | 'internal';
export interface Office { id: string; floor: Floor; employees: number; lunchStartHour: number; lunchParticipation: number; }
export interface Cabin { id: number; ratedLoadKg: number; maxPeople: number; }
export interface Physical { floorHeightM: number; speedMps: number; accelerationMps2: number;
  doorBaseS: Seconds; passengerTransferS: Seconds; passengerWeightKg: 80; maxPlannedLoadFraction: 0.96; }
export interface Traffic { arrivalMeanHour: number; arrivalSdMinutes: number; departureMeanHour: number; departureSdMinutes: number;
  lunchDurationMinutes: number; lunchSdMinutes: number; lunchStartHours: readonly number[]; internalTripsProbability: number; }
export interface Dispatch { fairnessThresholdS: Seconds; rideTimeFactor: number; lateWaitFactor: number; relocationIdleDelayS: 35; }
export interface Learning { habitSdMinutes: number; dailyJitterMinutes: number; priorEvents: number; priorWorkerDays: number; forecastHorizonMinutes: 12;
  leadMinutes: number; reserveIdleCars: 1; effectiveCapacityFraction: 0.82; minPredictedCalls: number; movementPenaltyPerS: number;
  coveragePenalty: number; maxGroupedCarsPerFloor: 3; }
export interface SeedPlan { simulation: readonly Seed[]; habits: Seed; training: readonly Seed[]; validation: readonly Seed[]; }
export interface ScenarioV2 { schemaVersion: '2'; modelVersion: string; upperFloors: Floor; cabins: readonly Cabin[]; physical: Physical; traffic: Traffic;
  dispatch: Dispatch; learning: Learning; offices: readonly Office[]; seeds: SeedPlan; startS: Seconds; endS: Seconds;
  fitTrainingDays: number; arrivalBinMinutes: number; chartBinMinutes: number; sourceOnlyMetadata: Readonly<Record<string, JsonValue>>; }
export interface OdRequest { id: number; officeId: string; bornS: Seconds; origin: Floor; destination: Floor; weightKg: 80; tripType: TripType; }
export interface RequestOutcome extends OdRequest { pickupS: Seconds|null; finishS: Seconds|null; state: 'WAIT'|'ONBOARD'|'DONE'; assignedCarId: number|null; }
export interface Dataset { generatorVersion: string; seed: Seed; datasetHash: string; requests: readonly OdRequest[]; }
export interface CarSnapshot { id: number; floor: Floor; nextFloor: Floor|null; mode: 'idle'|'moving'|'dwelling'; onboardIds: readonly number[]; actualWeightKg: number; departureS: Seconds|null; arrivalS: Seconds|null; eventVersion: number; }
export interface ReplaySnapshot { timeS: Seconds; cars: readonly CarSnapshot[]; requests: readonly RequestOutcome[]; }
export interface TraceLink { equationId: string; symbolValues: Readonly<Record<string, number>>; codeRef: string; outputField: string; }
export interface TraceEvent { sequence: number; timeS: Seconds; heapOrder?: number; eventVersion?: number; kind: 'NEW'|'ARRIVE'|'DOOR'|'PARK'|'DEPART'|'ASSIGN'|'PICKUP'|'DROP'|'RETRY'|'KEEP';
  carId?: number; requestId?: number; fromFloor?: Floor; toFloor?: Floor; departureS?: Seconds; arrivalS?: Seconds; carChanges: readonly CarSnapshot[]; requestChanges: readonly RequestOutcome[]; links: readonly TraceLink[]; }
export interface Kpis { generated: number; pickedUp: number; completed: number; waiting: number; onboard: number; unfinished: number; servedPct: number; meanWaitS: number|null;
  medianWaitS: number|null; p90WaitS: number|null; p95WaitS: number|null; waitOver120Pct: number|null; meanRideS: number|null; meanJourneyS: number|null;
  bypasses: number; distanceFloors: number; parkingFloors: number; doorStops: number; adaptiveParkingDecisions: number; maxGroupedSameFloor: number; }
export interface PolicyResult { policy: PolicyId; seed: Seed; datasetHash: string; modelVersion: string; kpis: Kpis; outcomes: readonly RequestOutcome[]; initialSnapshot: ReplaySnapshot|null; trace: readonly TraceEvent[]|null; }
export interface FlowFit { coefficients: readonly number[]; centersHour: readonly number[]; sigmasHour: readonly number[]; binEdgesHour: readonly number[];
  unit: 'requests/min'; trainMean: readonly number[]; holdoutMean: readonly number[]; predicted: readonly number[]; mae: number|null; r2: number|null; }
export interface OfficeEstimate { officeId: string; floor: Floor; employees: number; learnedLunchHour: number; learnedSdMinutes: number; learnedParticipation: number; }
export interface CabinCapacity { carId: number; physicalPeople: number; plannedPeople: number; effectiveCoverage: number; }
export interface SimulationContext { scenarioFingerprint: string; officeModels: readonly OfficeEstimate[]; capacityByCar: readonly CabinCapacity[]; }
export interface ExperimentResult { scenario: ScenarioV2; datasets: readonly Dataset[]; results: readonly PolicyResult[]; metricPopulations: { passenger: 'completed'; fleet: 'processed-events'; servedPctDenominator: 'generated'; waitOver120PctDenominator: 'completed' };
  flowFit: Readonly<Record<'up'|'down', FlowFit>>|null; officeEstimates: readonly OfficeEstimate[]; officeHoldoutMae: number|null; diagnosticsIssues: readonly Issue[]; }
export type Issue = { code: string; path: string; message: string; details?: Readonly<Record<string, string|number>> };
export type TraceSelection = { policy: PolicyId; seed: Seed } | null;
export type WorkerIn = { type: 'RUN'; jobId: string; scenario: ScenarioV2; policies: readonly PolicyId[]; traceFor: TraceSelection }
  | { type: 'EXPLAIN'; jobId: string; scenario: ScenarioV2; dataset: Dataset }
  | { type: 'CANCEL'; jobId: string };
export type WorkerOut = { type: 'PROGRESS'; jobId: string; phase: 'training'|'fitting'|'simulation'; timeS?: Seconds; processedEvents: number; completedRuns?: number; totalRuns?: number }
  | { type: 'DONE'; jobId: string; experiment: ExperimentResult } | { type: 'CANCELLED'; jobId: string }
  | { type: 'ERROR'; jobId: string; kind: 'invalid'|'unsupported'|'numerical'|'internal'; issues: readonly Issue[] };
