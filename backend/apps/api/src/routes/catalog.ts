import { createHash } from 'node:crypto';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import { CatalogManifestResponseSchema } from '@mockza/contracts';
import { catalogPacks, type MockzaDb } from '@mockza/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { RequestVariables } from '../middleware/request-id.js';

export function registerCatalogRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
): void {
  const manifestRoute = createRoute({
    method: 'get',
    path: '/v1/catalog/manifest',
    request: {
      query: z.object({
        skill: z.string().optional(),
        track: z.enum(['academic', 'general']).optional(),
      }),
    },
    responses: {
      200: {
        description: 'PostgreSQL-backed catalog manifest with caching ETag.',
        content: { 'application/json': { schema: CatalogManifestResponseSchema } },
      },
      304: { description: 'Not Modified.' },
    },
  });

  app.openapi(manifestRoute, async (c) => {
    const { skill, track } = c.req.valid('query');
    const edition = env.EDITION === 'irn' ? 'irn' : 'glb';

    let packs: Array<{
      packId: string;
      edition: 'glb' | 'irn';
      examId: string;
      skill: string;
      track: 'academic' | 'general';
      title: string;
      description: string;
      durationSeconds: number;
      questionCount: number;
      accent: string | null;
      mediaUrl: string | null;
      version: string;
      sha256: string;
      byteLength: number;
      downloadUrl: string;
      contentOrigin: 'authored_original' | 'cc_by_sa_adapted' | 'open_corpus';
      humanQaReviewed: boolean;
      isFreeSample: boolean;
    }> = [];

    if (db) {
      const conditions = [
        eq(catalogPacks.isPublished, true),
        inArray(catalogPacks.edition, [edition, 'all']),
      ];
      if (skill) {
        conditions.push(eq(catalogPacks.skill, skill));
      }
      if (track) {
        conditions.push(eq(catalogPacks.track, track));
      }

      const rows = await db
        .select()
        .from(catalogPacks)
        .where(and(...conditions))
        .orderBy(asc(catalogPacks.skill), asc(catalogPacks.packId));

      packs = rows.map((r) => ({
        packId: r.packId,
        edition,
        examId: r.examId,
        skill: r.skill,
        track: r.track === 'general' ? 'general' : 'academic',
        title: r.title,
        description: r.description,
        durationSeconds: r.durationSeconds,
        questionCount: r.questionCount,
        accent: r.accent ?? null,
        mediaUrl: r.mediaObjectKey ? `/v1/media/${r.mediaObjectKey}` : null,
        version: r.version,
        sha256: r.sha256,
        byteLength: r.byteLength,
        downloadUrl: `/v1/exams/${r.packId}`,
        contentOrigin:
          r.contentOrigin === 'cc_by_sa_adapted' || r.contentOrigin === 'open_corpus'
            ? r.contentOrigin
            : 'authored_original',
        humanQaReviewed: r.humanQaReviewed,
        isFreeSample: r.isFreeSample,
      }));
    }

    const etagPayload = JSON.stringify(
      packs.map((p) => `${p.packId}:${p.version}:${p.sha256}:${p.mediaUrl ?? ''}`),
    );
    const etag = `"${createHash('sha256').update(etagPayload).digest('hex').slice(0, 16)}"`;

    const ifNoneMatch = c.req.header('if-none-match');
    if (ifNoneMatch === etag) {
      return c.body(null, 304) as never;
    }

    c.header('ETag', etag);
    c.header('Cache-Control', 'public, max-age=60, must-revalidate');

    return c.json(
      {
        edition,
        generatedAt: new Date().toISOString(),
        packs,
      },
      200,
    );
  });
}
