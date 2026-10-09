import type { Issue, WorkerIn, WorkerOut } from '../model/contracts';
import { ExperimentError, runExperiment, runExplanation } from './runner';

export type { WorkerIn, WorkerOut } from '../model/contracts';
type Job = { id: string; cancelled: boolean };

function errorMessage(jobId: string, error: unknown): Extract<WorkerOut, { type: 'ERROR' }> {
  if (error instanceof ExperimentError) return { type: 'ERROR', jobId, kind: error.kind, issues: error.issues };
  // Engine SimulationError shares this serializable error contract.
  if (error && typeof error === 'object' && 'kind' in error && 'issues' in error && ['invalid', 'unsupported', 'numerical'].includes(String(error.kind)) && Array.isArray(error.issues)) {
    return { type: 'ERROR', jobId, kind: error.kind as 'invalid' | 'unsupported' | 'numerical', issues: error.issues as Issue[] };
  }
  return { type: 'ERROR', jobId, kind: 'internal', issues: [{ code: 'worker-internal', path: 'worker', message: error instanceof Error ? error.message : 'Errore interno durante l’esperimento.' }] };
}

/** Serial protocol used by the real worker and tested without a browser harness. */
export function createWorkerHandler(post: (message: WorkerOut) => void): (input: unknown) => Promise<void> {
  let active: Job | null = null;
  return async input => {
    const message = input as WorkerIn;
    const jobId = input && typeof input === 'object' && 'jobId' in input && typeof input.jobId === 'string' ? input.jobId : '';
    const invalid = (code: string, message: string) => post({ type: 'ERROR', jobId, kind: 'invalid', issues: [{ code, path: 'worker.message', message }] });
    if (!input || typeof input !== 'object' || Array.isArray(input) || !jobId.trim() || jobId.length > 128) { invalid('worker-envelope', 'Il messaggio richiede un jobId non vuoto di al massimo 128 caratteri.'); return; }
    if (message.type === 'CANCEL') {
      if (active?.id === jobId && !active.cancelled) {
        active.cancelled = true;
        post({ type: 'CANCELLED', jobId });
      }
      return;
    }
    if (message.type !== 'RUN' && message.type !== 'EXPLAIN') { invalid('worker-type', 'Tipo di messaggio non supportato.'); return; }
    if (active) { invalid('worker-busy', 'Il worker sta già eseguendo un esperimento.'); return; }
    const job: Job = { id: jobId, cancelled: false };
    active = job;
    try {
      const experiment = message.type === 'RUN'
        ? await runExperiment(message.scenario, message.policies, message.traceFor, progress => { if (!job.cancelled) post({ type: 'PROGRESS', jobId, ...progress }); })
        : await runExplanation(message.scenario, message.dataset);
      if (!job.cancelled) post({ type: 'DONE', jobId, experiment });
    } catch (error) {
      if (!job.cancelled) post(errorMessage(jobId, error));
    } finally {
      if (active === job) active = null;
    }
  };
}
