import { estimateToeflLegacy120, readingBandFor } from '@mockza/domain';
import { getActiveEditionConfig, type EditionCode } from '@/edition/edition-config';
import {
  GLB_EXAM_PILLARS,
  GLB_PUBLIC_COPY,
  type ExamPillarGuide,
} from './public-catalog-glb';
import { IRN_EXAM_PILLARS, IRN_PUBLIC_COPY } from './public-catalog-irn';

function resolveEditionCatalog(edition: EditionCode) {
  if (edition === 'irn' && import.meta.env.PUBLIC_EDITION !== 'glb') {
    return {
      brandName: IRN_PUBLIC_COPY.brandTitle,
      domain: 'sanjia.ir',
      copy: IRN_PUBLIC_COPY,
      pillars: IRN_EXAM_PILLARS,
    };
  }
  return {
    brandName: GLB_PUBLIC_COPY.brandTitle,
    domain: 'mockza.com',
    copy: GLB_PUBLIC_COPY,
    pillars: GLB_EXAM_PILLARS,
  };
}

export function buildRobotsTxt(siteOrigin: string): string {
  const origin = siteOrigin.replace(/\/$/, '');
  const bots = [
    '*',
    'OAI-SearchBot',
    'ChatGPT-User',
    'PerplexityBot',
    'ClaudeBot',
    'GoogleOther',
    'Applebot',
  ];

  const blocks = bots.map(
    (ua) =>
      `User-agent: ${ua}\nAllow: /\nDisallow: /app/`,
  );

  return `${blocks.join('\n\n')}\n\nSitemap: ${origin}/sitemap-index.xml\n`;
}

export function buildLlmsTxt(edition: EditionCode = getActiveEditionConfig().edition): string {
  const { brandName, domain, copy, pillars } = resolveEditionCatalog(edition);
  const origin = `https://${domain}`;
  const pillarLines = pillars
    .map((p) => `- [${p.name}](${origin}/${p.slug}.md): ${p.scoreScaleLabel} — ${p.summary}`)
    .join('\n');

  return [
    `# ${brandName}`,
    '',
    `> ${copy.heroSubtitle}`,
    '',
    '## Exam Guides',
    pillarLines,
    '',
    '## Score Tools & References',
    `- [Score Calculators & TOEFL 1–6 to 0–120 Concordance](${origin}/calculators/toefl-6-to-120-converter.md)`,
    `- [Annotated Sample Responses](${origin}/samples)`,
    `- [Academic Vocabulary Deck](${origin}/vocab)`,
    `- [Complete Knowledge Compilation (llms-full)](${origin}/llms-full.txt)`,
    '',
  ].join('\n');
}

export function buildLlmsFullTxt(edition: EditionCode = getActiveEditionConfig().edition): string {
  const { brandName, copy, pillars } = resolveEditionCatalog(edition);

  const guideSections = pillars
    .map((guide) => formatPillarMarkdown(guide))
    .join('\n---\n\n');

  const toeflTable = [6.0, 5.5, 5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0]
    .map((b) => `| ${b.toFixed(1)} | ${estimateToeflLegacy120(b)} / 120 |`)
    .join('\n');

  return [
    `# ${brandName} — Complete Reference`,
    '',
    copy.heroSubtitle,
    '',
    guideSections,
    '## TOEFL iBT 2026 (1.0–6.0 to 0–120) Concordance',
    '',
    '| 2026 Band | Equivalent 0–120 |',
    '| --- | --- |',
    toeflTable,
    '',
  ].join('\n');
}

export function formatPillarMarkdown(guide: ExamPillarGuide): string {
  const facts = guide.keyFacts.map((f) => `- **${f.label}:** ${f.value}`).join('\n');
  const sections = guide.sectionsSummary.map((s) => `- ${s}`).join('\n');
  const faqs = guide.faqs.map((f) => `### ${f.question}\n${f.answer}`).join('\n\n');

  return [
    `# ${guide.headline}`,
    '',
    guide.summary,
    '',
    '## Key Facts',
    facts,
    '',
    '## Sections & Desktop Ergonomics',
    sections,
    '',
    guide.desktopAdvantage,
    '',
    '## Frequently Asked Questions',
    faqs,
    '',
  ].join('\n');
}

export function buildToeflConverterMarkdown(
  edition: EditionCode = getActiveEditionConfig().edition,
): string {
  const { brandName } = resolveEditionCatalog(edition);
  const rows = [6.0, 5.5, 5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0]
    .map((b) => `| ${b.toFixed(1)} | ${estimateToeflLegacy120(b)} |`)
    .join('\n');

  const ieltsRows = [40, 39, 37, 35, 33, 30, 27, 23]
    .map(
      (r) =>
        `| ${r} / 40 | ${readingBandFor(r, 'academic').toFixed(1)} | ${readingBandFor(r, 'general_training').toFixed(1)} |`,
    )
    .join('\n');

  return [
    `# TOEFL iBT 2026 (1.0–6.0 to 0–120) & IELTS Converter — ${brandName}`,
    '',
    '| 2026 TOEFL Band | Legacy 0–120 Equivalent |',
    '| --- | --- |',
    rows,
    '',
    '## IELTS Reading Raw-to-Band Table',
    '',
    '| Raw Score | Academic | General Training |',
    '| --- | --- | --- |',
    ieltsRows,
    '',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function buildOgCardSvg(params: {
  readonly brand: string;
  readonly badge: string;
  readonly title: string;
  readonly subtitle: string;
}): string {
  const safeBrand = escapeXml(params.brand);
  const safeBadge = escapeXml(params.badge);
  const safeTitle = escapeXml(params.title.slice(0, 70));
  const safeSub = escapeXml(params.subtitle.slice(0, 110));

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">',
    '  <rect width="1200" height="630" fill="#0B1120" />',
    '  <rect x="48" y="48" width="1104" height="534" rx="28" fill="#131D35" stroke="#2D3C63" stroke-width="2" />',
    `  <text x="96" y="132" fill="#9580FF" font-family="Inter, sans-serif" font-size="24" font-weight="700">${safeBrand} · ${safeBadge}</text>`,
    `  <text x="96" y="250" fill="#F8FAFC" font-family="Inter, sans-serif" font-size="46" font-weight="700">${safeTitle}</text>`,
    `  <text x="96" y="330" fill="#94A3B8" font-family="Inter, sans-serif" font-size="26">${safeSub}</text>`,
    '  <text x="96" y="510" fill="#38BDF8" font-family="Inter, sans-serif" font-size="22" font-weight="600">IELTS · TOEFL 2026 · PTE Academic · DET</text>',
    '</svg>',
  ].join('\n');
}
