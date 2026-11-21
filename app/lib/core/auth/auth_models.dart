import 'package:meta/meta.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';

/// Normalizes Iranian mobile formats (`0912...`, `۹۱۲...`, `+98912...`) to
/// strict E.164 `+989XXXXXXXXX`, returning `null` when invalid.
String? normalizeIranPhoneToE164(String raw) {
  final ascii = EdgeNumerals.toAsciiDigits(raw)
      .replaceAll(RegExp(r'[\s\-().]'), '')
      .trim();
  var digitsOnly = ascii.startsWith('+') ? ascii.substring(1) : ascii;
  if (digitsOnly.startsWith('0098')) {
    digitsOnly = digitsOnly.substring(2);
  }
  if (digitsOnly.startsWith('09') && digitsOnly.length == 11) {
    digitsOnly = '98${digitsOnly.substring(1)}';
  } else if (digitsOnly.startsWith('9') && digitsOnly.length == 10) {
    digitsOnly = '98$digitsOnly';
  }
  if (!RegExp(r'^989\d{9}$').hasMatch(digitsOnly)) {
    return null;
  }
  return '+$digitsOnly';
}

/// Strict subscription hardware slot buckets enforced server-side.
enum DeviceSlotKind {
  /// Single active mobile phone (native Android/iOS app or mobile browser).
  mobile('mobile'),

  /// Single active desktop web instance (Flutter Web desktop or future standalone web app).
  desktopWeb('desktop_web');

  new(this.wireValue);

  /// Backend wire representation (`mobile` | `desktop_web`).
  final String wireValue;

  /// Parses wire [raw] into [DeviceSlotKind], defaulting to [mobile].
  static DeviceSlotKind fromWire(String? raw) =>
      raw == 'desktop_web' ? desktopWeb : mobile;

  /// Human-friendly label for slot badges and conflict banners.
  String get displayLabel => switch (this) {
    mobile => 'Mobile Phone',
    desktopWeb => 'Desktop Web',
  };
}

/// Supported sign-in credential providers.
enum AuthProviderType {
  /// Email address and scrypt-verified password.
  email('email'),

  /// Google Sign-In OIDC or dev sandbox.
  google('google'),

  /// Sign in with Apple OIDC or dev sandbox.
  apple('apple'),

  /// Iranian mobile SMS OTP authentication (`IRN` Sanjia edition).
  smsOtp('sms_otp');

  new(this.wireValue);

  /// Backend wire representation (`email` | `google` | `apple` | `sms_otp`).
  final String wireValue;

  /// Parses wire [raw] into [AuthProviderType].
  static AuthProviderType fromWire(String? raw) => switch (raw) {
    'google' => google,
    'apple' => apple,
    'sms_otp' => smsOtp,
    _ => email,
  };

  /// Display title shown in session rows and account chips.
  String get displayLabel => switch (this) {
    email => 'Email',
    google => 'Google',
    apple => 'Apple',
    smsOtp => 'SMS OTP',
  };
}

/// Execution mode reported by `GET /v1/auth/providers`.
enum SocialProviderMode {
  /// Real OIDC client IDs configured; verifies cryptographic ID tokens.
  oidc('oidc'),

  /// Local/staging development sandbox mode without live client secrets.
  devSandbox('dev_sandbox'),

  /// Provider intentionally unavailable in current environment.
  disabled('disabled');

  new(this.wireValue);

  /// Backend wire representation.
  final String wireValue;

  /// Parses backend [raw] mode string cleanly.
  static SocialProviderMode fromWire(String? raw) => switch (raw) {
    'oidc' => oidc,
    'dev_sandbox' => devSandbox,
    _ => disabled,
  };
}

/// Client platform metadata attached to auth handshakes so backend classifies slots accurately.
@immutable
class DeviceClientMeta {
  /// Creates a [DeviceClientMeta].
  const new({
    required this.slotKind,
    required this.platform,
    required this.appSurface,
    required this.deviceName,
    this.timezone,
  });

  /// Hardware slot class (`mobile` vs `desktop_web`).
  final DeviceSlotKind slotKind;

  /// Platform code (`ios`, `android`, `web_mobile`, `web_desktop`, `unknown`).
  final String platform;

  /// Surface identifier (`flutter_app`, `flutter_web`, `web_app`).
  final String appSurface;

  /// Human-readable device name reported to Settings active sessions list.
  final String deviceName;

  /// Optional IANA timezone string used for coarse location hints offline/behind proxies.
  final String? timezone;

  /// Serializes metadata for `POST /v1/auth/*` bodies.
  Map<String, Object?> toJson() => <String, Object?>{
    'slotKind': slotKind.wireValue,
    'platform': platform,
    'appSurface': appSurface,
    'deviceName': deviceName,
    if (timezone != null && timezone!.isNotEmpty) 'timezone': timezone,
  };
}

