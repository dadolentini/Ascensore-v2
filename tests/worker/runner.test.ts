import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dataset, OdRequest, ScenarioV2 } from '../../src/model/contracts';
import * as engine from '../../src/engine';
import { SimulationError } from '../../src/engine';
import { createDefaultScenario } from '../../src/model/defaults';
import { hashValue } from '../../src/model/reproducibility';
import { generateDataset } from '../../src/model/demand';
import { fitFlow } from '../../src/model/flowFit';
import { runExperiment, runExplanation } from '../../src/worker/runner';

afterEach(() => vi.restoreAllMocks());

function smallScenario(): ScenarioV2 {
  const s = createDefaultScenario();
  s.upperFloors = 3;
  s.offices = [{ id: 'office', floor: 2, employees: 2, lunchStartHour: 13, lunchParticipation: 1 }];
  s.cabins = [{ id: 0, ratedLoadKg: 640, maxPeople: 8 }];
  s.seeds = { habits: '900', simulation: ['1', '2'], training: ['3', '4'], validation: ['5'] };
  s.fitTrainingDays = 2;
  return s;
}
async function customDataset(requests: readonly OdRequest[]): Promise<Dataset> {
  const content = { generatorVersion: 'manual.fixed80.1', seed: '1', requests };
  return { ...content, datasetHash: await hashValue(content) };
}

describe('shared experimental pipeline', () => {
  it('compares all policies on the same hashed corpus and enables only selected trace', async () => {
    const s = smallScenario();
    const progress: unknown[] = [];
    const experiment = await runExperiment(s, ['fifo', 'optimal', 'adaptive'], { policy: 'optimal', seed: '2' }, p => progress.push(p));
    expect(experiment.datasets.map(d => d.seed)).toEqual(['1', '2']);
    expect(experiment.results).toHaveLength(6);
    for (const dataset of experiment.datasets) {
      expect(dataset).toEqual(await generateDataset(s, dataset.seed));
      const runs = experiment.results.filter(r => r.seed === dataset.seed);
      expect(new Set(runs.map(r => r.datasetHash))).toEqual(new Set([dataset.datasetHash]));
      for (const run of runs) expect(run.outcomes.map(({ pickupS: _, finishS: __, state: ___, assignedCarId: ____, ...r }) => r)).toEqual(dataset.requests);
    }
    const traced = experiment.results.filter(r => r.trace !== null);
    expect(traced.map(r => [r.policy, r.seed])).toEqual([['optimal', '2']]);
    expect(experiment.flowFit).toEqual(fitFlow(s,experiment.datasets));
    const fittedScenario = { ...s, fitTrainingDays: 1 };
    const fitted = await runExperiment(fittedScenario, ['fifo'], null);
    expect(fitted.flowFit).toEqual(fitFlow(fittedScenario, fitted.datasets));
    expect(progress.at(-1)).toMatchObject({ phase: 'simulation', completedRuns: 6, totalRuns: 6, processedEvents: 0 });
    expect(s).toEqual(smallScenario());
  });

  it.each([{policies:[]}, {policies:['fifo','fifo']}, {policies:['alien']}])('rejects invalid policy selections $policies', async ({policies}) => {
    await expect(runExperiment(smallScenario(), policies as never, null)).rejects.toMatchObject({ kind: 'invalid' });
  });
  it('rejects malformed scenario and invalid trace selection', async () => {
    await expect(runExperiment(null as never, ['fifo'], null)).rejects.toMatchObject({ kind: 'invalid' });
    await expect(runExperiment(smallScenario(), ['fifo'], { policy: 'optimal', seed: '1' })).rejects.toMatchObject({ kind: 'invalid' });
    await expect(runExperiment(smallScenario(), ['fifo'], { policy: 'fifo', seed: '100' })).rejects.toMatchObject({ kind: 'invalid' });
  });
  it('rejects resource budgets before generating large populations', async () => {
    const s = smallScenario(); s.offices = [{ ...s.offices[0], employees: 5001 }];
    await expect(runExperiment(s, ['fifo'], null)).rejects.toMatchObject({ kind: 'unsupported', issues: [expect.objectContaining({ code: 'resource-population' })] });
  });
  it('reports undersampled fit and distinguishes physical from conservative zero capacity', async () => {
    const s = smallScenario(); s.seeds.validation = []; s.seeds.simulation=['1'];
    s.cabins = [{ id: 0, ratedLoadKg: 79, maxPeople: 1 }, { id: 1, ratedLoadKg: 80, maxPeople: 1 }];
    const experiment = await runExperiment(s, ['fifo'], null);
    expect(experiment.flowFit).toBeNull();
    expect(experiment.officeHoldoutMae).toBeNull();
    expect(experiment.results.every(r => r.kpis.completed === 0 && r.kpis.meanWaitS === null)).toBe(true);
    expect(experiment.diagnosticsIssues.map(i => i.code)).toEqual(expect.arrayContaining(['fit-undersampled', 'physical-zero-capacity', 'planned-zero-capacity', 'unserved-planned-capacity']));
  });
});

