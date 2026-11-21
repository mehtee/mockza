import { describe, expect, it } from 'vitest';
import { safeFetchReadableUrl, SafeUrlFetchError } from '../safe-url-fetch.js';

describe('Phase A1: SSRF firewall & safe URL extractor', () => {
  it('blocks loopback, RFC1918, cloud metadata, and video platforms', async () => {
    await expect(safeFetchReadableUrl('https://127.0.0.1/secret')).rejects.toMatchObject({
      code: 'SSRF_BLOCKED',
    });
    await expect(safeFetchReadableUrl('https://169.254.169.254/latest/meta-data')).rejects.toMatchObject({
      code: 'SSRF_BLOCKED',
    });
    await expect(safeFetchReadableUrl('https://www.youtube.com/watch?v=abc123')).rejects.toMatchObject({
      code: 'UNSUPPORTED_DROP_SOURCE',
    });
  });

  it('blocks DNS rebinding resolving an external hostname to RFC1918 / loopback', async () => {
    await expect(
      safeFetchReadableUrl('https://rebind.evil.test/article', {
        lookupFn: async () => [{ address: '10.0.0.12', family: 4 }],
      }),
    ).rejects.toMatchObject({ code: 'SSRF_BLOCKED' });

    await expect(
      safeFetchReadableUrl('https://rebind6.evil.test/article', {
        lookupFn: async () => [{ address: '::ffff:127.0.0.1', family: 6 }],
      }),
    ).rejects.toMatchObject({ code: 'SSRF_BLOCKED' });
  });

  it('rejects redirects leading to private IPs or video hosts and extracts readable HTML cleanly', async () => {
    await expect(
      safeFetchReadableUrl('https://news.example.com/start', {
        lookupFn: async () => [{ address: '93.184.216.34', family: 4 }],
        rawRequestFn: async () => ({
          statusCode: 302,
          headers: { location: 'https://youtu.be/dQw4w9WgXcQ' },
          body: Buffer.alloc(0),
        }),
      }),
    ).rejects.toBeInstanceOf(SafeUrlFetchError);

    const doc = await safeFetchReadableUrl('https://blog.example.com/ai-essay', {
      lookupFn: async () => [{ address: '93.184.216.34', family: 4 }],
      rawRequestFn: async ({ pinnedIp }) => {
        expect(pinnedIp).toBe('93.184.216.34');
        return {
          statusCode: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body: Buffer.from(
            '<html><head><title>AI Engineering</title><script>evil()</script></head><body><nav>Home</nav><article><p>Modern language models thrive on structured feedback loops and deliberate practice across varied social registers.</p></article></body></html>',
          ),
        };
      },
    });

    expect(doc.title).toBe('AI Engineering');
    expect(doc.extractedText).not.toContain('evil()');
    expect(doc.extractedText).not.toContain('Home');
    expect(doc.extractedText).toContain('structured feedback loops');
  });
});
