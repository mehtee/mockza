import { describe, expect, it, vi } from 'vitest';
import { validateAndStripImageForModel } from '../media/image-processor.js';
import {
  OpenRouterAlphaClient,
  SlidingWindowCircuitBreaker,
} from '../models/openrouter-alpha.js';
import { OpenRouterClient } from '../models/openrouter.js';
import { maskPiiObject } from '../observability/langfuse.js';

describe('Phase A1: OpenRouterAlphaClient + Circuit Breaker + Media/Redaction', () => {
  it('opens circuit breaker after 5 failures within 60s and swaps to GA fallback for 120s', async () => {
    let nowMs = 1_000_000;
    const breaker = new SlidingWindowCircuitBreaker({
      failureThreshold: 5,
      windowMs: 60_000,
      openDurationMs: 120_000,
      now: () => nowMs,
    });

    const gaClient = {
      createChatCompletion: vi.fn(async () => ({
        id: 'ga-fallback-1',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                answers: {
                  conditional_avoidance: { value: true, confidence: 0.92 },
                },
              }),
            },
            finish_reason: 'stop',
          },
        ],
      })),
    } as unknown as OpenRouterClient;

    const alphaFetch = vi.fn(async () => new Response('upstream error', { status: 503 }));
    const client = new OpenRouterAlphaClient({
      apiKey: 'test-key',
      decisionBreaker: breaker,
      gaFallbackClient: gaClient,
      fetchFn: alphaFetch as unknown as typeof fetch,
    });

    for (let i = 0; i < 5; i += 1) {
      const res = await client.callDecisionsApi({
        messages: [{ role: 'user', content: 'Evaluate grammar essay sample.' }],
        questions: [
          {
            id: 'conditional_avoidance',
            kind: 'noul',
            prompt: 'Did the writer avoid conditional structures?',
          },
        ],
      });
      expect(res.usedFallback).toBe(true);
      expect(res.modelUsed).toBe('deepseek/deepseek-v4.1-flash-1017');
      expect(res.outcomes['conditional_avoidance']?.boolValue).toBe(true);
      nowMs += 1_000;
    }

    expect(breaker.getState().open).toBe(true);
    expect(alphaFetch).toHaveBeenCalledTimes(5);

    // 6th call skips alpha endpoint completely while circuit is open
    const fastFallback = await client.callDecisionsApi({
      messages: [{ role: 'user', content: 'Evaluate grammar essay sample.' }],
      questions: [
        {
          id: 'conditional_avoidance',
          kind: 'noul',
          prompt: 'Did the writer avoid conditional structures?',
        },
      ],
    });
    expect(fastFallback.usedFallback).toBe(true);
    expect(fastFallback.fallbackReason).toBe('circuit_open');
    expect(alphaFetch).toHaveBeenCalledTimes(5);
  });

  it('rejects audio parts on cloudflare/clairic extraction API', async () => {
    const client = new OpenRouterAlphaClient({ apiKey: 'test-key' });
    await expect(
      client.callExtractionsApi({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract' },
              { type: 'input_audio', input_audio: { data: 'AAAA', format: 'm4a' } },
            ],
          },
        ],
        fields: [{ name: 'expressions', description: 'Idioms', kind: 'list' }],
      }),
    ).rejects.toThrow(/never audio/i);
  });

  it('appends :floor suffix ONLY when routingTier is flex', async () => {
    const capturedModels: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (_url, init) => {
      const parsed = JSON.parse(String(init?.body ?? '{}')) as { model: string };
      capturedModels.push(parsed.model);
      return new Response(
        JSON.stringify({
          id: 'ok',
          choices: [{ message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    try {
      const client = new OpenRouterClient({ apiKey: 'test-key' });
      await client.createChatCompletion({
        model: 'google/gemini-3.1-flash-lite',
        messages: [{ role: 'user', content: 'hi' }],
        routingTier: 'flex',
      });
      await client.createChatCompletion({
        model: 'google/gemini-3.1-flash-lite',
        messages: [{ role: 'user', content: 'hi' }],
        routingTier: 'standard',
      });
      expect(capturedModels).toEqual([
        'google/gemini-3.1-flash-lite:floor',
        'google/gemini-3.1-flash-lite',
      ]);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('strips JPEG APP1 EXIF metadata and blocks invalid polyglots', () => {
    const jpegWithExif = Buffer.concat([
      Buffer.from([0xff, 0xd8]), // SOI
      Buffer.from([0xff, 0xe1, 0x00, 0x0c]), // APP1 length 12 (includes 2-byte length)
      Buffer.from('Exif\0\0GPS!', 'ascii'), // 10 bytes payload -> total 12 bytes after marker
      Buffer.from([0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]), // SOS
      Buffer.from([0x11, 0x22, 0xff, 0xd9]), // scan data + EOI
    ]);
    const stripped = validateAndStripImageForModel(jpegWithExif);
    expect(stripped.format).toBe('jpeg');
    expect(stripped.mimeType).toBe('image/jpeg');
    expect(Buffer.from(stripped.base64Data, 'base64').includes('Exif')).toBe(false);

    expect(() => validateAndStripImageForModel(Buffer.from('<svg onload=alert(1)>'))).toThrow();
  });

  it('masks dropped private text & media payloads from Langfuse traces', () => {
    const redacted = maskPiiObject({
      droppedText: 'A'.repeat(120),
      image_url: 'data:image/png;base64,iVBORw0KGgoAAA',
      email: 'learner@example.com',
    });
    expect(redacted.droppedText).toBe('[PRIVATE_CONTENT_REDACTED]');
    expect(redacted.image_url).toBe('[MEDIA_DATA_URI_REDACTED]');
    expect(redacted.email).toBe('[REDACTED_EMAIL]');
  });
});
