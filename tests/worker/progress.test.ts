import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PolicyId, WorkerOut } from '../../src/model/contracts';
import { createDefaultScenario } from '../../src/model/defaults';
import { simulate } from '../../src/engine';
import { createWorkerHandler } from '../../src/worker/protocol';
import { runExperiment } from '../../src/worker/runner';
import { context, dataset, request, scenario } from '../engine/fixtures';

function comparisonScenario() {
  const value = createDefaultScenario();
  value.upperFloors = 3;
  value.cabins = [{ id: 0, ratedLoadKg: 320, maxPeople: 4 }, { id: 1, ratedLoadKg: 320, maxPeople: 4 }];
  value.offices = [1, 2, 3].map(floor => ({ id: `office-${floor}`, floor, employees: 6, lunchStartHour: 13, lunchParticipation: 1 }));
  value.seeds = { habits: '900', simulation: ['1', '2'], training: ['3', '4'], validation: ['5'] };
  value.fitTrainingDays = 1;
  return value;
}

afterEach(() => vi.restoreAllMocks());

describe('intra-simulation worker progress', () => {
  it('reports each active policy and seed before completing it, without counting it early', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const value = comparisonScenario();
    const policies: PolicyId[] = ['fifo', 'optimal', 'adaptive'];
    const messages: WorkerOut[] = [];
    await createWorkerHandler(message => messages.push(message))({ type: 'RUN', jobId: 'progress', scenario: value, policies, traceFor: { policy: 'optimal', seed: '2' } });

    const doneIndex = messages.findIndex(message => message.type === 'DONE');
    expect(doneIndex).toBeGreaterThan(0);
    const progress = messages.filter((message): message is Extract<WorkerOut, { type: 'PROGRESS' }> => message.type === 'PROGRESS' && message.phase === 'simulation');
    const active = progress.filter(message => message.policy !== undefined);
    expect(active.length).toBeGreaterThan(0);
    const runs = value.seeds.simulation.flatMap(seed => policies.map(policy => ({ seed, policy })));
    for (const [index, run] of runs.entries()) {
      const updates = active.filter(message => message.seed === run.seed && message.policy === run.policy);
      expect(updates.length).toBeGreaterThanOrEqual(2);
      expect(updates.length).toBeLessThanOrEqual(3);
      expect(updates[0]).toMatchObject({ ...run, jobId: 'progress', phase: 'simulation', completedRuns: index, totalRuns: runs.length, processedEvents: 0, simulationTimeS: value.startS });
      expect(updates.some(message => message.processedEvents > 0)).toBe(true);
      for (const update of updates) {
        expect(update.completedRuns).toBe(index);
        expect(update.simulationTimeS).toBeGreaterThanOrEqual(value.startS);
        expect(update.simulationTimeS).toBeLessThanOrEqual(value.endS);
        expect(messages.indexOf(update)).toBeLessThan(doneIndex);
        const completedIndex = messages.findIndex(message => message.type === 'PROGRESS' && message.completedRuns === index + 1);
        expect(messages.indexOf(update)).toBeLessThan(completedIndex);
      }
    }
    expect(progress.at(-1)).toMatchObject({ completedRuns: runs.length, totalRuns: runs.length });
    expect(messages.at(-1)).toMatchObject({ type: 'DONE', jobId: 'progress' });
    expect(messages.some(message => message.type === 'ERROR')).toBe(false);
  });

  it('preserves the full experiment and selected trace when progress is observed', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const value = comparisonScenario();
    const trace = { policy: 'optimal' as const, seed: '2' };
    const withoutProgress = await runExperiment(value, ['fifo', 'optimal', 'adaptive'], trace);
    const updates: unknown[] = [];
    const withProgress = await runExperiment(value, ['fifo', 'optimal', 'adaptive'], trace, update => updates.push(update));
    expect(updates.length).toBeGreaterThan(0);
    expect(withProgress).toStrictEqual(withoutProgress);
    expect(withProgress.results.find(result => result.policy === 'optimal' && result.seed === '2')?.trace?.length).toBeGreaterThan(0);
  });

  it.each<PolicyId>(['fifo', 'optimal', 'adaptive'])('preserves every result field and trace for congested %s demand with frequent updates', policy => {
    let elapsedMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => elapsedMs += 200);
    const value = scenario({ endS: 240, cabins: [{ id: 0, ratedLoadKg: 160, maxPeople: 2 }, { id: 1, ratedLoadKg: 160, maxPeople: 2 }] });
    const demand = dataset(Array.from({ length: 60 }, (_, id) => request(id, id < 48 ? 0 : 150, id % 2 ? 0 : 3, id % 2 ? 3 : 0)));
    const immutableContext = context(value);
    const withoutProgress = simulate(value, demand, policy, immutableContext, true);
    const updates: { processedEvents: number; simulationTimeS: number }[] = [];
    const withProgress = simulate(value, demand, policy, immutableContext, true, update => updates.push(update));
    expect(updates.length).toBeGreaterThan(2);
    expect(updates.some(update => update.processedEvents > 0 && update.simulationTimeS < value.endS)).toBe(true);
    expect(withProgress).toStrictEqual(withoutProgress);
    expect(withProgress.trace?.some(event => event.kind === 'RETRY')).toBe(true);
    expect(withProgress.kpis.unfinished).toBeGreaterThan(0);
  });
});
