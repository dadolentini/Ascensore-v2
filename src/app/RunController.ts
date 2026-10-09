import type { Dataset, ExperimentResult, PolicyId, ScenarioV2, TraceSelection, WorkerIn, WorkerOut } from '../model/contracts';

export type ProgressMessage = Extract<WorkerOut, { type: 'PROGRESS' }>;
export type ErrorMessage = Extract<WorkerOut, { type: 'ERROR' }>;
export interface RunControllerCallbacks {
  onProgress?: (message: ProgressMessage) => void;
  onDone?: (experiment: ExperimentResult) => void;
  onError?: (message: ErrorMessage) => void;
  onCancelled?: () => void;
}
export interface WorkerPort {
  onmessage: ((event: MessageEvent<WorkerOut>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: WorkerIn): void;
  terminate(): void;
}
export type WorkerFactory = () => WorkerPort;
const defaultWorkerFactory: WorkerFactory = () => new Worker(new URL('../worker/simulation.worker.ts', import.meta.url), { type: 'module' });
let nextJobNumber = 0;

/** Owns one fresh worker per job. Synchronous DES is interrupted by termination. */
export class RunController {
  private worker: WorkerPort | null = null;
  private jobId: string | null = null;
  private disposed = false;
  constructor(private readonly callbacks: RunControllerCallbacks, private readonly workerFactory: WorkerFactory = defaultWorkerFactory) {}
  get activeJobId(): string | null { return this.jobId; }

  start(scenario: ScenarioV2, policies: readonly PolicyId[], traceFor: TraceSelection): string {
    return this.begin(jobId => ({ type: 'RUN', jobId, scenario, policies, traceFor }));
  }
  explain(scenario: ScenarioV2, dataset: Dataset): string {
    return this.begin(jobId => ({ type: 'EXPLAIN', jobId, scenario, dataset }));
  }
  cancel(): void {
    if (this.jobId === null) return;
    this.release();
    this.callbacks.onCancelled?.();
  }
  dispose(): void {
    this.release();
    this.disposed = true;
  }
  private release(): void {
    this.jobId = null;
    const worker = this.worker;
    this.worker = null;
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
  }
  private begin(message: (jobId: string) => WorkerIn): string {
    if (this.disposed) throw new Error('RunController is disposed');
    this.cancel();
    const jobId = `run-${++nextJobNumber}`;
    this.jobId = jobId;
    try {
      const worker = this.workerFactory();
      this.worker = worker;
      worker.onmessage = event => {
        const data = event.data;
        if (this.jobId !== jobId || this.worker !== worker || data.jobId !== jobId) return;
        if (data.type === 'PROGRESS') { this.callbacks.onProgress?.(data); return; }
        this.release();
        if (data.type === 'DONE') this.callbacks.onDone?.(data.experiment);
        else if (data.type === 'ERROR') this.callbacks.onError?.(data);
        else if (data.type === 'CANCELLED') this.callbacks.onCancelled?.();
      };
      worker.onerror = event => {
        if (this.jobId !== jobId || this.worker !== worker) return;
        this.release();
        this.callbacks.onError?.({ type: 'ERROR', jobId, kind: 'internal', issues: [{ code: 'worker-runtime', path: 'worker', message: event.message || 'Errore di esecuzione del worker.' }] });
      };
      worker.postMessage(message(jobId));
    } catch (error) {
      this.release();
      this.callbacks.onError?.({ type: 'ERROR', jobId, kind: 'internal', issues: [{ code: 'worker-start', path: 'worker', message: error instanceof Error ? error.message : 'Impossibile avviare il worker.' }] });
    }
    return jobId;
  }
}