/// Descriptor for one social provider returned by `GET /v1/auth/providers`.
@immutable
class SocialProviderDescriptor {
  /// Creates a [SocialProviderDescriptor].
  const new({
    required this.enabled,
    required this.mode,
    this.clientId,
  });

  /// Parses JSON map from `/v1/auth/providers`.
  factory fromJson(Map<String, Object?> json) => SocialProviderDescriptor(
    enabled: json['enabled'] == true,
    mode: SocialProviderMode.fromWire(json['mode'] as String?),
    clientId: json['clientId'] as String?,
  );

  /// Whether user may sign in using this provider right now.
  final bool enabled;

  /// Execution mode (`oidc`, `devSandbox`, or `disabled`).
  final SocialProviderMode mode;

  /// Optional configured OAuth client ID for OIDC mode.
  final String? clientId;
}

/// Descriptor for Iranian SMS OTP authentication returned by `GET /v1/auth/providers`.
@immutable
class SmsOtpProviderDescriptor {
  /// Creates an [SmsOtpProviderDescriptor].
  const new({
    required this.enabled,
    required this.mode,
  });

  /// Parses JSON map from `/v1/auth/providers`.
  factory fromJson(Map<String, Object?> json) => SmsOtpProviderDescriptor(
    enabled: json['enabled'] == true,
    mode: (json['mode'] as String?) ?? 'disabled',
  );

  /// Whether SMS OTP sign-in is enabled on this server edition.
  final bool enabled;

  /// Mode reported by backend (`sms_gateway`, `dev_sandbox`, `disabled`).
  final String mode;
}

/// Complete capability catalog returned by `GET /v1/auth/providers`.
@immutable
class AuthProvidersCatalog {
  /// Creates an [AuthProvidersCatalog].
  const new({
    required this.emailPasswordEnabled,
    required this.google,
    required this.apple,
    this.smsOtp = const SmsOtpProviderDescriptor(
      enabled: false,
      mode: 'disabled',
    ),
    this.maxMobilePhones = 1,
    this.maxDesktopWebInstances = 1,
  });

  /// Parses `GET /v1/auth/providers` JSON payload.
  factory fromJson(Map<String, Object?> json) {
    final googleJson = json['google'] as Map<String, Object?>? ?? const {};
    final appleJson = json['apple'] as Map<String, Object?>? ?? const {};
    final smsOtpJson = json['smsOtp'] as Map<String, Object?>? ?? const {};
    final policyJson =
        json['devicePolicy'] as Map<String, Object?>? ?? const {};
    return AuthProvidersCatalog(
      emailPasswordEnabled: json['emailPasswordEnabled'] != false,
      google: SocialProviderDescriptor.fromJson(googleJson),
      apple: SocialProviderDescriptor.fromJson(appleJson),
      smsOtp: SmsOtpProviderDescriptor.fromJson(smsOtpJson),
      maxMobilePhones: (policyJson['maxMobilePhones'] as num?)?.toInt() ?? 1,
      maxDesktopWebInstances:
          (policyJson['maxDesktopWebInstances'] as num?)?.toInt() ?? 1,
    );
  }

  /// Safe fallback used offline or before provider discovery completes.
  static const fallback = AuthProvidersCatalog(
    emailPasswordEnabled: true,
    google: SocialProviderDescriptor(
      enabled: false,
      mode: SocialProviderMode.disabled,
    ),
    apple: SocialProviderDescriptor(
      enabled: false,
      mode: SocialProviderMode.disabled,
    ),
  );

  /// Whether email/password sign-up and sign-in are active.
  final bool emailPasswordEnabled;

  /// Google Sign-In provider configuration.
  final SocialProviderDescriptor google;

  /// Sign in with Apple provider configuration.
  final SocialProviderDescriptor apple;

  /// Iranian SMS OTP provider configuration (`IRN` edition).
  final SmsOtpProviderDescriptor smsOtp;

  /// Maximum concurrent mobile phones per account (default `1`).
  final int maxMobilePhones;

  /// Maximum concurrent desktop web browsers per account (default `1`).
  final int maxDesktopWebInstances;
}

/// Signed-in account profile metadata returned by auth/session APIs.
@immutable
class AccountUserSummary {
  /// Creates an [AccountUserSummary].
  const new({
    required this.userId,
    required this.email,
    required this.displayName,
    required this.linkedProviders,
    required this.isPro,
    this.acceptedDevicePolicyAt,
  });

  /// Parses an [AccountUserSummary] JSON object.
  factory fromJson(Map<String, Object?> json) {
    final rawProviders =
        json['linkedProviders'] as List<Object?>? ?? const <Object?>[];
    return AccountUserSummary(
      userId: json['userId'] as String? ?? '',
      email: json['email'] as String?,
      displayName: json['displayName'] as String?,
      linkedProviders: rawProviders
          .whereType<String>()
          .map(AuthProviderType.fromWire)
          .toList(growable: false),
      isPro: json['isPro'] == true,
      acceptedDevicePolicyAt: json['acceptedDevicePolicyAt'] as String?,
    );
  }

