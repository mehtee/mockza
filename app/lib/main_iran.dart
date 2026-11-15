import 'package:mockza/bootstrap.dart';
import 'package:mockza/core/config/edition_config.dart';

/// Entrypoint for the Iran (`irn`) distribution flavor.
Future<void> main() => bootstrap(EditionConfig.iranDefault);
