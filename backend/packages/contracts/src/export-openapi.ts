import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import * as schemas from './schemas.js';

/** Builds a comprehensive OpenAPI 3.1 JSON document including all contract schemas. */
export function buildContractDocument(): Record<string, unknown> {
  const app = new OpenAPIHono();

  // Register an endpoint documenting all schemas for codegen parity
  const schemaRegistryRoute = createRoute({
    method: 'post',
    path: '/v1/schema-registry',
    summary: 'Internal schema registry target for client codegen',
    request: {
      body: {
        content: {
          'application/json': {
            schema: schemas.EvaluationOutputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: schemas.JobStatusResponseSchema,
          },
        },
        description: 'Job status with evaluation result',
      },
      201: {
        content: {
          'application/json': {
            schema: schemas.LinkAccountResponseSchema,
          },
        },
        description: 'Link account response',
      },
      202: {
        content: {
          'application/json': {
            schema: schemas.JobEnqueueResponseSchema,
          },
        },
        description: 'Accepted async evaluation job',
      },
      400: {
        content: {
          'application/json': {
            schema: schemas.ApiErrorSchema,
          },
        },
        description: 'Validation or standard API error',
      },
    },
  });

  app.openapi(schemaRegistryRoute, (c) => c.json({} as never));

  const authRoutesRegistry = [
    createRoute({
      method: 'get',
      path: '/v1/auth/providers',
      summary: 'Discover configured auth providers and device slot limits',
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.AuthProvidersResponseSchema } },
          description: 'Available authentication providers and slot policy',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/auth/register',
      summary: 'Create email/password account and claim one active device slot',
      request: {
        body: { content: { 'application/json': { schema: schemas.EmailRegisterRequestSchema } } },
      },
      responses: {
        201: {
          content: { 'application/json': { schema: schemas.AuthSessionResponseSchema } },
          description: 'Registered account and active session',
        },
        409: {
          content: { 'application/json': { schema: schemas.ApiErrorSchema } },
          description: 'Email already registered or device slot limit reached',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/auth/login',
      summary:
        'Sign in with email and password under strict 1-phone + 1-desktop-web slot enforcement',
      request: {
        body: { content: { 'application/json': { schema: schemas.EmailLoginRequestSchema } } },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.AuthSessionResponseSchema } },
          description: 'Signed in account and active device sessions',
        },
        409: {
          content: { 'application/json': { schema: schemas.ApiErrorSchema } },
          description: 'Device slot limit reached',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/auth/oauth',
      summary:
        'Sign in or register via Google or Apple ID token (or dev sandbox token outside production)',
      request: {
        body: { content: { 'application/json': { schema: schemas.OAuthSignInRequestSchema } } },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.AuthSessionResponseSchema } },
          description: 'Signed in via OAuth provider',
        },
        409: {
          content: { 'application/json': { schema: schemas.ApiErrorSchema } },
          description: 'Device slot limit reached',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/auth/logout',
      summary: 'Sign out current device and vacate its slot',
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.LogoutResponseSchema } },
          description: 'Signed out current device',
        },
      },
    }),
    createRoute({
      method: 'get',
      path: '/v1/account/devices',
      summary: 'List active signed-in devices and slot occupancy for the authenticated user',
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.AccountSessionsResponseSchema } },
          description: 'Active device sessions and slot capacity',
        },
      },
    }),
    createRoute({
      method: 'delete',
      path: '/v1/account/devices/{targetDeviceId}',
      summary: 'Remotely terminate a signed-in device session and vacate its slot',
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.RevokeDeviceSessionResponseSchema } },
          description: 'Revoked target device session',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/account/devices/revoke-others',
      summary: 'Terminate all active device sessions except the caller device',
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.RevokeDeviceSessionResponseSchema } },
          description: 'Revoked all other device sessions',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/account/device-policy-consent',
      summary: 'Record user acceptance of the 1 Mobile Phone + 1 Desktop Web subscription policy',
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.AccountUserSchema } },
          description: 'Updated user account with policy consent timestamp',
        },
      },
    }),
    createRoute({
      method: 'get',
      path: '/v1/graph/me',
      summary: 'Get persistent Linguistic Graph bottlenecks, structures, and interest topics',
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.LinguisticGraphResponseSchema } },
          description: 'Linguistic graph snapshot',
        },
      },
    }),
    createRoute({
      method: 'patch',
      path: '/v1/graph/interests',
      summary: 'Pin or mute personal interest topics in the Linguistic Graph',
      request: {
        body: { content: { 'application/json': { schema: schemas.UpdateGraphInterestsRequestSchema } } },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.LinguisticGraphResponseSchema } },
          description: 'Updated Linguistic graph snapshot',
        },
      },
    }),
    createRoute({
      method: 'get',
      path: '/v1/missions/today',
      summary: 'Lazily fetch or generate today Daily 10-Min Mission',
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.DailyMissionResponseSchema } },
          description: 'Today Daily Mission',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/missions/{missionId}/complete',
      summary: 'Submit Daily 10-Min Mission response and verify forced target structures',
      request: {
        body: { content: { 'application/json': { schema: schemas.CompleteDailyMissionRequestSchema } } },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.DailyMissionResponseSchema } },
          description: 'Completed mission with verification feedback',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/register-shifter/shift',
      summary: 'Shift spoken voice reflection into 3 calibrated registers (Casual, Workplace, Academic)',
      request: {
        body: { content: { 'application/json': { schema: schemas.RegisterShifterRequestSchema } } },
      },
      responses: {
        202: {
          content: { 'application/json': { schema: schemas.JobEnqueueResponseSchema } },
          description: 'Queued Register Shifter job',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/register-shifter/{runId}/verify-repeat',
      summary: 'Verify spoken repeat-aloud muscle-memory attempt with System 1 decision probe',
      request: {
        body: { content: { 'application/json': { schema: schemas.VerifyRepeatAloudRequestSchema } } },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.VerifyRepeatAloudResponseSchema } },
          description: 'Repeat-aloud verification result',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/drop/presign-media',
      summary: 'Issue bounded presigned PUT URLs for private Drop Anything image or audio assets',
      request: {
        body: { content: { 'application/json': { schema: schemas.DropPresignMediaRequestSchema } } },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.DropPresignMediaResponseSchema } },
          description: 'Presigned media upload targets',
        },
      },
    }),
    createRoute({
      method: 'post',
      path: '/v1/drop/ingest',
      summary: 'Ingest personal URL, text snippet, image/screenshot, or bounded audio into a 2-min drill',
      request: {
        body: { content: { 'application/json': { schema: schemas.DropIngestRequestSchema } } },
      },
      responses: {
        202: {
          content: { 'application/json': { schema: schemas.JobEnqueueResponseSchema } },
          description: 'Queued Drop Anything ingestion job',
        },
      },
    }),
    createRoute({
      method: 'get',
      path: '/v1/drop/history',
      summary: 'List private user-dropped items scoped to account and edition',
      responses: {
        200: {
          content: { 'application/json': { schema: schemas.DropHistoryResponseSchema } },
          description: 'Paginated drop history',
        },
      },
    }),
  ];

  for (const r of authRoutesRegistry) {
    app.openapi(r, (c) => c.json({} as never));
  }

  return app.getOpenAPIDocument({
    openapi: '3.1.0',
    info: {
      title: 'Mockza API',
      version: '0.1.0',
      description: 'Mockza IELTS async evaluation, content catalog, and study platform API',
    },
  }) as unknown as Record<string, unknown>;
}

export function writeOpenApiArtifact(outputPath?: string): string {
  const doc = buildContractDocument();
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const targetPath = outputPath ?? resolve(__dirname, '../dist/openapi.json');
  const targetDir = dirname(targetPath);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  writeFileSync(targetPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf-8');
  return targetPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const shouldWrite = process.argv.includes('--write');
  if (shouldWrite) {
    const written = writeOpenApiArtifact();
    process.stdout.write(`Wrote OpenAPI spec to ${written}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(buildContractDocument(), null, 2)}\n`);
  }
}
