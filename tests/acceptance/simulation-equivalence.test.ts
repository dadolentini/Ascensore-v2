import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { simulate } from '../../src/engine';
import * as engine from '../../src/engine';
import { SimulationError } from '../../src/engine/errors';
import type { Dataset, PolicyId, PolicyResult, ScenarioV2, SimulationContext } from '../../src/model/contracts';
import { generateDataset } from '../../src/model/demand';
import { canonicalStringify } from '../../src/model/reproducibility';
import { runExperiment } from '../../src/worker/runner';

interface OriginalFixture {
  name: string;
  coverage: string[];
  scenario: ScenarioV2;
  dataset: Dataset;
  context: SimulationContext;
  results: PolicyResult[];
}
interface OriginalCorpus {
  formatVersion: number;
  policies: PolicyId[];
  fixtures: OriginalFixture[];
}

// The complete expected results were computed from an immutable pre-change source
// snapshot. Loading this test never regenerates an expectation from current code.
const fixtureRoot = new URL('../oracle/simulation-equivalence/', import.meta.url);
const compressed = readFileSync(new URL('original-results.json.gz', fixtureRoot));
const payload = gunzipSync(compressed);
const corpus = JSON.parse(payload.toString('utf8')) as OriginalCorpus;
const provenance = JSON.parse(readFileSync(new URL('provenance.json', fixtureRoot), 'utf8')) as {
  compressedPayloadSha256: string;
  decompressedPayloadSha256: string;
  fixtureCount: number;
  resultCount: number;
  originalSourceFiles: Record<string, string>;
};
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const cases = corpus.fixtures.flatMap(fixture => fixture.results.map(expected => ({
  name: fixture.name,
  policy: expected.policy,
  fixture,
  expected,
})));

