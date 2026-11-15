import type { Edition } from '@mockza/config';
import type { MiddlewareHandler } from 'hono';
import type { RequestVariables } from './request-id.js';

/** Rejects requests declaring an app edition inconsistent with deployment configuration. */
export function createEditionGuardMiddleware(
  serverEdition: Edition,
): MiddlewareHandler<{ Variables: RequestVariables }> {
  return async (c, next) => {
    const clientEdition = c.req.header('x-mockza-edition');
    if (clientEdition && clientEdition !== serverEdition) {
      return c.json(
        {
          code: 'edition_mismatch',
          message: `Endpoint serves '${serverEdition}' edition, not '${clientEdition}'.`,
          requestId: c.get('requestId'),
        },
        403,
      );
    }
    await next();
  };
}
