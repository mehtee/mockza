import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/services/native/platform_link_channel.dart';

/// Launches [url] via the quarantined native platform channel.
Future<Result<void, Failure>> openExternalUrlImpl(
  String url, {
  bool replaceCurrentTab = false,
}) => const PlatformLinkChannel().openExternalUrl(url);

/// Returns current browser origin/href when running on Web; returns `null` natively.
String? currentWebOriginImpl() => null;