describe('small explanatory trace', () => {
  it('runs only optimal on custom immutable demand without learned or fitted models', async () => {
    const s = smallScenario(); s.startS = 0; s.endS = 120;
    const dataset = await customDataset([{ id: 0, officeId: 'office', bornS: 1, origin: 0, destination: 2, weightKg: 80, tripType: 'arrival' }]);
    const experiment = await runExplanation(s, dataset);
    expect(experiment.datasets).toEqual([dataset]);
    expect(experiment.results.map(r => r.policy)).toEqual(['optimal']);
    expect(experiment.results[0].trace?.some(e => e.kind === 'DROP')).toBe(true);
    expect(experiment.officeEstimates).toEqual([]);
    expect(experiment.flowFit).toBeNull();
  });
  it('checks hash, fixed mass, times, IDs and mini-case request count before simulation', async () => {
    const s = smallScenario();
    const request: OdRequest = { id: 0, officeId: 'office', bornS: s.startS + 1, origin: 0, destination: 2, weightKg: 80, tripType: 'arrival' };
    const good = await customDataset([request]);
    await expect(runExplanation(s, { ...good, datasetHash: 'forged' })).rejects.toMatchObject({ kind: 'invalid' });
    for (const r of [{ ...request, weightKg: 79 }, { ...request, bornS: -1 }, { ...request, id: -1 }, { ...request, origin: 0, destination: 0 }]) {
      await expect(runExplanation(s, await customDataset([r as OdRequest]))).rejects.toMatchObject({ kind: 'invalid' });
    }
    await expect(runExplanation(s, await customDataset(Array.from({ length: 5 }, (_, id) => ({ ...request, id }))))).rejects.toMatchObject({ kind: 'unsupported' });
  });
});