describe('exact equivalence to the frozen pre-optimization fixed80 V2 engine', () => {
  it('verifies original fixture integrity and meaningful queue/boundary coverage', () => {
    expect(sha256(compressed)).toBe(provenance.compressedPayloadSha256);
    expect(sha256(payload)).toBe(provenance.decompressedPayloadSha256);
    expect(corpus.formatVersion).toBe(1);
    expect(corpus.policies).toEqual(['fifo', 'optimal', 'adaptive']);
    expect(corpus.fixtures).toHaveLength(provenance.fixtureCount);
    expect(cases).toHaveLength(provenance.resultCount);
    expect(provenance.originalSourceFiles['engine/simulator.ts']).toMatch(/^[a-f0-9]{64}$/);
    expect(provenance.originalSourceFiles['engine/routing.ts']).toMatch(/^[a-f0-9]{64}$/);

    for (const geometry of ['1/1', '1/50', '8/1', '8/50']) {
      const fixture = corpus.fixtures.find(({ name, scenario }) => name.startsWith('queued-')
        && `${scenario.cabins.length}/${scenario.upperFloors}` === geometry)!;
      expect(fixture, geometry).toBeDefined();
      for (const result of fixture.results) {
        expect(result.trace!.some(event => event.kind === 'RETRY'), `${geometry}/${result.policy}`).toBe(true);
        expect(result.kpis.unfinished).toBeGreaterThan(0);
      }
    }

    const zero = corpus.fixtures.find(fixture => fixture.name === 'all-zero-planned-capacity')!;
    expect(zero.context.capacityByCar.every(capacity => capacity.physicalPeople === 1 && capacity.plannedPeople === 0)).toBe(true);
    for (const result of zero.results) {
      expect(result.kpis.completed).toBe(0);
      expect(result.kpis.waiting).toBe(zero.dataset.requests.length);
      expect(result.kpis.meanWaitS).toBeNull();
      expect(result.kpis.meanRideS).toBeNull();
      expect(result.kpis.meanJourneyS).toBeNull();
      expect(result.trace!.every(event => event.kind === 'NEW')).toBe(true);
    }

    const parking = corpus.fixtures.find(fixture => fixture.name === 'parking-followed-by-queued-real-demand')!;
    expect(parking.results.find(result => result.policy === 'adaptive')!.kpis.adaptiveParkingDecisions).toBeGreaterThan(0);
    const boundary = corpus.fixtures.find(fixture => fixture.name === 'event-ties-and-exact-horizon')!;
    expect(boundary.results.every(result => result.trace!.some(event => event.kind === 'NEW' && event.timeS === boundary.scenario.endS))).toBe(true);
  });

  it.each(cases)('$name / $policy: preserves every output field and complete trace exactly', ({ fixture, expected }) => {
    expect(canonicalStringify(fixture.scenario)).toBe(fixture.context.scenarioFingerprint);
    const actual = simulate(fixture.scenario, fixture.dataset, expected.policy, fixture.context, true);
    // JSON normalization only removes optional properties whose value is undefined,
    // as the saved/exported original result does. No rounding or field omission.
    expect(JSON.parse(JSON.stringify(actual))).toStrictEqual(expected);

    expect(actual.kpis.completed + actual.kpis.waiting + actual.kpis.onboard).toBe(actual.kpis.generated);
    expect(actual.kpis.completed + actual.kpis.onboard).toBe(actual.kpis.pickedUp);
    let previousTime = fixture.scenario.startS;
    for (const event of actual.trace!) {
      expect(event.timeS).toBeGreaterThanOrEqual(previousTime);
      expect(event.timeS).toBeLessThanOrEqual(fixture.scenario.endS);
      previousTime = event.timeS;
      for (const car of event.carChanges) {
        const cabin = fixture.scenario.cabins.find(item => item.id === car.id)!;
        expect(car.actualWeightKg).toBe(80 * car.onboardIds.length);
        expect(car.actualWeightKg).toBeLessThanOrEqual(cabin.ratedLoadKg);
        expect(car.onboardIds.length).toBeLessThanOrEqual(cabin.maxPeople);
        expect(car.floor).toBeGreaterThanOrEqual(0);
        expect(car.floor).toBeLessThanOrEqual(fixture.scenario.upperFloors);
      }
    }
    for (const request of actual.outcomes) {
      if (request.pickupS !== null) expect(request.pickupS).toBeGreaterThanOrEqual(request.bornS);
      if (request.finishS !== null) expect(request.finishS).toBeGreaterThanOrEqual(request.pickupS!);
    }
  });

  it.each(corpus.fixtures.filter(fixture => fixture.name.startsWith('generated-')))(
    '$name: reproduces the original seeded demand at 72% and 100% participation', async fixture => {
      expect(await generateDataset(fixture.scenario, fixture.dataset.seed)).toStrictEqual(fixture.dataset);
    },
  );

  it.each(cases.filter(({ name }) => name === 'queued-1car-50floors' || name === 'parking-followed-by-queued-real-demand'))(
    '$name / $policy: disabling trace preserves the same complete non-trace result', ({ fixture, expected }) => {
      const actual = simulate(fixture.scenario, fixture.dataset, expected.policy, fixture.context, false);
      expect(JSON.parse(JSON.stringify(actual))).toStrictEqual({ ...expected, initialSnapshot: null, trace: null });
    },
  );

  it.each(cases.filter(({ name }) => name === 'queued-8cars-50floors-heterogeneous'))(
    '$name / $policy: progress observation preserves every original result and trace field', ({ fixture, expected }) => {
      const reports: { processedEvents: number; simulationTimeS: number }[] = [];
      const actual = simulate(fixture.scenario, fixture.dataset, expected.policy, fixture.context, true, progress => reports.push(progress));
      expect(JSON.parse(JSON.stringify(actual))).toStrictEqual(expected);
      expect(reports.length).toBeGreaterThanOrEqual(2);
      expect(reports[0]).toEqual({ processedEvents: 0, simulationTimeS: fixture.scenario.startS });
      expect(reports.at(-1)!.processedEvents).toBeGreaterThan(0);
      for (let index = 1; index < reports.length; index++) {
        expect(reports[index].processedEvents).toBeGreaterThanOrEqual(reports[index - 1].processedEvents);
        expect(reports[index].simulationTimeS).toBeGreaterThanOrEqual(reports[index - 1].simulationTimeS);
        expect(reports[index].simulationTimeS).toBeLessThanOrEqual(fixture.scenario.endS);
      }
    },
  );
});

