import type { APIRoute } from 'astro';
import { formatPillarMarkdown } from '@/seo/geo-emitters';
import { getExamPillarsForBuild } from '@/seo/public-catalog';

export function getStaticPaths() {
  return getExamPillarsForBuild().map((guide) => ({
    params: { examSlug: guide.slug },
    props: { guide },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const guide = props['guide'];
  return new Response(formatPillarMarkdown(guide), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
