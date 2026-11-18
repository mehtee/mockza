import type { APIRoute } from 'astro';
import { getActiveEditionCode } from '@/edition/edition-config';
import { buildLlmsTxt } from '@/seo/geo-emitters';

export const GET: APIRoute = () => {
  return new Response(buildLlmsTxt(getActiveEditionCode()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
