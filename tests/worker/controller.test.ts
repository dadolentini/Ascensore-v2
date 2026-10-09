import { describe, expect, it, vi } from 'vitest';
import type { ExperimentResult, WorkerIn, WorkerOut } from '../../src/model/contracts';
import { createDefaultScenario } from '../../src/model/defaults';
import { RunController, type WorkerPort } from '../../src/app/RunController';

class FakeWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage'] = null;
  onerror: WorkerPort['onerror'] = null;
  messages: WorkerIn[] = [];
  terminated = false;
  postMessage(message: WorkerIn) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  emit(message: WorkerOut) { this.onmessage?.({ data: message } as MessageEvent<WorkerOut>); }
}

describe('RunController worker lifecycle', () => {
  it('terminates immediately on cancel and ignores late progress, errors and results', () => {
    const workers: FakeWorker[] = [];
    const callbacks = { onDone: vi.fn(), onProgress: vi.fn(), onError: vi.fn(), onCancelled: vi.fn() };
    const controller = new RunController(callbacks, () => { const w = new FakeWorker(); workers.push(w); return w; });
    const first = controller.start(createDefaultScenario(), ['fifo'], null);
    const staleHandler = workers[0].onmessage!;
    controller.cancel();
    expect(workers[0].terminated).toBe(true);
    expect(callbacks.onCancelled).toHaveBeenCalledTimes(1);
    const second = controller.start(createDefaultScenario(), ['optimal'], null);
    expect(second).not.toBe(first);
    for (const data of [
      { type: 'PROGRESS', jobId: first, phase: 'simulation', processedEvents: 0 },
      { type: 'DONE', jobId: first, experiment: {} as ExperimentResult },
      { type: 'ERROR', jobId: first, kind: 'internal', issues: [] },
    ] as WorkerOut[]) staleHandler({ data } as MessageEvent<WorkerOut>);
    expect(callbacks.onProgress).not.toHaveBeenCalled();
    expect(callbacks.onDone).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
    expect(controller.activeJobId).toBe(second);
    workers[1].emit({ type: 'DONE', jobId: second, experiment: {} as ExperimentResult });
    expect(callbacks.onDone).toHaveBeenCalledTimes(1);
    expect(controller.activeJobId).toBeNull();
    expect(workers[1].terminated).toBe(true);
  });

  it('replaces an active run, posts the explanation input and disposes without callbacks', () => {
    const workers: FakeWorker[] = [];
    const onCancelled = vi.fn();
    const controller = new RunController({ onCancelled }, () => { const w = new FakeWorker(); workers.push(w); return w; });
    controller.start(createDefaultScenario(), ['fifo'], null);
    const dataset = { seed: '101', datasetHash: 'hash', generatorVersion: 'version', requests: [] };
    const jobId = controller.explain(createDefaultScenario(), dataset);
    expect(workers[0].terminated).toBe(true);
    expect(workers[1].messages[0]).toMatchObject({ type: 'EXPLAIN', jobId, dataset });
    controller.dispose();
    expect(workers[1].terminated).toBe(true);
    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(() => controller.start(createDefaultScenario(), ['fifo'], null)).toThrow(/disposed/i);
  });

  it('turns native worker failures into typed errors and releases the worker', () => {
    const worker = new FakeWorker();
    const onError = vi.fn();
    const controller = new RunController({ onError }, () => worker);
    const jobId = controller.start(createDefaultScenario(), ['fifo'], null);
    worker.onerror?.({ message: 'failed to load' } as ErrorEvent);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ type: 'ERROR', jobId, kind: 'internal' }));
    expect(worker.terminated).toBe(true);
    expect(controller.activeJobId).toBeNull();
  });
});
