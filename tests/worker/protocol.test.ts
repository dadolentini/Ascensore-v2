import { describe, expect, it } from 'vitest';
import type { WorkerOut } from '../../src/model/contracts';
import { createDefaultScenario } from '../../src/model/defaults';
import { createWorkerHandler } from '../../src/worker/protocol';

function scenario() {
  const s = createDefaultScenario();
  s.offices = [{ id: 'one', floor: 1, employees: 1, lunchStartHour: 13, lunchParticipation: 0 }];
  s.seeds = { habits: '900', simulation: ['1'], training: ['2'], validation: [] };
  return s;
}
describe('worker protocol', () => {
  it('emits typed validation errors without a completion for malformed envelopes or scenarios', async () => {
    const messages: WorkerOut[] = [];
    const handle = createWorkerHandler(m => messages.push(m));
    for (const input of [null, { type: 'OTHER', jobId: 'bad' }, { type: 'RUN', jobId: '', scenario: scenario(), policies: ['fifo'], traceFor: null }, { type: 'RUN', jobId: 'bad', scenario: null, policies: ['fifo'], traceFor: null }]) await handle(input);
    expect(messages).toHaveLength(4);
    expect(messages.every(m => m.type === 'ERROR' && m.kind === 'invalid')).toBe(true);
  });

  it('cancels an asynchronous job and suppresses its later completion', async () => {
    const messages: WorkerOut[] = [];
    const handle = createWorkerHandler(m => messages.push(m));
    const run = handle({ type: 'RUN', jobId: 'first', scenario: scenario(), policies: ['fifo'], traceFor: null });
    await handle({ type: 'CANCEL', jobId: 'first' });
    await run;
    expect(messages.filter(m => m.type === 'CANCELLED')).toEqual([{ type: 'CANCELLED', jobId: 'first' }]);
    expect(messages.some(m => m.type === 'DONE' || m.type === 'ERROR')).toBe(false);
    await handle({ type: 'RUN', jobId: 'second', scenario: scenario(), policies: ['fifo'], traceFor: null });
    expect(messages.at(-1)).toMatchObject({ type: 'DONE', jobId: 'second' });
  });

  it('ignores unrelated cancellation and rejects concurrent jobs while completing the active job', async () => {
    const messages: WorkerOut[] = [];
    const handle = createWorkerHandler(m => messages.push(m));
    const run = handle({ type: 'RUN', jobId: 'first', scenario: scenario(), policies: ['fifo'], traceFor: null });
    await handle({ type: 'CANCEL', jobId: 'other' });
    await handle({ type: 'RUN', jobId: 'second', scenario: scenario(), policies: ['fifo'], traceFor: null });
    await run;
    expect(messages.some(m => m.type === 'ERROR' && m.jobId === 'second')).toBe(true);
    expect(messages.at(-1)).toMatchObject({ type: 'DONE', jobId: 'first' });
    expect(messages.some(m => m.type === 'CANCELLED')).toBe(false);
  });
});
