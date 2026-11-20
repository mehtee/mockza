import type { APIRoute } from 'astro';
import { getActiveEditionCode } from '@/edition/edition-config';
import { buildLlmsTxt } from '@/seo/geo-emitters';

export const GET: APIRoute = () => {
  const edition = getActiveEditionCode();
  const overview = edition === 'irn'
    ? [
        '## نمونهٔ گزارش و بازخورد',
        '- خواندن: پاسخ پذیرفته‌شده و جملهٔ شاهد را کنار هم ببین. در تمرین کوتاه، پاسخ و شاهد جداگانه بررسی می‌شوند.',
        '- شنیدن: تغییر یک زمان یا مکان را پیدا کن، جملهٔ مربوط را دوباره بشنو و متن را بخوان.',
        '- نوشتن: یادداشت‌های نمونه را روی متن ببین و عبارت‌ها را با پیشنهادهای بازنویسی مقایسه کن.',
        '- صحبت کردن: صدای نمونه را بشنو و بخش مرتبط با هر یادداشت را دوباره پخش کن.',
        '- [مشاهدهٔ نمونهٔ چهار مهارت](https://sanjia.ir/#sample-report)',
      ]
    : [
        '## Sample reports and feedback',
        '- Reading pairs an accepted answer with its supporting line. The short drill grades the answer and evidence independently.',
        '- Listening replays the line that changes an earlier time or place and presents its transcript.',
        '- Writing marks specific phrases and shows revisions alongside the sample.',
        '- Speaking connects feedback to moments in a playable recording.',
        '- [Open the four-skill sample](https://mockza.com/#sample-report)',
      ];
  return new Response(`${buildLlmsTxt(edition)}\n${overview.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
