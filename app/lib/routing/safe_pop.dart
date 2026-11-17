import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

/// Safely pops the top route if possible, otherwise navigates to `fallbackRoute`
/// so deep links or browser refreshes never throw `GoError: nothing to pop`.
extension SafeNavigationContext on BuildContext {
  /// Pops the current route when `canPop` is true; otherwise routes via `go`.
  void safePopOrGo(String fallbackRoute) {
    if (canPop()) {
      pop();
    } else {
      go(fallbackRoute);
    }
  }
}
