export const DROP_TEXT_MIN_CHARS = 40;
export const DROP_TEXT_MAX_CHARS = 15_000;
export const DROP_URL_MAX_HTML_BYTES = 1_572_864; // 1.5 MB
export const DROP_MAX_IMAGES = 4;
export const DROP_MAX_MEDIA_BYTES = 5 * 1024 * 1024; // 5 MB
export const DROP_MAX_AUDIO_SECONDS = 180;
export const SHIFTER_MIN_AUDIO_SECONDS = 5;
export const SHIFTER_MAX_AUDIO_SECONDS = 45;

const BLOCKED_VIDEO_STREAM_HOSTS = new Set<string>([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'vimeo.com',
  'player.vimeo.com',
  'tiktok.com',
  'www.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
  'instagram.com',
  'www.instagram.com',
  'twitch.tv',
  'www.twitch.tv',
  'dailymotion.com',
  'www.dailymotion.com',
  'open.spotify.com',
  'soundcloud.com',
]);

const BLOCKED_STREAM_EXTENSIONS = ['.m3u8', '.mpd', '.mp4', '.mov', '.avi', '.mkv', '.webm'];

const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
]);

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

/**
 * Checks if a hostname or literal IP resolves to loopback, RFC1918, link-local,
 * CGNAT, or blocked internal domains before HTTP connection.
 */
export function isPrivateOrInternalHost(rawHostname: string): boolean {
  const host = normalizeHostname(rawHostname);
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }

  // IPv6 literals
  if (host.includes(':')) {
    if (host === '::' || host === '::1') return true;
    const lowered = host.toLowerCase();
    if (
      lowered.startsWith('fe80:') ||
      lowered.startsWith('fc') ||
      lowered.startsWith('fd') ||
      lowered.startsWith('::ffff:127.') ||
      lowered.startsWith('::ffff:10.') ||
      lowered.startsWith('::ffff:192.168.') ||
      lowered.startsWith('::ffff:169.254.')
    ) {
      return true;
    }
    return false;
  }

  // IPv4 literal check
  const parts = host.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))) {
    const nums = parts.map(Number);
    if (nums.some((n) => n < 0 || n > 255)) return true;
    const [rawA, rawB] = nums;
    const a = rawA ?? 0;
    const b = rawB ?? 0;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }

  return false;
}

export function isBlockedVideoHost(rawHostname: string): boolean {
  const host = normalizeHostname(rawHostname);
  if (BLOCKED_VIDEO_STREAM_HOSTS.has(host)) return true;
  for (const blocked of BLOCKED_VIDEO_STREAM_HOSTS) {
    if (host.endsWith(`.${blocked}`)) {
      return true;
    }
  }
  return false;
}

export interface DropUrlValidationResult {
  ok: boolean;
  code?: 'INVALID_DROP_URL' | 'UNSUPPORTED_DROP_SOURCE' | 'SSRF_BLOCKED_HOST';
  reason?: string;
  normalizedUrl?: string;
  host?: string;
}

export function validateDropUrlPreFlight(
  rawUrl: string,
  options: { allowHttpInDev?: boolean } = {},
): DropUrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) {
    return { ok: false, code: 'INVALID_DROP_URL', reason: 'Enter a valid public URL.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, code: 'INVALID_DROP_URL', reason: 'Malformed URL format.' };
  }

  const schemeOk =
    parsed.protocol === 'https:' || (Boolean(options.allowHttpInDev) && parsed.protocol === 'http:');
  if (!schemeOk) {
    return {
      ok: false,
      code: 'INVALID_DROP_URL',
      reason: 'Only HTTPS public links are accepted.',
    };
  }

  if (parsed.port && parsed.port !== '443' && !(options.allowHttpInDev && parsed.port === '80')) {
    return {
      ok: false,
      code: 'SSRF_BLOCKED_HOST',
      reason: 'Custom ports are not permitted.',
    };
  }

  const host = normalizeHostname(parsed.hostname);
  if (!options.allowHttpInDev && isPrivateOrInternalHost(host)) {
    return {
      ok: false,
      code: 'SSRF_BLOCKED_HOST',
      reason: 'Private or internal network addresses are blocked.',
    };
  }

  if (options.allowHttpInDev && isPrivateOrInternalHost(host) && host !== '127.0.0.1' && host !== 'localhost') {
    return {
      ok: false,
      code: 'SSRF_BLOCKED_HOST',
      reason: 'Private or internal network addresses are blocked.',
    };
  }

  if (isBlockedVideoHost(host)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_DROP_SOURCE',
      reason: 'Video platforms are not supported. Share the article URL, text excerpt, or a screenshot instead.',
    };
  }

  const lowerPath = parsed.pathname.toLowerCase();
  if (BLOCKED_STREAM_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))) {
    return {
      ok: false,
      code: 'UNSUPPORTED_DROP_SOURCE',
      reason: 'Video and streaming manifests (.m3u8/.mpd/.mp4) are not supported.',
    };
  }

  return {
    ok: true,
    normalizedUrl: parsed.toString(),
    host,
  };
}

