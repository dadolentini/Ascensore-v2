import type { Dataset, ExperimentResult, Issue, PolicyId, PolicyResult, ScenarioV2, SimulationContext, TraceSelection, WorkerOut } from '../model/contracts';
import { GENERATOR_VERSION } from '../model/defaults';
import { validateScenario } from '../model/validate';
import { canonicalStringify, hashValue } from '../model/reproducibility';
import { generateDataset } from '../model/demand';
import { deriveCapacities } from '../model/physics';
import { estimateOfficeModels, officeHoldoutMae } from '../model/officeModel';
import { fitFlow } from '../model/flowFit';
import { simulate } from '../engine';

export const MANUAL_GENERATOR_VERSION = 'manual.fixed80.1';
export const RESOURCE_LIMITS = Object.freeze({ people: 5000, requestsPerDay: 25000, days: 64, estimatedCorpusRequests: 500000, runs: 192, fitBins: 20000 });
export type RunProgress = Omit<Extract<WorkerOut, { type: 'PROGRESS' }>, 'type' | 'jobId'>;
export class ExperimentError extends Error {
  constructor(readonly kind: Extract<WorkerOut, { type: 'ERROR' }>['kind'], readonly issues: readonly Issue[]) {
    super(issues.map(issue => issue.message).join(' ')); this.name = 'ExperimentError';
  }
}
function fail(kind: ExperimentError['kind'], code: string, path: string, message: string): never {
  throw new ExperimentError(kind, [{ code, path, message }]);
}
function scenarioInput(value: unknown): ScenarioV2 {
  const validated = validateScenario(value);
  if (!validated.ok) throw new ExperimentError('invalid', validated.issues);
  // Detach callers' drafts before the first async step. All later work uses this snapshot.
  return structuredClone(validated.scenario);
}
function resourceGuard(scenario: ScenarioV2, policies: readonly PolicyId[]): void {
  const people = scenario.offices.reduce((sum, office) => sum + office.employees, 0);
  if (people > RESOURCE_LIMITS.people) fail('unsupported', 'resource-population', 'offices', `Il budget del browser supporta al massimo ${RESOURCE_LIMITS.people} persone; la popolazione non viene ridotta.`);
  const calls = people * 5;
  if (calls > RESOURCE_LIMITS.requestsPerDay) fail('unsupported', 'resource-daily-calls', 'offices', 'Il limite conservativo di richieste per giornata è superato.');
  const days = scenario.seeds.simulation.length + scenario.seeds.training.length + scenario.seeds.validation.length;
  if (days > RESOURCE_LIMITS.days || calls * days > RESOURCE_LIMITS.estimatedCorpusRequests) fail('unsupported', 'resource-corpus', 'seeds', 'Il corpus richiesto supera il budget di memoria del browser. Nessun seed viene omesso.');
  if (scenario.seeds.simulation.length * policies.length > RESOURCE_LIMITS.runs) fail('unsupported', 'resource-runs', 'policies', 'Il numero di repliche richiesto supera il budget del browser.');
  if ((scenario.endS - scenario.startS) / (scenario.arrivalBinMinutes * 60) + 1 > RESOURCE_LIMITS.fitBins) fail('unsupported', 'resource-fit-bins', 'arrivalBinMinutes', 'La granularità del fit supera il budget di istogramma.');
}
function policyInput(value: unknown, traceFor: unknown, scenario: ScenarioV2): { policies: PolicyId[]; trace: TraceSelection } {
  if (!Array.isArray(value) || !value.length || value.some(p => !['fifo', 'optimal', 'adaptive'].includes(p)) || new Set(value).size !== value.length) fail('invalid', 'policy-selection', 'policies', 'Selezionare almeno una politica valida, senza duplicati.');
  const policies = [...value] as PolicyId[];
  if (traceFor !== null) {
    if (!traceFor || typeof traceFor !== 'object' || Array.isArray(traceFor)) fail('invalid', 'trace-selection', 'traceFor', 'Selezione della traccia non valida.');
    const selection = traceFor as Record<string, unknown>;
    if (Object.keys(selection).length !== 2 || !policies.includes(selection.policy as PolicyId) || !scenario.seeds.simulation.includes(selection.seed as string)) fail('invalid', 'trace-selection', 'traceFor', 'La traccia deve appartenere a una politica e un seed selezionati.');
    return { policies, trace: { policy: selection.policy as PolicyId, seed: selection.seed as string } };
  }
  return { policies, trace: null };
}

