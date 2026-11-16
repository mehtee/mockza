export type EvaluationModelErrorCode =
  | 'model_unavailable'
  | 'audio_missing'
  | 'model_invalid_output'
  | 'upstream_rate_limited'
  | 'upstream_timeout';

/**
 * Explicit typed failure thrown whenever live AI evaluation or audio prerequisites fail.
 * Production code must never swallow this into fabricated heuristic grades.
 */
export class EvaluationModelError extends Error {
  constructor(
    public readonly code: EvaluationModelErrorCode,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'EvaluationModelError';
  }
}
