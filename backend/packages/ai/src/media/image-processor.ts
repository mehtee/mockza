import { EvaluationModelError } from '../errors.js';

export type SupportedImageFormat = 'png' | 'jpeg' | 'webp';

export interface StrippedImageResult {
  format: SupportedImageFormat;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  base64Data: string;
  dataUri: string;
  byteLength: number;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function detectImageContainer(buffer: Buffer): SupportedImageFormat | null {
  if (buffer.length < 12) return null;

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // WebP signature: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

/** Strips EXIF/APP1..APP15 & COM metadata markers from JPEG streams cleanly without recompression loss. */
function stripJpegMetadata(buffer: Buffer): Buffer {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return buffer;
  }
  const chunks: Buffer[] = [buffer.subarray(0, 2)]; // SOI FF D8
  let offset = 2;

  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      chunks.push(buffer.subarray(offset));
      break;
    }
    const marker = buffer[offset + 1] ?? 0;
    if (marker === 0xda) {
      // SOS (Start of Scan): compressed entropy stream continues until EOI
      chunks.push(buffer.subarray(offset));
      break;
    }
    if (marker === 0xd9) {
      chunks.push(buffer.subarray(offset, offset + 2));
      break;
    }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(buffer.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) break;

    const isMetadataMarker =
      (marker >= 0xe1 && marker <= 0xef) || // APP1 (EXIF/XMP), APP2 (ICC)..APP15
      marker === 0xfe; // COM comment
    if (!isMetadataMarker) {
      chunks.push(buffer.subarray(offset, offset + 2 + segmentLength));
    }
    offset += 2 + segmentLength;
  }

  return Buffer.concat(chunks);
}

const PNG_CRITICAL_AND_SAFE_CHUNKS = new Set([
  'IHDR',
  'PLTE',
  'IDAT',
  'IEND',
  'tRNS',
  'gAMA',
  'sRGB',
]);

/** Strips ancillary text/EXIF chunks (eXIf, tEXt, zTXt, iTXt, pHYs) from PNG buffers. */
function stripPngMetadata(buffer: Buffer): Buffer {
  if (buffer.length < 24) return buffer;
  const out: Buffer[] = [buffer.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const totalChunkLen = 12 + length;
    if (offset + totalChunkLen > buffer.length) break;
    if (PNG_CRITICAL_AND_SAFE_CHUNKS.has(type)) {
      out.push(buffer.subarray(offset, offset + totalChunkLen));
    }
    offset += totalChunkLen;
    if (type === 'IEND') break;
  }
  return out.length > 1 ? Buffer.concat(out) : buffer;
}

/** Strips EXIF/XMP chunks from WebP RIFF containers while keeping VP8/VP8L/VP8X/ANIM image chunks. */
function stripWebpMetadata(buffer: Buffer): Buffer {
  if (buffer.length < 16) return buffer;
  const keptChunks: Buffer[] = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const fourCc = buffer.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const paddedSize = chunkSize + (chunkSize % 2);
    const totalLen = 8 + paddedSize;
    if (offset + totalLen > buffer.length) break;
    if (fourCc !== 'EXIF' && fourCc !== 'XMP ') {
      keptChunks.push(buffer.subarray(offset, offset + totalLen));
    }
    offset += totalLen;
  }
  if (keptChunks.length === 0) return buffer;
  const payload = Buffer.concat(keptChunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + payload.length, 4);
  header.write('WEBP', 8, 'ascii');
  return Buffer.concat([header, payload]);
}

export function validateAndStripImageForModel(
  buffer: Buffer,
  maxBytes = MAX_IMAGE_BYTES,
): StrippedImageResult {
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw new EvaluationModelError(
      'image_invalid',
      `Image size (${buffer.length} bytes) must be 1..${maxBytes} bytes.`,
      false,
    );
  }

  const format = detectImageContainer(buffer);
  if (!format) {
    throw new EvaluationModelError(
      'image_invalid',
      'Image payload must be a valid PNG, JPEG, or WebP file.',
      false,
    );
  }

  const stripped =
    format === 'jpeg'
      ? stripJpegMetadata(buffer)
      : format === 'png'
        ? stripPngMetadata(buffer)
        : stripWebpMetadata(buffer);

  const mimeType: StrippedImageResult['mimeType'] =
    format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  const base64Data = stripped.toString('base64');
  return {
    format,
    mimeType,
    base64Data,
    dataUri: `data:${mimeType};base64,${base64Data}`,
    byteLength: stripped.length,
  };
}