/** Verifies provenance and finite fixed80 request content before crossing into DES. */
async function verifyDataset(scenario: ScenarioV2, value: unknown, manual: boolean): Promise<Dataset> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid', 'dataset', 'dataset', 'Dataset richiesto.');
  const dataset = value as Dataset;
  const versions = manual ? [GENERATOR_VERSION, MANUAL_GENERATOR_VERSION] : [GENERATOR_VERSION];
  if (!versions.includes(dataset.generatorVersion)) fail('invalid', 'dataset-version', 'dataset.generatorVersion', 'Versione del generatore non supportata.');
  if (typeof dataset.seed !== 'string' || !/^(0|[1-9][0-9]*)$/.test(dataset.seed) || dataset.seed.length > 20 || BigInt(dataset.seed) > 18446744073709551615n) fail('invalid', 'dataset-seed', 'dataset.seed', 'Seed uint64 canonico richiesto.');
  if (!Array.isArray(dataset.requests)) fail('invalid', 'dataset-requests', 'dataset.requests', 'Lista di richieste richiesta.');
  if (dataset.requests.length > (manual ? 4 : RESOURCE_LIMITS.requestsPerDay)) fail('unsupported', 'resource-requests', 'dataset.requests', manual ? 'Il caso didattico supporta al massimo quattro richieste.' : 'Il dataset supera il budget del browser.');
  const ids = new Set<number>();
  const offices = new Set(scenario.offices.map(o => o.id));
  let previousTime = -Infinity, previousId = -1;
  for (const r of dataset.requests) {
    if (!r || typeof r !== 'object' || !Number.isSafeInteger(r.id) || r.id < 0 || ids.has(r.id)) fail('invalid', 'request-id', 'dataset.requests', 'Ogni richiesta richiede un ID intero non negativo e univoco.');
    ids.add(r.id);
    if (r.weightKg !== 80) fail('invalid', 'request-weight', 'dataset.requests', 'Ogni richiesta deve avere massa deterministica di 80 kg.');
    if (!Number.isFinite(r.bornS) || r.bornS < scenario.startS || r.bornS > scenario.endS) fail('invalid', 'request-time', 'dataset.requests', 'Il tempo della richiesta deve appartenere all’orizzonte finito.');
    if (!Number.isSafeInteger(r.origin) || !Number.isSafeInteger(r.destination) || r.origin < 0 || r.destination < 0 || r.origin > scenario.upperFloors || r.destination > scenario.upperFloors || r.origin === r.destination) fail('invalid', 'request-floors', 'dataset.requests', 'Origine e destinazione devono essere livelli distinti in 0..N.');
    if (!offices.has(r.officeId) || !['arrival', 'departure', 'lunch_exit', 'lunch_return', 'internal'].includes(r.tripType)) fail('invalid', 'request-provenance', 'dataset.requests', 'Ufficio o tipo di viaggio non valido.');
    if (r.bornS < previousTime || r.bornS === previousTime && r.id <= previousId) fail('invalid', 'request-order', 'dataset.requests', 'Le richieste devono essere ordinate stabilmente per tempo e ID.');
    previousTime = r.bornS; previousId = r.id;
  }
  let computed: string;
  try { computed = await hashValue({ generatorVersion: dataset.generatorVersion, seed: dataset.seed, requests: dataset.requests }); }
  catch { fail('invalid', 'dataset-json', 'dataset', 'Il dataset deve contenere soltanto valori JSON finiti.'); }
  if (dataset.datasetHash !== computed) fail('invalid', 'dataset-hash', 'dataset.datasetHash', 'L’hash del dataset non corrisponde alle richieste.');
  return dataset;
}

