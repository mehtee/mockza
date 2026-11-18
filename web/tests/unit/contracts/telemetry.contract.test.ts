import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { FakeClock } from '@/adapters/fakes/fake-clock';
import { FakeTelemetryAdapter } from '@/adapters/fakes/fake-telemetry.adapter';
import { ApiClient } from '@/adapters/http/api-client';
import { HttpTelemetryAdapter, SystemClock } from '@/adapters/http/http-telemetry.adapter';
import { createTestDependencies } from '@/composition/bootstrap-test';
import {
  AppDependenciesProvider as ReexportedProvider,
  useDeps as reexportedUseDeps,
} from '@/composition/container';
import type { IClock, ITelemetryGateway } from '@/gateways/telemetry.gateway';
import { AppDependenciesProvider, useDeps } from '@/spa/deps';

interface TelemetryContractHarness {
  readonly clock: IClock;
  readonly telemetry: ITelemetryGateway;
  getSentPayloads(): readonly Record<string, unknown>[];
}

function runTelemetryContractSuite(
  name: string,
  createHarness: () => TelemetryContractHarness,
) {
  describe(`ITelemetryGateway & IClock LSP contract: ${name}`, () => {
    it('provides valid UTC timestamps and integer SerialDay from IClock', () => {
      const { clock } = createHarness();
      const ms = clock.nowMs();
      const iso = clock.nowIso();
      const day = clock.todaySerialDay();

      expect(Number.isFinite(ms)).toBe(true);
      expect(Date.parse(iso)).not.toBeNaN();
      expect(Number.isInteger(day)).toBe(true);
      expect(day).toBeGreaterThan(18_000);
    });

    it('tracks events, records errors, redacts secrets, and flushes batch cleanly', async () => {
      const h = createHarness();

      h.telemetry.track('reading_started', {
        packId: 'pack-1',
        accessToken: 'should-be-redacted',
        email: 'pii-email@mockza.test',
        phoneE164: '+989121234567',
        otpCode: '654321',
        jwt: 'header.payload.sig',
        bearer: 'secret-bearer-val',
        questionCount: 40,
      });
      h.telemetry.recordError(new TypeError('Audio buffer stalled'), {
        secretKey: 'should-also-be-redacted',
      });

      const flushRes = await h.telemetry.flush();
      expect(flushRes.ok).toBe(true);
      if (flushRes.ok) {
        expect(flushRes.value.acceptedCount).toBe(2);
      }

      const secondFlush = await h.telemetry.flush();
      expect(secondFlush.ok).toBe(true);
      if (secondFlush.ok) {
        expect(secondFlush.value.acceptedCount).toBe(0);
      }

      const sent = h.getSentPayloads();
      const serialized = JSON.stringify(sent);
      expect(serialized).not.toContain('should-be-redacted');
      expect(serialized).not.toContain('should-also-be-redacted');
      expect(serialized).not.toContain('pii-email@mockza.test');
      expect(serialized).not.toContain('+989121234567');
      expect(serialized).not.toContain('654321');
      expect(serialized).not.toContain('header.payload.sig');
      expect(serialized).not.toContain('secret-bearer-val');
      expect(serialized).toContain('"errorName":"TypeError"');
    });

    it('caps buffered queue at maxQueueSize', async () => {
      const h = createHarness();
      for (let i = 0; i < 105; i++) {
        h.telemetry.track(`evt_${i}`, { index: i });
      }
      const flushRes = await h.telemetry.flush();
      expect(flushRes.ok).toBe(true);
      if (flushRes.ok) {
        expect(flushRes.value.acceptedCount).toBe(100);
      }
      const serialized = JSON.stringify(h.getSentPayloads());
      expect(serialized).not.toContain('"evt_0"');
      expect(serialized).toContain('"evt_104"');
    });
  });
}

runTelemetryContractSuite('FakeTelemetryAdapter & FakeClock', () => {
  const clock = new FakeClock();
  const telemetry = new FakeTelemetryAdapter({ clock });
  return {
    clock,
    telemetry,
    getSentPayloads: () => telemetry.flushedEvents as unknown as Record<string, unknown>[],
  };
});

runTelemetryContractSuite('HttpTelemetryAdapter & SystemClock', () => {
  const clock = new SystemClock();
  const sentBatches: Record<string, unknown>[] = [];
  const apiClient = new ApiClient({
    apiBaseUrl: 'https://api.mockza.com',
    edition: 'glb',
    readAccessToken: () => 'token',
    fetchFn: async (_input, init) => {
      const parsed = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      sentBatches.push(parsed);
      const events = Array.isArray(parsed['events']) ? parsed['events'] : [];
      return new Response(JSON.stringify({ acceptedCount: events.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const telemetry = new HttpTelemetryAdapter({ apiClient, clock });
  return {
    clock,
    telemetry,
    getSentPayloads: () => sentBatches,
  };
});

describe('HttpTelemetryAdapter concurrency safety', () => {
  it('preserves events tracked while flush() POST is in flight', async () => {
    const clock = new FakeClock();
    const sentBatches: Array<{ readonly events: ReadonlyArray<{ readonly eventName: string }> }> = [];
    let releasePost!: () => void;
    const postGate = new Promise<void>((resolve) => {
      releasePost = resolve;
    });

    const apiClient = new ApiClient({
      apiBaseUrl: 'https://api.mockza.com',
      edition: 'glb',
      readAccessToken: () => 'token',
      fetchFn: async (_input, init) => {
        const parsed = JSON.parse(String(init?.body ?? '{}')) as {
          readonly events: ReadonlyArray<{ readonly eventName: string }>;
        };
        if (sentBatches.length === 0) {
          await postGate;
        }
        sentBatches.push(parsed);
        return new Response(JSON.stringify({ acceptedCount: parsed.events.length }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    const telemetry = new HttpTelemetryAdapter({ apiClient, clock, maxQueueSize: 2 });
    telemetry.track('first');
    telemetry.track('second');

    const flush1 = telemetry.flush();
    telemetry.track('during_flight');
    releasePost();

    const r1 = await flush1;
    expect(r1.ok && r1.value.acceptedCount).toBe(2);
    expect(telemetry.getBufferedCount()).toBe(1);

    const r2 = await telemetry.flush();
    expect(r2.ok && r2.value.acceptedCount).toBe(1);
    expect(sentBatches[1]?.events.map((e) => e.eventName)).toEqual(['during_flight']);
  });
});

describe('DI Composition Container & bootstrap-test', () => {
  it('provides all 12 dependencies via AppDependenciesProvider and useDeps()', () => {
    expect(ReexportedProvider).toBe(AppDependenciesProvider);
    expect(reexportedUseDeps).toBe(useDeps);

    const deps = createTestDependencies({ edition: 'irn' });
    const wrapper = ({ children }: { readonly children: ReactNode }) =>
      createElement(AppDependenciesProvider, { dependencies: deps, children });

    const { result } = renderHook(() => useDeps(), { wrapper });
    expect(result.current.edition).toBe('irn');
    expect(result.current.billing.currencyKind).toBe('IRR');
    expect(result.current.clock).toBe(deps.clock);
    expect(result.current.auth).toBe(deps.auth);
    expect(result.current.deviceSlots).toBe(deps.deviceSlots);
    expect(result.current.catalog).toBe(deps.catalog);
  });

  it('throws descriptive error if useDeps() is called outside AppDependenciesProvider', () => {
    expect(() => renderHook(() => useDeps())).toThrow(/AppDependenciesProvider/);
  });
});