  /// Canonical backend UUID (`users.user_id`).
  final String userId;

  /// Verified or registered email address, if available.
  final String? email;

  /// Friendly display name.
  final String? displayName;

  /// Active authentication methods linked to this account.
  final List<AuthProviderType> linkedProviders;

  /// Authoritative server Pro entitlement status for this account.
  final bool isPro;

  /// ISO-8601 timestamp when the user accepted the 1+1 device limit policy.
  final String? acceptedDevicePolicyAt;
}

/// Active device session row displayed in Gemini/ChatGPT-style Settings list.
@immutable
class DeviceSessionInfo {
  /// Creates a [DeviceSessionInfo].
  const new({
    required this.sessionId,
    required this.deviceId,
    required this.deviceIdShort,
    required this.slotKind,
    required this.platform,
    required this.appSurface,
    required this.deviceName,
    required this.locationLabel,
    required this.ipMasked,
    required this.authMethod,
    required this.isCurrentDevice,
    required this.createdAt,
    required this.lastSeenAt,
  });

  /// Parses JSON row from `/v1/account/devices` or `/v1/auth/*`.
  factory fromJson(Map<String, Object?> json) => DeviceSessionInfo(
    sessionId: json['sessionId'] as String? ?? '',
    deviceId: json['deviceId'] as String? ?? '',
    deviceIdShort: json['deviceIdShort'] as String? ?? '',
    slotKind: DeviceSlotKind.fromWire(json['slotKind'] as String?),
    platform: json['platform'] as String? ?? 'unknown',
    appSurface: json['appSurface'] as String? ?? 'flutter_app',
    deviceName: json['deviceName'] as String? ?? 'Unknown Device',
    locationLabel: json['locationLabel'] as String? ?? 'Approximate location',
    ipMasked: json['ipMasked'] as String?,
    authMethod: AuthProviderType.fromWire(json['authMethod'] as String?),
    isCurrentDevice: json['isCurrentDevice'] == true,
    createdAt: json['createdAt'] as String? ?? '',
    lastSeenAt: json['lastSeenAt'] as String? ?? '',
  );

  /// Session record UUID.
  final String sessionId;

  /// Bound device UUID.
  final String deviceId;

  /// Abbreviated device identifier for compact UI display.
  final String deviceIdShort;

  /// Slot classification (`mobile` vs `desktopWeb`).
  final DeviceSlotKind slotKind;

  /// Platform wire code (`ios`, `android`, `web_mobile`, `web_desktop`, `unknown`).
  final String platform;

  /// Client app surface (`flutter_app`, `flutter_web`, `web_app`).
  final String appSurface;

  /// Human-readable device name.
  final String deviceName;

  /// Coarse location label resolved from edge geo / timezone.
  final String locationLabel;

  /// Privacy-masked IP prefix, when available.
  final String? ipMasked;

  /// Sign-in method used on this session.
  final AuthProviderType authMethod;

  /// Whether this session belongs to the device currently viewing Settings.
  final bool isCurrentDevice;

  /// ISO-8601 session creation timestamp.
  final String createdAt;

  /// ISO-8601 last active timestamp.
  final String lastSeenAt;
}

/// Structured conflict details returned when a 2nd phone or 2nd web session tries to sign in.
@immutable
class OccupyingDeviceConflict {
  /// Creates an [OccupyingDeviceConflict].
  const new({
    required this.slotKind,
    required this.deviceId,
    required this.deviceIdShort,
    required this.deviceName,
    required this.locationLabel,
    required this.lastSeenAt,
  });

  /// Parses `details` object from a `409 device_slot_limit_reached` API error.
  factory fromErrorDetails(Map<String, Object?> json) {
    final occupying =
        json['occupyingDevice'] as Map<String, Object?>? ?? const {};
    return OccupyingDeviceConflict(
      slotKind: DeviceSlotKind.fromWire(json['slotKind'] as String?),
      deviceId: occupying['deviceId'] as String? ?? '',
      deviceIdShort: occupying['deviceIdShort'] as String? ?? '',
      deviceName: occupying['deviceName'] as String? ?? 'Active device',
      locationLabel:
          occupying['locationLabel'] as String? ?? 'Unknown location',
      lastSeenAt: occupying['lastSeenAt'] as String? ?? '',
    );
  }

  /// Occupied slot bucket (`mobile` or `desktopWeb`).
  final DeviceSlotKind slotKind;

  /// Occupying device UUID.
  final String deviceId;

