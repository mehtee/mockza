/// Validation outcome returned cleanly by [DropInputPolicy].
class DropBoundsCheckResult {
  /// Creates a [DropBoundsCheckResult].
  const new({
    required this.ok,
    this.code,
    this.reason,
    this.normalizedText,
  });

  /// Whether validation succeeded.
  final bool ok;

  /// Machine-readable error code when rejected.
  final String? code;

  /// Human-readable rejection reason.
  final String? reason;

  /// Normalized bounded text snippet when valid.
  final String? normalizedText;
}

/// Pre-flight validation result for submitted article/media URLs.
class DropUrlValidationResult {
  /// Creates a [DropUrlValidationResult].
  const new({
    required this.ok,
    this.code,
    this.reason,
    this.normalizedUrl,
    this.host,
  });

  /// Whether URL passed safety and policy checks.
  final bool ok;

  /// Machine-readable rejection code.
  final String? code;

  /// Human-readable rejection explanation.
  final String? reason;

  /// Trimmed URL string when valid.
  final String? normalizedUrl;

  /// Normalized hostname.
  final String? host;
}

/// Client/server shared bounded validation rules mirroring `drop-input-policy.ts`.
abstract final class DropInputPolicy {
  /// Minimum UTF-16 length for pasted text snippets.
  static const int textMinChars = 40;

  /// Maximum UTF-16 length for pasted/extracted text snippets.
  static const int textMaxChars = 15000;

  /// Maximum remote HTML download size (1.5 MB).
  static const int urlMaxHtmlBytes = 1572864;

  /// Maximum images per Mode B screenshot drop.
  static const int maxImages = 4;

  /// Maximum media byte size (5 MB).
  static const int maxMediaBytes = 5 * 1024 * 1024;

  /// Maximum bounded audio duration for Mode C Drop (180s).
  static const int maxDropAudioSeconds = 180;

  /// Minimum Register Shifter clip duration (5s).
  static const int minShifterAudioSeconds = 5;

  /// Maximum Register Shifter clip duration (45s).
  static const int maxShifterAudioSeconds = 45;

  static const Set<String> _blockedVideoHosts = <String>{
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
  };

  static const List<String> _blockedStreamExts = <String>[
    '.m3u8',
    '.mpd',
    '.mp4',
    '.mov',
    '.avi',
    '.mkv',
    '.webm',
  ];

  static const Set<String> _allowedImageMimes = <String>{
    'image/png',
    'image/jpeg',
    'image/webp',
  };

  static const Set<String> _allowedAudioMimes = <String>{
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
  };

  /// Normalizes hostnames consistently with TS server validator.
  static String normalizeHostname(String hostname) {
    var out = hostname.trim().toLowerCase();
    if (out.startsWith('[')) out = out.substring(1);
    if (out.endsWith(']')) out = out.substring(0, out.length - 1);
    if (out.endsWith('.')) out = out.substring(0, out.length - 1);
    return out;
  }

  /// Checks whether [rawHostname] points to loopback, RFC1918, link-local, or CGNAT.
  static bool isPrivateOrInternalHost(String rawHostname) {
    final host = normalizeHostname(rawHostname);
    if (host.isEmpty) return true;
    if (host == 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        host == 'metadata.google.internal') {
      return true;
    }

    if (host.contains(':')) {
      if (host == '::' || host == '::1') return true;
      if (host.startsWith('fe80:') ||
          host.startsWith('fc') ||
          host.startsWith('fd') ||
          host.startsWith('::ffff:127.') ||
          host.startsWith('::ffff:10.') ||
          host.startsWith('::ffff:192.168.') ||
          host.startsWith('::ffff:169.254.')) {
        return true;
      }
      return false;
    }

    final parts = host.split('.');
    if (parts.length == 4 &&
        parts.every((p) => RegExp(r'^\d{1,3}$').hasMatch(p))) {
      final nums = parts.map(int.parse).toList(growable: false);
      if (nums.any((n) => n < 0 || n > 255)) return true;
      final a = nums[0];
      final b = nums[1];
      if (a == 0 || a == 10 || a == 127) return true;
      if (a == 169 && b == 254) return true;
      if (a == 172 && b >= 16 && b <= 31) return true;
      if (a == 192 && b == 168) return true;
      if (a == 100 && b >= 64 && b <= 127) return true;
      if (a >= 224) return true;
    }

    return false;
  }

  /// Checks whether [rawHostname] is a blocked video/streaming platform domain.
  static bool isBlockedVideoHost(String rawHostname) {
    final host = normalizeHostname(rawHostname);
    if (_blockedVideoHosts.contains(host)) return true;
    for (final blocked in _blockedVideoHosts) {
      if (host.endsWith('.$blocked')) return true;
    }
    return false;
  }

