import type { Issue } from '../model/contracts';

/** A run either returns complete finite-horizon evidence or fails explicitly. */
export class SimulationError extends Error {
  readonly kind: 'invalid'|'unsupported'|'numerical';
  readonly issues: readonly Issue[];
  constructor(kind: SimulationError['kind'], code: string, message: string, path = 'simulation') {
    super(message); this.name = 'SimulationError'; this.kind = kind;
    this.issues = [{ code, path, message }];
  }
}
