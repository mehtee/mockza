import 'package:path/path.dart' as p;

/// Relative disk storage paths ensuring database rows never store machine-specific absolute paths.
abstract final class AppStoragePaths {
  /// Directory name for locally recorded speaking audio chunks.
  static const String audioSubdir = 'audio';

  /// Directory name for unpacked offline exam packs.
  static const String packsSubdir = 'packs';

  /// Directory name for persistent error and crash logs.
  static const String logsSubdir = 'logs';

  /// Directory name for temporary active draft files.
  static const String draftsSubdir = 'drafts';

  /// File name of the persistent crash log ring buffer.
  static const String crashLogFile = 'crash.log';

  /// Generates a relative storage path for a speaking recording turn.
  static String relativeAudioPath(
    String recordingId, {
    String extension = 'm4a',
  }) => p.join(audioSubdir, '$recordingId.$extension');

  /// Generates a relative storage path for an unpacked pack root directory.
  static String relativePackPath(String packId) => p.join(packsSubdir, packId);

  /// Resolves a stored relative path against the app support [baseDirectory].
  static String resolve(String baseDirectory, String relativePath) =>
      p.join(baseDirectory, relativePath);
}