export interface DropBoundsCheckResult {
  ok: boolean;
  code?: string;
  reason?: string;
  normalizedText?: string;
}

export function validateDropTextSnippet(rawText: string): DropBoundsCheckResult {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  if (normalized.length < DROP_TEXT_MIN_CHARS) {
    return {
      ok: false,
      code: 'DROP_TEXT_TOO_SHORT',
      reason: `Provide at least ${DROP_TEXT_MIN_CHARS} characters of English text.`,
    };
  }
  if (normalized.length > DROP_TEXT_MAX_CHARS) {
    return {
      ok: false,
      code: 'DROP_TEXT_TOO_LONG',
      reason: `Text limit is ${DROP_TEXT_MAX_CHARS} UTF-16 characters.`,
    };
  }
  return { ok: true, normalizedText: normalized };
}

export function validateDropImagesMetadata(
  images: ReadonlyArray<{ contentType: string; byteLength: number }>,
): DropBoundsCheckResult {
  if (images.length === 0 || images.length > DROP_MAX_IMAGES) {
    return {
      ok: false,
      code: 'DROP_IMAGE_COUNT_INVALID',
      reason: `Attach between 1 and ${DROP_MAX_IMAGES} images.`,
    };
  }
  for (const img of images) {
    if (!ALLOWED_IMAGE_MIMES.has(img.contentType.toLowerCase())) {
      return {
        ok: false,
        code: 'UNSUPPORTED_IMAGE_MIME',
        reason: 'Only PNG, JPEG, and WebP images are supported.',
      };
    }
    if (img.byteLength <= 0 || img.byteLength > DROP_MAX_MEDIA_BYTES) {
      return {
        ok: false,
        code: 'DROP_MEDIA_TOO_LARGE',
        reason: 'Each image must be <= 5 MB.',
      };
    }
  }
  return { ok: true };
}

export function validateBoundedAudioInput(params: {
  mode: 'shifter' | 'drop';
  contentType: string;
  byteLength: number;
  durationSeconds: number;
}): DropBoundsCheckResult {
  const baseMime = params.contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_AUDIO_MIMES.has(baseMime)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_AUDIO_MIME',
      reason: 'Unsupported audio container format.',
    };
  }
  if (params.byteLength <= 0 || params.byteLength > DROP_MAX_MEDIA_BYTES) {
    return {
      ok: false,
      code: 'DROP_MEDIA_TOO_LARGE',
      reason: 'Audio upload must be <= 5 MB.',
    };
  }
  if (params.mode === 'shifter') {
    if (params.durationSeconds < SHIFTER_MIN_AUDIO_SECONDS) {
      return {
        ok: false,
        code: 'SHIFTER_AUDIO_TOO_SHORT',
        reason: `Speak for at least ${SHIFTER_MIN_AUDIO_SECONDS} seconds.`,
      };
    }
    if (params.durationSeconds > SHIFTER_MAX_AUDIO_SECONDS) {
      return {
        ok: false,
        code: 'SHIFTER_AUDIO_TOO_LONG',
        reason: `Register Shifter clips are capped at ${SHIFTER_MAX_AUDIO_SECONDS} seconds.`,
      };
    }
  } else {
    if (params.durationSeconds <= 0) {
      return {
        ok: false,
        code: 'DROP_AUDIO_EMPTY',
        reason: 'Audio duration must be positive.',
      };
    }
    if (params.durationSeconds > DROP_MAX_AUDIO_SECONDS) {
      return {
        ok: false,
        code: 'DROP_AUDIO_TOO_LONG',
        reason: `Dropped audio cannot exceed ${DROP_MAX_AUDIO_SECONDS} seconds.`,
      };
    }
  }
  return { ok: true };
}
