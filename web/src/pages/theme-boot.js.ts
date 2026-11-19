import type { APIRoute } from 'astro';
import { ZERO_FOUC_THEME_BOOT_SCRIPT } from '@/theme/theme-controller';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(ZERO_FOUC_THEME_BOOT_SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
    },
  });
