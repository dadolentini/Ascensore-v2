import { useCallback, useEffect, useRef, useState } from 'react';
import { RunController, type ProgressMessage } from '../app/RunController';
import type { Dataset, ExperimentResult, Issue, PolicyId, ScenarioV2, TraceSelection } from '../model/contracts';

export function useSimulationJob() {
  const controller = useRef<RunController | null>(null);
  const [status, setStatus] = useState<'idle'|'running'|'done'|'error'|'cancelled'>('idle');
  const [result, setResult] = useState<ExperimentResult | null>(null);
  const [issues, setIssues] = useState<readonly Issue[]>([]);
  const [progress, setProgress] = useState<ProgressMessage | null>(null);
  useEffect(() => {
    let mounted = true;
    controller.current = new RunController({
      onProgress: message => { if (mounted) setProgress(message); },
      onDone: value => { if (mounted) { setResult(value); setStatus('done'); } },
      onError: message => { if (mounted) { setIssues(message.issues); setStatus('error'); } },
      onCancelled: () => { if (mounted) setStatus('cancelled'); },
    });
    return () => { mounted = false; controller.current?.dispose(); controller.current = null; };
  }, []);
  const start = useCallback((scenario:ScenarioV2, policies:readonly PolicyId[], traceFor:TraceSelection) => {
    setIssues([]); setProgress(null); setStatus('running');
    try { controller.current?.start(structuredClone(scenario), policies, traceFor); }
    catch (error) { setIssues([{code:'START',path:'',message:error instanceof Error?error.message:'Avvio non riuscito'}]); setStatus('error'); }
  }, []);
  const explain = useCallback((scenario:ScenarioV2, dataset:Dataset) => {
    setIssues([]); setProgress(null); setStatus('running');
    try { controller.current?.explain(structuredClone(scenario), dataset); }
    catch (error) { setIssues([{code:'START',path:'',message:error instanceof Error?error.message:'Avvio non riuscito'}]); setStatus('error'); }
  }, []);
  const cancel = useCallback(() => controller.current?.cancel(), []);
  return {status, result, issues, progress, start, explain, cancel};
}