function diagnostics(scenario: ScenarioV2, results: readonly PolicyResult[]): Issue[] {
  const capacities = deriveCapacities(scenario), issues: Issue[] = [];
  for (const c of capacities) {
    if (c.physicalPeople === 0) issues.push({ code: 'physical-zero-capacity', path: `cabins[${scenario.cabins.findIndex(car => car.id === c.carId)}]`, message: `La cabina ${c.carId} non può trasportare fisicamente una persona di 80 kg.`, details: { carId: c.carId } });
    else if (c.plannedPeople === 0) issues.push({ code: 'planned-zero-capacity', path: `cabins[${scenario.cabins.findIndex(car => car.id === c.carId)}]`, message: `La cabina ${c.carId} può trasportare 80 kg, ma la capienza prudente con ρ=0,96 è zero.`, details: { carId: c.carId } });
  }
  for (const result of results) if (result.kpis.unfinished > 0) {
    const noPlannedCapacity = capacities.every(c => c.plannedPeople === 0);
    issues.push({ code: noPlannedCapacity ? 'unserved-planned-capacity' : 'unserved-horizon', path: `results.${result.policy}.${result.seed}`, message: noPlannedCapacity ? 'Le richieste restano incomplete perché tutte le capienze di pianificazione sono zero.' : 'Le richieste in attesa o a bordo al termine dell’orizzonte restano incomplete; il motore non svuota la coda dopo la fine.', details: { waiting: result.kpis.waiting, onboard: result.kpis.onboard, unfinished: result.kpis.unfinished } });
  }
  return issues;
}
const metricPopulations: ExperimentResult['metricPopulations'] = { passenger: 'completed', fleet: 'processed-events', servedPctDenominator: 'generated', waitOver120PctDenominator: 'completed' };

export async function runExperiment(value: ScenarioV2, policyValues: readonly PolicyId[], traceFor: TraceSelection, onProgress?: (progress: RunProgress) => void): Promise<ExperimentResult> {
  const scenario = scenarioInput(value);
  const { policies, trace } = policyInput(policyValues, traceFor, scenario);
  resourceGuard(scenario, policies);
  onProgress?.({ phase: 'training', processedEvents: 0 });
  const corpus = async (seeds: readonly string[]) => {
    const datasets: Dataset[] = [];
    for (const seed of seeds) datasets.push(await verifyDataset(scenario, await generateDataset(scenario, seed), false));
    return datasets;
  };
  const training = await corpus(scenario.seeds.training), holdout = await corpus(scenario.seeds.validation);
  const officeEstimates = estimateOfficeModels(scenario, training);
  const officeMae = officeHoldoutMae(officeEstimates, holdout);
  const datasets = await corpus(scenario.seeds.simulation);
  const context: SimulationContext = { scenarioFingerprint: canonicalStringify(scenario), capacityByCar: deriveCapacities(scenario), officeModels: officeEstimates };
  onProgress?.({ phase: 'fitting', processedEvents: 0 });
  const fit = fitFlow(scenario, datasets);
  const issues: Issue[] = [];
  if (!fit) issues.push({ code: datasets.length < 2 ? 'fit-undersampled' : 'fit-unavailable', path: 'flowFit', message: 'Il fit del flusso richiede giornate di controllo distinte per training e holdout e basi gaussiane non degeneri; il diagnostico resta nullo.' });
  if (!holdout.length) issues.push({ code: 'office-holdout-unavailable', path: 'officeHoldoutMae', message: 'Il corpus di holdout degli uffici è vuoto; la MAE non è disponibile.' });
  const results: PolicyResult[] = [], totalRuns = datasets.length * policies.length;
  onProgress?.({ phase: 'simulation', processedEvents: 0, completedRuns: 0, totalRuns });
  for (const dataset of datasets) for (const policy of policies) {
    results.push(simulate(scenario, dataset, policy, context, trace?.seed === dataset.seed && trace.policy === policy));
    onProgress?.({ phase: 'simulation', processedEvents: 0, completedRuns: results.length, totalRuns });
  }
  return { scenario, datasets, results, metricPopulations: { ...metricPopulations }, flowFit: fit, officeEstimates, officeHoldoutMae: officeMae, diagnosticsIssues: [...issues, ...diagnostics(scenario, results)] };
}

export async function runExplanation(value: ScenarioV2, datasetValue: Dataset): Promise<ExperimentResult> {
  const scenario = scenarioInput(value);
  const dataset = await verifyDataset(scenario, structuredClone(datasetValue), true);
  if (dataset.seed !== scenario.seeds.simulation[0]) fail('invalid', 'explanation-seed', 'dataset.seed', 'Il caso didattico deve usare il primo seed di controllo dello scenario.');
  const context: SimulationContext = { scenarioFingerprint: canonicalStringify(scenario), capacityByCar: deriveCapacities(scenario), officeModels: [] };
  const results = [simulate(scenario, dataset, 'optimal', context, true)];
  return { scenario, datasets: [dataset], results, metricPopulations: { ...metricPopulations }, flowFit: null, officeEstimates: [], officeHoldoutMae: null, diagnosticsIssues: diagnostics(scenario, results) };
}
