import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';
import type { APIRoute } from 'astro';
import { buildOgCardSvg } from '@/seo/geo-emitters';
import { getExamPillarsForBuild, getPublicSiteCopyForBuild } from '@/seo/public-catalog';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(4 + 4 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function buildFallbackSolidOgPng(width = 1200, height = 630): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0;
    const isAccentStripe = y >= 48 && y <= 60;
    for (let x = 0; x < width; x += 1) {
      const px = rowStart + 1 + x * 3;
      raw[px] = isAccentStripe ? 0x95 : 0x0b;
      raw[px + 1] = isAccentStripe ? 0x80 : 0x11;
      raw[px + 2] = isAccentStripe ? 0xff : 0x20;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', idat),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderSvgToPng(svg: string): Buffer {
  try {
    return execFileSync('convert', ['-background', '#0B1120', 'svg:-', 'png:-'], {
      input: svg,
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    return buildFallbackSolidOgPng();
  }
}

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
  const pngBytes = renderSvgToPng(svg);
  return new Response(new Uint8Array(pngBytes), {
    headers: { 'Content-Type': 'image/png' },
  });
};
