import 'package:mockza/bootstrap.dart';
import 'package:mockza/core/config/edition_config.dart';

/// Entrypoint for the Global (`glb`) distribution flavor.
Future<void> main() => bootstrap(EditionConfig.globalDefault);
