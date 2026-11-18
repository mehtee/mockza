import type { APIRoute } from 'astro';
import { getActiveEditionConfig } from '@/edition/edition-config';
import { buildRobotsTxt } from '@/seo/geo-emitters';

export const GET: APIRoute = ({ site }) => {
  const cfg = getActiveEditionConfig();
  const origin = site ? site.toString() : `https://${cfg.domain}`;
  return new Response(buildRobotsTxt(origin), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