describe('selected recording memory budget', () => {
  it('recalculates only the selected run without recording and preserves the complete experiment', async () => {
    const s = smallScenario();
    const policies = ['fifo', 'optimal', 'adaptive'] as const;
    const baseline = await runExperiment(s, policies, null);
    const original = engine.simulate;
    const calls = vi.spyOn(engine, 'simulate').mockImplementation((...args) => {
      const result = original(...args);
      if (args[4]) throw new SimulationError('unsupported', 'resource-trace', 'Trace memory limit exceeded', 'trace');
      return result;
    });
    const progress: unknown[] = [];
    const recovered = await runExperiment(s, policies, { policy: 'optimal', seed: '2' }, update => progress.push(update));

    expect(calls).toHaveBeenCalledTimes(7);
    const tracedIndex = calls.mock.calls.findIndex(args => args[4]);
    expect(tracedIndex).toBe(4);
    const recorded = calls.mock.calls[tracedIndex], repeated = calls.mock.calls[tracedIndex + 1];
    for (let index = 0; index < 4; index++) expect(repeated[index]).toBe(recorded[index]);
    expect(repeated[4]).toBe(false);
    expect(recovered.results).toStrictEqual(baseline.results);
    expect(recovered.datasets).toStrictEqual(baseline.datasets);
    expect(recovered.results.every(result => result.trace === null && result.initialSnapshot === null)).toBe(true);
    expect(recovered).toStrictEqual({ ...baseline, diagnosticsIssues: [...baseline.diagnosticsIssues, expect.objectContaining({ code: 'trace-unavailable', path: 'results.optimal.2.trace', details: { policy: 'optimal', seed: '2', reason: 'resource-trace' } })] });
    expect(progress).toEqual(expect.arrayContaining([expect.objectContaining({ phase: 'simulation', completedRuns: 4, totalRuns: 6, policy: 'optimal', seed: '2', recordingUnavailable: true, processedEvents: 0, simulationTimeS: s.startS })]));
    expect(progress.at(-1)).toMatchObject({ completedRuns: 6, totalRuns: 6 });
  });

  it.each([
    { name: 'event budget', error: new SimulationError('unsupported', 'resource-events', 'Event limit exceeded') },
    { name: 'invalid input', error: new SimulationError('invalid', 'resource-trace', 'Invalid trace input') },
    { name: 'numerical failure', error: new SimulationError('numerical', 'resource-trace', 'Numerical failure') },
    { name: 'internal failure', error: new Error('Internal failure') },
    { name: 'untyped trace error', error: { kind: 'unsupported', issues: [{ code: 'resource-trace' }] } },
  ])('propagates $name without retrying or returning partial results', async ({ error }) => {
    const calls = vi.spyOn(engine, 'simulate').mockImplementation(() => { throw error; });
    await expect(runExperiment(smallScenario(), ['fifo'], { policy: 'fifo', seed: '1' })).rejects.toBe(error);
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('does not retry a trace budget error when recording was not requested for that run', async () => {
    const error = new SimulationError('unsupported', 'resource-trace', 'Unexpected trace failure', 'trace');
    const calls = vi.spyOn(engine, 'simulate').mockImplementation(() => { throw error; });
    await expect(runExperiment(smallScenario(), ['fifo', 'optimal'], { policy: 'optimal', seed: '2' })).rejects.toBe(error);
    expect(calls).toHaveBeenCalledTimes(1);
    expect(calls.mock.calls[0][4]).toBe(false);
  });

  it('recovers the real recording limit for thirty floors and eighteen hundred people', async () => {
    const s = createDefaultScenario();
    s.upperFloors = 30;
    s.offices = Array.from({ length: 90 }, (_, index) => ({ id: `U${index + 1}`, floor: Math.floor(index / 3) + 1, employees: 20, lunchStartHour: [12, 13, 14][index % 3], lunchParticipation: 1 }));
    s.seeds.simulation = ['101'];
    s.fitTrainingDays = 1;
    const baseline = await runExperiment(s, ['adaptive'], null);
    const recovered = await runExperiment(s, ['adaptive'], { policy: 'adaptive', seed: '101' });
    expect(recovered.results).toStrictEqual(baseline.results);
    expect(recovered.datasets).toStrictEqual(baseline.datasets);
    expect(recovered.results).toHaveLength(1);
    const result = recovered.results[0];
    expect(result.trace).toBeNull();
    expect(result.initialSnapshot).toBeNull();
    expect(result.kpis.generated).toBe(result.kpis.completed + result.kpis.waiting + result.kpis.onboard);
    expect(result.outcomes).toHaveLength(recovered.datasets[0].requests.length);
    expect(recovered.diagnosticsIssues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'trace-unavailable', details: { policy: 'adaptive', seed: '101', reason: 'resource-trace' } })]));
  });
});