  /// Short ID preview shown in conflict banner.
  final String deviceIdShort;

  /// Name of the device holding the slot.
  final String deviceName;

  /// Location label of the device holding the slot.
  final String locationLabel;

  /// Last active timestamp of the device holding the slot.
  final String lastSeenAt;
}

/// Complete session bundle returned after registration, login, or OAuth sign-in.
@immutable
class AuthSessionResult {
  /// Creates an [AuthSessionResult].
  const new({
    required this.accessToken,
    required this.expiresAt,
    required this.deviceId,
    required this.user,
    required this.currentSession,
    required this.sessions,
    this.deviceSecret,
  });

  /// Parses JSON payload returned by `/v1/auth/register`, `/v1/auth/login`, and `/v1/auth/oauth`.
  factory fromJson(Map<String, Object?> json) {
    final rawSessions = json['sessions'] as List<Object?>? ?? const <Object?>[];
    return AuthSessionResult(
      accessToken: json['accessToken'] as String? ?? '',
      expiresAt: json['expiresAt'] as String? ?? '',
      deviceId: json['deviceId'] as String? ?? '',
      deviceSecret: json['deviceSecret'] as String?,
      user: AccountUserSummary.fromJson(
        json['user'] as Map<String, Object?>? ?? const {},
      ),
      currentSession: DeviceSessionInfo.fromJson(
        json['currentSession'] as Map<String, Object?>? ?? const {},
      ),
      sessions: rawSessions
          .whereType<Map<String, Object?>>()
          .map(DeviceSessionInfo.fromJson)
          .toList(growable: false),
    );
  }

  /// Rotated bearer JWT carrying `uid` + `tv`.
  final String accessToken;

  /// ISO-8601 expiration timestamp of [accessToken].
  final String expiresAt;

  /// Bound local device UUID.
  final String deviceId;

  /// Optional newly issued renewal secret.
  final String? deviceSecret;

  /// Authenticated account summary.
  final AccountUserSummary user;

  /// Active session entry for this device.
  final DeviceSessionInfo currentSession;

  /// All active device sessions belonging to [user].
  final List<DeviceSessionInfo> sessions;
}

/// Snapshot returned by `GET /v1/account/devices`.
@immutable
class AccountSessionsSnapshot {
  /// Creates an [AccountSessionsSnapshot].
  const new({
    required this.isAuthenticated,
    required this.user,
    required this.currentDeviceId,
    required this.mobileOccupied,
    required this.desktopWebOccupied,
    required this.sessions,
    this.maxMobilePhones = 1,
    this.maxDesktopWebInstances = 1,
  });

  /// Parses `GET /v1/account/devices` payload.
  factory fromJson(Map<String, Object?> json) {
    final rawUser = json['user'] as Map<String, Object?>?;
    final policy = json['devicePolicy'] as Map<String, Object?>? ?? const {};
    final rawSessions = json['sessions'] as List<Object?>? ?? const <Object?>[];
    return AccountSessionsSnapshot(
      isAuthenticated: json['isAuthenticated'] == true,
      user: rawUser != null ? AccountUserSummary.fromJson(rawUser) : null,
      currentDeviceId: json['currentDeviceId'] as String? ?? '',
      maxMobilePhones: (policy['maxMobilePhones'] as num?)?.toInt() ?? 1,
      maxDesktopWebInstances:
          (policy['maxDesktopWebInstances'] as num?)?.toInt() ?? 1,
      mobileOccupied: policy['mobileOccupied'] == true,
      desktopWebOccupied: policy['desktopWebOccupied'] == true,
      sessions: rawSessions
          .whereType<Map<String, Object?>>()
          .map(DeviceSessionInfo.fromJson)
          .toList(growable: false),
    );
  }

  /// Whether the current device is linked to an authenticated user account.
  final bool isAuthenticated;

  /// Signed-in account profile, or `null` when anonymous.
  final AccountUserSummary? user;

  /// Current device UUID.
  final String currentDeviceId;

  /// Configured phone slot cap (`1`).
  final int maxMobilePhones;

  /// Configured desktop web slot cap (`1`).
  final int maxDesktopWebInstances;

  /// Whether the 1 mobile phone slot is currently occupied.
  final bool mobileOccupied;

  /// Whether the 1 desktop web slot is currently occupied.
  final bool desktopWebOccupied;

  /// All active signed-in device sessions.
  final List<DeviceSessionInfo> sessions;
}

/// Sandbox account persona selectable in development builds when OAuth client IDs are unset.
@immutable
class DevSocialPersona {
  /// Creates a [DevSocialPersona].
  const new({
    required this.sub,
    required this.email,
    required this.displayName,
  });

  /// Deterministic mock OIDC subject claim.
  final String sub;

  /// Mock provider email address.
  final String email;

  /// Mock display name.
  final String displayName;
}
