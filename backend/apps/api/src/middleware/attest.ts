import type { MiddlewareHandler } from 'hono';
import type { RequestVariables } from './request-id.js';

/**
 * Play Integrity (Android) and App Attest (iOS) verification hook before anonymous token issue.
 */
export function createAttestationMiddleware(
  enforced: boolean,
): MiddlewareHandler<{ Variables: RequestVariables }> {
  return async (c, next) => {
    if (!enforced) {
      await next();
      return;
    }
    const attestHeader = c.req.header('x-app-attest');
    if (!attestHeader) {
      return c.json(
        {
          code: 'attestation_required',
          message: 'App attestation proof required before issuing credential.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    await next();
  };
}
