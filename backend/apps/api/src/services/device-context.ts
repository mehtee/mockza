import type { z } from '@hono/zod-openapi';
import type {
  AppSurfaceSchema,
  DeviceClientMetaSchema,
  DevicePlatformSchema,
  DeviceSlotKindSchema,
} from '@mockza/contracts';

export type DeviceSlotKind = z.infer<typeof DeviceSlotKindSchema>;
export type DevicePlatform = z.infer<typeof DevicePlatformSchema>;
export type AppSurface = z.infer<typeof AppSurfaceSchema>;
export type DeviceClientMeta = z.infer<typeof DeviceClientMetaSchema>;

export interface ResolvedDeviceContext {
  slotKind: DeviceSlotKind;
  platform: DevicePlatform;
  appSurface: AppSurface;
  deviceName: string;
  ipMasked: string | null;
  locationLabel: string;
  userAgent: string | null;
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (!clean) return false;
  if (
    clean === '::1' ||
    clean.startsWith('127.') ||
    clean.startsWith('10.') ||
    clean.startsWith('192.168.')
  ) {
    return true;
  }
  if (clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) {
    return true;
  }
  const match172 = /^172\.(\d+)\./.exec(clean);
  if (match172?.[1]) {
    const second = Number(match172[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

/** Masks an IPv4 or IPv6 address before persisting or returning it on session lists. */
export function maskIpAddress(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const clean = ip.replace(/^::ffff:/, '').trim();
  if (!clean || clean === 'direct-client') return null;

  if (clean.includes('.')) {
    const octets = clean.split('.');
    if (octets.length === 4) {
      return `${octets[0]}.${octets[1]}.${octets[2]}.***`;
    }
  }
  if (clean.includes(':')) {
    const groups = clean.split(':').filter((g) => g.length > 0);
    if (groups.length >= 2) {
      return `${groups.slice(0, 3).join(':')}:****`;
    }
  }
  return null;
}

function decodeGeoHeader(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return decodeURIComponent(trimmed).slice(0, 64);
  } catch {
    return trimmed.slice(0, 64);
  }
}

function formatTimezoneCity(timezone: string | null | undefined): string | null {
  if (!timezone) return null;
  const clean = timezone.trim();
  if (!clean?.includes('/')) return null;
  const city = clean.split('/').pop()?.replaceAll('_', ' ').trim();
  if (!city) return null;
  return `${city} (${clean})`;
}

/** Resolves a privacy-preserving human-readable location label from edge headers, timezone, and IP. */
export function resolveLocationLabel(params: {
  headers: Record<string, string | undefined>;
  clientIp?: string | null;
  timezone?: string | null;
}): string {
  const { headers, clientIp, timezone } = params;
  const city =
    decodeGeoHeader(headers['cf-ipcity']) ??
    decodeGeoHeader(headers['x-vercel-ip-city']) ??
    decodeGeoHeader(headers['x-geo-city']);
  const country =
    decodeGeoHeader(headers['cf-ipcountry']) ??
    decodeGeoHeader(headers['x-vercel-ip-country']) ??
    decodeGeoHeader(headers['x-geo-country']);

  if (city && country) return `${city}, ${country}`;
  if (country) return country;
  if (city) return city;

  const tzLabel = formatTimezoneCity(timezone);
  if (clientIp && isPrivateOrLoopbackIp(clientIp)) {
    return tzLabel ? `${tzLabel} · Local Network` : 'Local Network';
  }
  if (tzLabel) {
    return tzLabel;
  }
  return 'Approximate location';
}

function sanitizeDeviceName(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = Array.from(raw)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : null;
}

function inferBrowserAndOsName(ua: string): string {
  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Brave/i.test(ua)) browser = 'Brave';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\/|CriOS\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  let os = 'Web';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return `${browser} on ${os}`;
}

/**
 * Classifies caller device into strict slot buckets (`mobile` vs `desktop_web`)
 * while preventing browser User-Agent spoofing of desktop slots from mobile devices.
 */
export function resolveDeviceMetadata(params: {
  userAgent?: string;
  secChUaMobile?: string;
  clientMeta?: DeviceClientMeta;
}): ResolvedDeviceContext & {
  slotKind: DeviceSlotKind;
  platform: DevicePlatform;
  appSurface: AppSurface;
  deviceName: string;
} {
  const ua = params.userAgent?.trim() ?? '';
  const clientMeta = params.clientMeta;
  const customName = sanitizeDeviceName(clientMeta?.deviceName);

  const isBrowserUa = /Mozilla\/5\.0|AppleWebKit|Chrome\/|Firefox\/|Safari\/|Edg\//i.test(ua);
  const isMobileUa =
    params.secChUaMobile === '?1' ||
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isDesktopOsUa =
    isBrowserUa && !isMobileUa && /Windows NT|Macintosh|X11|Linux x86_64|CrOS|Wayland/i.test(ua);

  let slotKind: DeviceSlotKind;
  let platform: DevicePlatform;
  let appSurface: AppSurface;
  let defaultName: string;

  if (isBrowserUa && isMobileUa) {
    slotKind = 'mobile';
    platform = 'web_mobile';
    appSurface = clientMeta?.appSurface === 'web_app' ? 'web_app' : 'flutter_web';
    defaultName = inferBrowserAndOsName(ua);
  } else if (isDesktopOsUa) {
    slotKind = 'desktop_web';
    platform = 'web_desktop';
    appSurface = clientMeta?.appSurface === 'web_app' ? 'web_app' : 'flutter_web';
    defaultName = inferBrowserAndOsName(ua);
  } else {
    slotKind = clientMeta?.slotKind ?? 'mobile';
    platform = clientMeta?.platform ?? (slotKind === 'desktop_web' ? 'web_desktop' : 'unknown');
    appSurface = clientMeta?.appSurface ?? (slotKind === 'desktop_web' ? 'web_app' : 'flutter_app');
    if (platform === 'ios') defaultName = 'iPhone / iPad App';
    else if (platform === 'android') defaultName = 'Android App';
    else if (platform === 'web_mobile') defaultName = 'Mobile Browser';
    else if (slotKind === 'desktop_web') defaultName = 'Desktop Web Browser';
    else defaultName = 'Mobile Device';
  }

  return {
    slotKind,
    platform,
    appSurface,
    deviceName: customName ?? defaultName,
    ipMasked: null,
    locationLabel: 'Unknown location',
    userAgent: ua ? ua.slice(0, 240) : null,
  };
}
