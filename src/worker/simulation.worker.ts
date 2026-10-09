import type { WorkerOut } from '../model/contracts';
import { createWorkerHandler } from './protocol';

// Local structural type avoids conflicting DOM/worker lib declarations in the app.
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: WorkerOut): void;
};
const handle = createWorkerHandler(message => workerScope.postMessage(message));
workerScope.onmessage = event => { void handle(event.data); };
