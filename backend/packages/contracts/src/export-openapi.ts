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
