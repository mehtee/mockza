import type { APIRoute } from 'astro';
import { buildOgCardSvg } from '@/seo/geo-emitters';
import { getExamPillarsForBuild, getPublicSiteCopyForBuild } from '@/seo/public-catalog';

export function getStaticPaths() {
  const copy = getPublicSiteCopyForBuild();
  const pillars = getExamPillarsForBuild();

  return [
    {
      params: { slug: 'home' },
      props: {
        brand: copy.brandTitle,
        badge: 'Desktop Simulator',
        title: copy.heroHeadline,
        subtitle: copy.heroSubtitle,
      },
    },
    ...pillars.map((p) => ({
      params: { slug: p.slug },
      props: {
        brand: copy.brandTitle,
        badge: p.scoreScaleLabel,
        title: p.name,
        subtitle: p.summary,
      },
    })),
  ];
}

export const GET: APIRoute = ({ props }) => {
  const svg = buildOgCardSvg({
    brand: String(props['brand']),
    badge: String(props['badge']),
    title: String(props['title']),
    subtitle: String(props['subtitle']),
  });
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
  });
};