describe('numerical integrity of the explicit unavailable-recording fallback', () => {
  const fixture = corpus.fixtures.find(item => item.name === 'generated-lunch-100-seed-101')!;

  it('retries only the failed selected recording and retains all complete original outcomes and KPI', async () => {
    const realSimulate = engine.simulate;
    const spy = vi.spyOn(engine, 'simulate').mockImplementation((...args) => {
      if (args[4]) throw new SimulationError('unsupported', 'resource-trace', 'Independent injected trace budget exhaustion', 'trace');
      return realSimulate(...args);
    });
    try {
      const experiment = await runExperiment(fixture.scenario, corpus.policies, { policy: 'adaptive', seed: fixture.dataset.seed });
      expect(experiment.datasets).toStrictEqual([fixture.dataset]);
      expect(experiment.officeEstimates).toStrictEqual(fixture.context.officeModels);
      expect(JSON.parse(JSON.stringify(experiment.results))).toStrictEqual(
        fixture.results.map(result => ({ ...result, initialSnapshot: null, trace: null })),
      );
      expect(spy.mock.calls.map(args => [args[2], args[4]])).toEqual([
        ['fifo', false], ['optimal', false], ['adaptive', true], ['adaptive', false],
      ]);
      const firstAttempt = spy.mock.calls[2], recoveredAttempt = spy.mock.calls[3];
      expect(recoveredAttempt[0]).toBe(firstAttempt[0]);
      expect(recoveredAttempt[1]).toBe(firstAttempt[1]);
      expect(recoveredAttempt[3]).toBe(firstAttempt[3]);
      const unavailable = experiment.diagnosticsIssues.filter(issue => issue.code === 'trace-unavailable');
      expect(unavailable).toHaveLength(1);
      expect(unavailable[0].path).toContain('adaptive');
      expect(unavailable[0].path).toContain(fixture.dataset.seed);
      expect(experiment.results.every(result => result.trace === null && result.initialSnapshot === null)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  const unrecoverable = [
    { name: 'numerical failure even with resource-trace code', error: new SimulationError('numerical', 'resource-trace', 'Independent numerical error'), selected: true },
    { name: 'event resource failure', error: new SimulationError('unsupported', 'resource-events', 'Independent event budget error'), selected: true },
    { name: 'invalid mathematical context', error: new SimulationError('invalid', 'context-capacity', 'Independent capacity context error'), selected: true },
    { name: 'unexpected internal error', error: new Error('Independent unexpected failure'), selected: true },
    { name: 'untyped object resembling a trace limit error', error: { kind: 'unsupported', issues: [{ code: 'resource-trace' }] }, selected: true },
    { name: 'trace budget error from a run without recording selected', error: new SimulationError('unsupported', 'resource-trace', 'Independent error without selected recording'), selected: false },
  ];
  it.each(unrecoverable)('$name is propagated without a second simulation or partial output', async ({ error, selected }) => {
    const spy = vi.spyOn(engine, 'simulate').mockImplementationOnce(() => { throw error; });
    try {
      const selection = selected ? { policy: 'adaptive' as const, seed: fixture.dataset.seed } : null;
      await expect(runExperiment(fixture.scenario, ['adaptive'], selection)).rejects.toBe(error);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('propagates a mathematical failure of the repeated run instead of returning any partial result', async () => {
    const numerical = new SimulationError('numerical', 'independent-arithmetic-failure', 'Independent numerical failure after trace exhaustion');
    const spy = vi.spyOn(engine, 'simulate')
      .mockImplementationOnce(() => { throw new SimulationError('unsupported', 'resource-trace', 'Independent trace exhaustion', 'trace'); })
      .mockImplementationOnce(() => { throw numerical; });
    try {
      await expect(runExperiment(fixture.scenario, ['adaptive'], { policy: 'adaptive', seed: fixture.dataset.seed })).rejects.toBe(numerical);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls.map(args => args[4])).toEqual([true, false]);
    } finally {
      spy.mockRestore();
    }
  });
});
