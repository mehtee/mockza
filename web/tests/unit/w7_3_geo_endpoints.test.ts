import { describe, expect, it } from 'vitest';
import {
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildOgCardSvg,
  buildRobotsTxt,
  buildToeflConverterMarkdown,
} from '@/seo/geo-emitters';

describe('W7.3 GEO, robots.txt, llms.txt, Markdown Twins & OG SVG', () => {
  it('emits AI search/citation bot rules and blocks private /app/ state in robots.txt', () => {
    const robots = buildRobotsTxt('https://mockza.com');
    for (const bot of [
      'OAI-SearchBot',
      'ChatGPT-User',
      'PerplexityBot',
      'ClaudeBot',
      'GoogleOther',
      'Applebot',
    ]) {
      expect(robots).toContain(`User-agent: ${bot}`);
    }
    expect(robots).toContain('Disallow: /app/');
    expect(robots).toContain('Sitemap: https://mockza.com/sitemap-index.xml');
  });

  it('generates llmstxt.org compliant indexes and clean GLB content without IRN leakage', () => {
    const glbLlms = buildLlmsTxt('glb');
    expect(glbLlms).toContain('# Mockza');
    expect(glbLlms).toContain('https://mockza.com/toefl-ibt.md');
    expect(glbLlms.toLowerCase()).not.toContain('sanjia');

    const glbFull = buildLlmsFullTxt('glb');
    expect(glbFull).toContain('| 5.0 | 100 / 120 |');
    expect(glbFull.toLowerCase()).not.toContain('sanjia');

    const irnLlms = buildLlmsTxt('irn');
    expect(irnLlms).toContain('sanjia.ir');
  });

  it('builds Markdown converter twins and valid 1200x630 XML-escaped OG SVG cards', () => {
    const md = buildToeflConverterMarkdown('glb');
    expect(md).toContain('| 5.5 | 110 |');
    expect(md).toContain('| 30 / 40 | 7.0 | 6.0 |');

    const svg = buildOgCardSvg({
      brand: 'Mockza',
      badge: 'Band 0–9',
      title: 'IELTS & TOEFL <Desktop> Hub',
      subtitle: 'Split-pane & offline simulator',
    });
    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain('&lt;Desktop&gt;');
  });
});
