import type { APIRoute } from 'astro';
import { getActiveEditionCode } from '@/edition/edition-config';
import { buildToeflConverterMarkdown } from '@/seo/geo-emitters';

export const GET: APIRoute = () => {
  return new Response(buildToeflConverterMarkdown(getActiveEditionCode()), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
