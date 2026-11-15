import { describe, expect, it } from 'vitest';
import { checkDbHealth, createDbClient } from '../client.js';
import * as schema from '../schema.js';

describe('@mockza/db schema definitions', () => {
  it('exports all required Postgres tables', () => {
    expect(schema.users).toBeDefined();
    expect(schema.devices).toBeDefined();
    expect(schema.accountLinks).toBeDefined();
    expect(schema.entitlements).toBeDefined();
    expect(schema.quotaReservations).toBeDefined();
    expect(schema.dailyQuotaUsage).toBeDefined();
    expect(schema.monthlyQuotaUsage).toBeDefined();
    expect(schema.evaluationJobs).toBeDefined();
    expect(schema.audioAssets).toBeDefined();
    expect(schema.aiQuestionExplanations).toBeDefined();
    expect(schema.catalogPacks).toBeDefined();
    expect(schema.examSections).toBeDefined();
    expect(schema.examQuestions).toBeDefined();
    expect(schema.microDrills).toBeDefined();
    expect(schema.vocabDeckCards).toBeDefined();
    expect(schema.webhookEvents).toBeDefined();
    expect(schema.questionFlags).toBeDefined();
  });

  it('contains expected columns on devices and quota tables', () => {
    expect(schema.devices.freeDiagnosticUsed).toBeDefined();
    expect(schema.devices.linkedUserId).toBeDefined();
    expect(schema.devices.appVersion).toBeDefined();
    expect(schema.devices.lastAttestedAt).toBeDefined();

    expect(schema.quotaReservations.reservationId).toBeDefined();
    expect(schema.quotaReservations.attemptId).toBeDefined();
    expect(schema.quotaReservations.status).toBeDefined();

    expect(schema.dailyQuotaUsage.speakingUsed).toBeDefined();
    expect(schema.dailyQuotaUsage.writingUsed).toBeDefined();
    expect(schema.monthlyQuotaUsage.totalUsed).toBeDefined();
  });

  it('creates db client with configurable options', () => {
    const { db, sql } = createDbClient('postgres://mockza:password@localhost:5432/mockza', {
      max: 5,
      prepare: false,
    });
    expect(db).toBeDefined();
    expect(sql).toBeDefined();
    void sql.end();
  });

  it('handles db health check failure gracefully when unreachable', async () => {
    // Port 54399 is not running, checkDbHealth should return healthy: false
    const { sql } = createDbClient('postgres://mockza:password@127.0.0.1:54399/mockza', {
      connectTimeoutSeconds: 1,
    });
    const health = await checkDbHealth(sql, 1000);
    expect(health.healthy).toBe(false);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    void sql.end();
  });

  it('provides clean normalized Postgres starter seed bundles', async () => {
    const { STARTER_EXAM_BUNDLES, STARTER_MICRO_DRILLS, STARTER_VOCAB_CARDS } = await import(
      '../index.js'
    );
    expect(STARTER_EXAM_BUNDLES.length).toBe(24);
    expect(STARTER_MICRO_DRILLS.length).toBe(4);
    expect(STARTER_VOCAB_CARDS.length).toBe(320);
  });
});