  /// Validates an article/content URL pre-flight matching TS `validateDropUrlPreFlight`.
  static DropUrlValidationResult validateUrlPreFlight(
    String rawUrl, {
    bool allowHttpInDev = false,
  }) {
    final trimmed = rawUrl.trim();
    if (trimmed.isEmpty || trimmed.length > 2048) {
      return const DropUrlValidationResult(
        ok: false,
        code: 'INVALID_DROP_URL',
        reason: 'Enter a valid public URL.',
      );
    }

    final parsed = Uri.tryParse(trimmed);
    if (parsed == null || !parsed.hasScheme || parsed.host.isEmpty) {
      return const DropUrlValidationResult(
        ok: false,
        code: 'INVALID_DROP_URL',
        reason: 'Malformed URL format.',
      );
    }

    final schemeOk =
        parsed.scheme == 'https' || (allowHttpInDev && parsed.scheme == 'http');
    if (!schemeOk) {
      return const DropUrlValidationResult(
        ok: false,
        code: 'INVALID_DROP_URL',
        reason: 'Only HTTPS public links are accepted.',
      );
    }

    if (parsed.hasPort &&
        parsed.port != 443 &&
        !(allowHttpInDev && parsed.port == 80)) {
      return const DropUrlValidationResult(
        ok: false,
        code: 'SSRF_BLOCKED_HOST',
        reason: 'Custom ports are not permitted.',
      );
    }

    final host = normalizeHostname(parsed.host);
    if (!allowHttpInDev && isPrivateOrInternalHost(host)) {
      return const DropUrlValidationResult(
        ok: false,
        code: 'SSRF_BLOCKED_HOST',
        reason: 'Private or internal network addresses are blocked.',
      );
    }
    if (allowHttpInDev &&
        isPrivateOrInternalHost(host) &&
        host != '127.0.0.1' &&
        host != 'localhost') {
      return const DropUrlValidationResult(
        ok: false,
        code: 'SSRF_BLOCKED_HOST',
        reason: 'Private or internal network addresses are blocked.',
      );
    }

    if (isBlockedVideoHost(host)) {
      return const DropUrlValidationResult(
        ok: false,
        code: 'UNSUPPORTED_DROP_SOURCE',
        reason: 'Video platforms are not supported. Share the article URL, text excerpt, or a screenshot instead.',
      );
    }

    final lowerPath = parsed.path.toLowerCase();
    if (_blockedStreamExts.any(lowerPath.endsWith)) {
      return const DropUrlValidationResult(
        ok: false,
        code: 'UNSUPPORTED_DROP_SOURCE',
        reason: 'Video and streaming manifests (.m3u8/.mpd/.mp4) are not supported.',
      );
    }

    return DropUrlValidationResult(
      ok: true,
      normalizedUrl: parsed.toString(),
      host: host,
    );
  }

  /// Validates pasted article or excerpt text snippet.
  static DropBoundsCheckResult validateTextSnippet(String rawText) {
    final normalized = rawText.replaceAll('\r\n', '\n').trim();
    if (normalized.length < textMinChars) {
      return const DropBoundsCheckResult(
        ok: false,
        code: 'DROP_TEXT_TOO_SHORT',
        reason: 'Provide at least $textMinChars characters of English text.',
      );
    }
    if (normalized.length > textMaxChars) {
      return const DropBoundsCheckResult(
        ok: false,
        code: 'DROP_TEXT_TOO_LONG',
        reason: 'Text limit is $textMaxChars UTF-16 characters.',
      );
    }
    return DropBoundsCheckResult(ok: true, normalizedText: normalized);
  }

  /// Validates attached image MIME types and size limits.
  static DropBoundsCheckResult validateImagesMetadata(
    List<({String contentType, int byteLength})> images,
  ) {
    if (images.isEmpty || images.length > maxImages) {
      return const DropBoundsCheckResult(
        ok: false,
        code: 'DROP_IMAGE_COUNT_INVALID',
        reason: 'Attach between 1 and $maxImages images.',
      );
    }
    for (final img in images) {
      if (!_allowedImageMimes.contains(img.contentType.toLowerCase())) {
        return const DropBoundsCheckResult(
          ok: false,
          code: 'UNSUPPORTED_IMAGE_MIME',
          reason: 'Only PNG, JPEG, and WebP images are supported.',
        );
      }
      if (img.byteLength <= 0 || img.byteLength > maxMediaBytes) {
        return const DropBoundsCheckResult(
          ok: false,
          code: 'DROP_MEDIA_TOO_LARGE',
          reason: 'Each image must be <= 5 MB.',
        );
      }
    }
    return const DropBoundsCheckResult(ok: true);
  }

  /// Validates Register Shifter or Bounded Drop Audio constraints.
  static DropBoundsCheckResult validateBoundedAudio({
    required bool isShifter,
    required String contentType,
    required int byteLength,
    required num durationSeconds,
  }) {
    final baseMime = contentType.split(';').first.trim().toLowerCase();
    if (!_allowedAudioMimes.contains(baseMime)) {
      return const DropBoundsCheckResult(
        ok: false,
        code: 'UNSUPPORTED_AUDIO_MIME',
        reason: 'Unsupported audio container format.',
      );
    }
    if (byteLength <= 0 || byteLength > maxMediaBytes) {
      return const DropBoundsCheckResult(
        ok: false,
        code: 'DROP_MEDIA_TOO_LARGE',
        reason: 'Audio upload must be <= 5 MB.',
      );
    }
    if (isShifter) {
      if (durationSeconds < minShifterAudioSeconds) {
        return const DropBoundsCheckResult(
          ok: false,
          code: 'SHIFTER_AUDIO_TOO_SHORT',
          reason: 'Speak for at least $minShifterAudioSeconds seconds.',
        );
      }
      if (durationSeconds > maxShifterAudioSeconds) {
        return const DropBoundsCheckResult(
          ok: false,
          code: 'SHIFTER_AUDIO_TOO_LONG',
          reason:
              'Register Shifter clips are capped at $maxShifterAudioSeconds seconds.',
        );
      }
    } else {
      if (durationSeconds <= 0) {
        return const DropBoundsCheckResult(
          ok: false,
          code: 'DROP_AUDIO_EMPTY',
          reason: 'Audio duration must be positive.',
        );
      }
      if (durationSeconds > maxDropAudioSeconds) {
        return const DropBoundsCheckResult(
          ok: false,
          code: 'DROP_AUDIO_TOO_LONG',
          reason: 'Dropped audio cannot exceed $maxDropAudioSeconds seconds.',
        );
      }
    }
    return const DropBoundsCheckResult(ok: true);
  }
}
