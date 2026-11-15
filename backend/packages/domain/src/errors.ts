export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'validation_error',
  UNAUTHORIZED: 'unauthorized',
  ATTESTATION_REQUIRED: 'attestation_required',
  EDITION_FORBIDDEN: 'edition_forbidden',
  EDITION_MISMATCH: 'edition_mismatch',
  ENTITLEMENT_REQUIRED: 'entitlement_required',
  QUOTA_EXCEEDED: 'quota_exceeded',
  ATTEMPT_CONFLICT: 'attempt_conflict',
  UPLOAD_NOT_FOUND: 'upload_not_found',
  UPLOAD_TOO_LARGE: 'upload_too_large',
  MODEL_UNAVAILABLE: 'model_unavailable',
  NOT_FOUND: 'not_found',
  INTERNAL_ERROR: 'internal_error',
} as const;

export type StandardApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export class DomainError extends Error {
  constructor(
    public readonly code: StandardApiErrorCode,
    message: string,
    public readonly status: 400 | 401 | 402 | 403 | 404 | 409 | 429 | 500 | 503 = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class QuotaExceededDomainError extends DomainError {
  constructor(message = 'Daily or monthly evaluation quota exceeded') {
    super('quota_exceeded', message, 429);
  }
}

export class EntitlementRequiredDomainError extends DomainError {
  constructor(message = 'Pro subscription entitlement required') {
    super('entitlement_required', message, 402);
  }
}

export class AttemptConflictDomainError extends DomainError {
  constructor(message = 'An evaluation job for this attemptId already exists') {
    super('attempt_conflict', message, 409);
  }
}
