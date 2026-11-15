import { createHash } from 'node:crypto';

export const BANNED_CONTENT_PATTERNS: RegExp[] = [
  /\bcambridge\s+(ielts|esol|university\s+press)\b/i,
  /\bets\b/i,
  /\bpearson\s+plc\b/i,
  /\bbritish\s+council\b/i,
  /\bidp\s+education\b/i,
];

export function computeContentSha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function checkCleanRoomSafety(text: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const pattern of BANNED_CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(pattern.source);
    }
  }
  return { safe: violations.length === 0, violations };
}
