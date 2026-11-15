// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $UserProfilesTable extends UserProfiles
    with TableInfo<$UserProfilesTable, UserProfileRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $UserProfilesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _deviceIdMeta = const VerificationMeta(
    'deviceId',
  );
  @override
  late final GeneratedColumn<String> deviceId = GeneratedColumn<String>(
    'device_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _targetBandMeta = const VerificationMeta(
    'targetBand',
  );
  @override
  late final GeneratedColumn<double> targetBand = GeneratedColumn<double>(
    'target_band',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
    defaultValue: const Constant(7),
  );
  static const VerificationMeta _examModuleMeta = const VerificationMeta(
    'examModule',
  );
  @override
  late final GeneratedColumn<String> examModule = GeneratedColumn<String>(
    'exam_module',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('academic'),
  );
  static const VerificationMeta _examIdMeta = const VerificationMeta('examId');
  @override
  late final GeneratedColumn<String> examId = GeneratedColumn<String>(
    'exam_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('ielts_academic'),
  );
  static const VerificationMeta _targetDateSerialMeta = const VerificationMeta(
    'targetDateSerial',
  );
  @override
  late final GeneratedColumn<int> targetDateSerial = GeneratedColumn<int>(
    'target_date_serial',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _onboardingCompletedMeta =
      const VerificationMeta('onboardingCompleted');
  @override
  late final GeneratedColumn<bool> onboardingCompleted = GeneratedColumn<bool>(
    'onboarding_completed',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("onboarding_completed" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _freeDiagnosticUsedMeta =
      const VerificationMeta('freeDiagnosticUsed');
  @override
  late final GeneratedColumn<bool> freeDiagnosticUsed = GeneratedColumn<bool>(
    'free_diagnostic_used',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("free_diagnostic_used" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  static const VerificationMeta _themeModeMeta = const VerificationMeta(
    'themeMode',
  );
  @override
  late final GeneratedColumn<String> themeMode = GeneratedColumn<String>(
    'theme_mode',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('system'),
  );
  static const VerificationMeta _linkedEmailMeta = const VerificationMeta(
    'linkedEmail',
  );
  @override
  late final GeneratedColumn<String> linkedEmail = GeneratedColumn<String>(
    'linked_email',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _appUserIdMeta = const VerificationMeta(
    'appUserId',
  );
  @override
  late final GeneratedColumn<String> appUserId = GeneratedColumn<String>(
    'app_user_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isProMeta = const VerificationMeta('isPro');
  @override
  late final GeneratedColumn<bool> isPro = GeneratedColumn<bool>(
    'is_pro',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_pro" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [
    createdAt,
    updatedAt,
    deviceId,
    targetBand,
    examModule,
    examId,
    targetDateSerial,
    onboardingCompleted,
    freeDiagnosticUsed,
    themeMode,
    linkedEmail,
    appUserId,
    isPro,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'user_profiles';
  @override
  VerificationContext validateIntegrity(
    Insertable<UserProfileRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('device_id')) {
      context.handle(
        _deviceIdMeta,
        deviceId.isAcceptableOrUnknown(data['device_id']!, _deviceIdMeta),
      );
    } else if (isInserting) {
      context.missing(_deviceIdMeta);
    }
    if (data.containsKey('target_band')) {
      context.handle(
        _targetBandMeta,
        targetBand.isAcceptableOrUnknown(data['target_band']!, _targetBandMeta),
      );
    }
    if (data.containsKey('exam_module')) {
      context.handle(
        _examModuleMeta,
        examModule.isAcceptableOrUnknown(data['exam_module']!, _examModuleMeta),
      );
    }
    if (data.containsKey('exam_id')) {
      context.handle(
        _examIdMeta,
        examId.isAcceptableOrUnknown(data['exam_id']!, _examIdMeta),
      );
    }
    if (data.containsKey('target_date_serial')) {
      context.handle(
        _targetDateSerialMeta,
        targetDateSerial.isAcceptableOrUnknown(
          data['target_date_serial']!,
          _targetDateSerialMeta,
        ),
      );
    }
    if (data.containsKey('onboarding_completed')) {
      context.handle(
        _onboardingCompletedMeta,
        onboardingCompleted.isAcceptableOrUnknown(
          data['onboarding_completed']!,
          _onboardingCompletedMeta,
        ),
      );
    }
    if (data.containsKey('free_diagnostic_used')) {
      context.handle(
        _freeDiagnosticUsedMeta,
        freeDiagnosticUsed.isAcceptableOrUnknown(
          data['free_diagnostic_used']!,
          _freeDiagnosticUsedMeta,
        ),
      );
    }
    if (data.containsKey('theme_mode')) {
      context.handle(
        _themeModeMeta,
        themeMode.isAcceptableOrUnknown(data['theme_mode']!, _themeModeMeta),
      );
    }
    if (data.containsKey('linked_email')) {
      context.handle(
        _linkedEmailMeta,
        linkedEmail.isAcceptableOrUnknown(
          data['linked_email']!,
          _linkedEmailMeta,
        ),
      );
    }
    if (data.containsKey('app_user_id')) {
      context.handle(
        _appUserIdMeta,
        appUserId.isAcceptableOrUnknown(data['app_user_id']!, _appUserIdMeta),
      );
    }
    if (data.containsKey('is_pro')) {
      context.handle(
        _isProMeta,
        isPro.isAcceptableOrUnknown(data['is_pro']!, _isProMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {deviceId};
  @override
  UserProfileRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return UserProfileRow(
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      deviceId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}device_id'],
      )!,
      targetBand: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}target_band'],
      )!,
      examModule: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}exam_module'],
      )!,
      examId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}exam_id'],
      )!,
      targetDateSerial: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}target_date_serial'],
      ),
      onboardingCompleted: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}onboarding_completed'],
      )!,
      freeDiagnosticUsed: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}free_diagnostic_used'],
      )!,
      themeMode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}theme_mode'],
      )!,
      linkedEmail: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}linked_email'],
      ),
      appUserId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}app_user_id'],
      ),
      isPro: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_pro'],
      )!,
    );
  }

  @override
  $UserProfilesTable createAlias(String alias) {
    return $UserProfilesTable(attachedDatabase, alias);
  }
}

class UserProfileRow extends DataClass implements Insertable<UserProfileRow> {
  /// Record creation timestamp in UTC.
  final DateTime createdAt;

  /// Last local mutation timestamp in UTC.
  final DateTime updatedAt;

  /// Stable device-bound learner identifier.
  final String deviceId;

  /// Learner target IELTS band score (`0.0..9.0`).
  final double targetBand;

  /// Selected IELTS track (`academic` or `generalTraining`).
  final String examModule;

  /// Active exam track (`ielts_academic`, `ielts_general`, `pte_academic`, etc.).
  final String examId;

  /// Target exam date represented as a UTC serial day.
  final int? targetDateSerial;

  /// Whether the user has completed the onboarding flow.
  final bool onboardingCompleted;

  /// Whether the single free diagnostic trial has been consumed.
  final bool freeDiagnosticUsed;

  /// User theme preference (`system`, `dark`, `light`).
  final String themeMode;

  /// Optional email linked for account recovery and cross-device sync.
  final String? linkedEmail;

  /// Server-assigned pseudonymous user identifier.
  final String? appUserId;

  /// Cached entitlement status mirrored from billing verification.
  final bool isPro;
  const UserProfileRow({
    required this.createdAt,
    required this.updatedAt,
    required this.deviceId,
    required this.targetBand,
    required this.examModule,
    required this.examId,
    this.targetDateSerial,
    required this.onboardingCompleted,
    required this.freeDiagnosticUsed,
    required this.themeMode,
    this.linkedEmail,
    this.appUserId,
    required this.isPro,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['device_id'] = Variable<String>(deviceId);
    map['target_band'] = Variable<double>(targetBand);
    map['exam_module'] = Variable<String>(examModule);
    map['exam_id'] = Variable<String>(examId);
    if (!nullToAbsent || targetDateSerial != null) {
      map['target_date_serial'] = Variable<int>(targetDateSerial);
    }
    map['onboarding_completed'] = Variable<bool>(onboardingCompleted);
    map['free_diagnostic_used'] = Variable<bool>(freeDiagnosticUsed);
    map['theme_mode'] = Variable<String>(themeMode);
    if (!nullToAbsent || linkedEmail != null) {
      map['linked_email'] = Variable<String>(linkedEmail);
    }
    if (!nullToAbsent || appUserId != null) {
      map['app_user_id'] = Variable<String>(appUserId);
    }
    map['is_pro'] = Variable<bool>(isPro);
    return map;
  }

  UserProfilesCompanion toCompanion(bool nullToAbsent) {
    return UserProfilesCompanion(
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      deviceId: Value(deviceId),
      targetBand: Value(targetBand),
      examModule: Value(examModule),
      examId: Value(examId),
      targetDateSerial: targetDateSerial == null && nullToAbsent
          ? const Value.absent()
          : Value(targetDateSerial),
      onboardingCompleted: Value(onboardingCompleted),
      freeDiagnosticUsed: Value(freeDiagnosticUsed),
      themeMode: Value(themeMode),
      linkedEmail: linkedEmail == null && nullToAbsent
          ? const Value.absent()
          : Value(linkedEmail),
      appUserId: appUserId == null && nullToAbsent
          ? const Value.absent()
          : Value(appUserId),
      isPro: Value(isPro),
    );
  }

  factory UserProfileRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return UserProfileRow(
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      deviceId: serializer.fromJson<String>(json['deviceId']),
      targetBand: serializer.fromJson<double>(json['targetBand']),
      examModule: serializer.fromJson<String>(json['examModule']),
      examId: serializer.fromJson<String>(json['examId']),
      targetDateSerial: serializer.fromJson<int?>(json['targetDateSerial']),
      onboardingCompleted: serializer.fromJson<bool>(
        json['onboardingCompleted'],
      ),
      freeDiagnosticUsed: serializer.fromJson<bool>(json['freeDiagnosticUsed']),
      themeMode: serializer.fromJson<String>(json['themeMode']),
      linkedEmail: serializer.fromJson<String?>(json['linkedEmail']),
      appUserId: serializer.fromJson<String?>(json['appUserId']),
      isPro: serializer.fromJson<bool>(json['isPro']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'deviceId': serializer.toJson<String>(deviceId),
      'targetBand': serializer.toJson<double>(targetBand),
      'examModule': serializer.toJson<String>(examModule),
      'examId': serializer.toJson<String>(examId),
      'targetDateSerial': serializer.toJson<int?>(targetDateSerial),
      'onboardingCompleted': serializer.toJson<bool>(onboardingCompleted),
      'freeDiagnosticUsed': serializer.toJson<bool>(freeDiagnosticUsed),
      'themeMode': serializer.toJson<String>(themeMode),
      'linkedEmail': serializer.toJson<String?>(linkedEmail),
      'appUserId': serializer.toJson<String?>(appUserId),
      'isPro': serializer.toJson<bool>(isPro),
    };
  }

  UserProfileRow copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    String? deviceId,
    double? targetBand,
    String? examModule,
    String? examId,
    Value<int?> targetDateSerial = const Value.absent(),
    bool? onboardingCompleted,
    bool? freeDiagnosticUsed,
    String? themeMode,
    Value<String?> linkedEmail = const Value.absent(),
    Value<String?> appUserId = const Value.absent(),
    bool? isPro,
  }) => UserProfileRow(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    deviceId: deviceId ?? this.deviceId,
    targetBand: targetBand ?? this.targetBand,
    examModule: examModule ?? this.examModule,
    examId: examId ?? this.examId,
    targetDateSerial: targetDateSerial.present
        ? targetDateSerial.value
        : this.targetDateSerial,
    onboardingCompleted: onboardingCompleted ?? this.onboardingCompleted,
    freeDiagnosticUsed: freeDiagnosticUsed ?? this.freeDiagnosticUsed,
    themeMode: themeMode ?? this.themeMode,
    linkedEmail: linkedEmail.present ? linkedEmail.value : this.linkedEmail,
    appUserId: appUserId.present ? appUserId.value : this.appUserId,
    isPro: isPro ?? this.isPro,
  );
  UserProfileRow copyWithCompanion(UserProfilesCompanion data) {
    return UserProfileRow(
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      deviceId: data.deviceId.present ? data.deviceId.value : this.deviceId,
      targetBand: data.targetBand.present
          ? data.targetBand.value
          : this.targetBand,
      examModule: data.examModule.present
          ? data.examModule.value
          : this.examModule,
      examId: data.examId.present ? data.examId.value : this.examId,
      targetDateSerial: data.targetDateSerial.present
          ? data.targetDateSerial.value
          : this.targetDateSerial,
      onboardingCompleted: data.onboardingCompleted.present
          ? data.onboardingCompleted.value
          : this.onboardingCompleted,
      freeDiagnosticUsed: data.freeDiagnosticUsed.present
          ? data.freeDiagnosticUsed.value
          : this.freeDiagnosticUsed,
      themeMode: data.themeMode.present ? data.themeMode.value : this.themeMode,
      linkedEmail: data.linkedEmail.present
          ? data.linkedEmail.value
          : this.linkedEmail,
      appUserId: data.appUserId.present ? data.appUserId.value : this.appUserId,
      isPro: data.isPro.present ? data.isPro.value : this.isPro,
    );
  }

  @override
  String toString() {
    return (StringBuffer('UserProfileRow(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('deviceId: $deviceId, ')
          ..write('targetBand: $targetBand, ')
          ..write('examModule: $examModule, ')
          ..write('examId: $examId, ')
          ..write('targetDateSerial: $targetDateSerial, ')
          ..write('onboardingCompleted: $onboardingCompleted, ')
          ..write('freeDiagnosticUsed: $freeDiagnosticUsed, ')
          ..write('themeMode: $themeMode, ')
          ..write('linkedEmail: $linkedEmail, ')
          ..write('appUserId: $appUserId, ')
          ..write('isPro: $isPro')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    createdAt,
    updatedAt,
    deviceId,
    targetBand,
    examModule,
    examId,
    targetDateSerial,
    onboardingCompleted,
    freeDiagnosticUsed,
    themeMode,
    linkedEmail,
    appUserId,
    isPro,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is UserProfileRow &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.deviceId == this.deviceId &&
          other.targetBand == this.targetBand &&
          other.examModule == this.examModule &&
          other.examId == this.examId &&
          other.targetDateSerial == this.targetDateSerial &&
          other.onboardingCompleted == this.onboardingCompleted &&
          other.freeDiagnosticUsed == this.freeDiagnosticUsed &&
          other.themeMode == this.themeMode &&
          other.linkedEmail == this.linkedEmail &&
          other.appUserId == this.appUserId &&
          other.isPro == this.isPro);
}

class UserProfilesCompanion extends UpdateCompanion<UserProfileRow> {
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<String> deviceId;
  final Value<double> targetBand;
  final Value<String> examModule;
  final Value<String> examId;
  final Value<int?> targetDateSerial;
  final Value<bool> onboardingCompleted;
  final Value<bool> freeDiagnosticUsed;
  final Value<String> themeMode;
  final Value<String?> linkedEmail;
  final Value<String?> appUserId;
  final Value<bool> isPro;
  final Value<int> rowid;
  const UserProfilesCompanion({
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.deviceId = const Value.absent(),
    this.targetBand = const Value.absent(),
    this.examModule = const Value.absent(),
    this.examId = const Value.absent(),
    this.targetDateSerial = const Value.absent(),
    this.onboardingCompleted = const Value.absent(),
    this.freeDiagnosticUsed = const Value.absent(),
    this.themeMode = const Value.absent(),
    this.linkedEmail = const Value.absent(),
    this.appUserId = const Value.absent(),
    this.isPro = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  UserProfilesCompanion.insert({
    required DateTime createdAt,
    required DateTime updatedAt,
    required String deviceId,
    this.targetBand = const Value.absent(),
    this.examModule = const Value.absent(),
    this.examId = const Value.absent(),
    this.targetDateSerial = const Value.absent(),
    this.onboardingCompleted = const Value.absent(),
    this.freeDiagnosticUsed = const Value.absent(),
    this.themeMode = const Value.absent(),
    this.linkedEmail = const Value.absent(),
    this.appUserId = const Value.absent(),
    this.isPro = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : createdAt = Value(createdAt),
       updatedAt = Value(updatedAt),
       deviceId = Value(deviceId);
  static Insertable<UserProfileRow> custom({
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<String>? deviceId,
    Expression<double>? targetBand,
    Expression<String>? examModule,
    Expression<String>? examId,
    Expression<int>? targetDateSerial,
    Expression<bool>? onboardingCompleted,
    Expression<bool>? freeDiagnosticUsed,
    Expression<String>? themeMode,
    Expression<String>? linkedEmail,
    Expression<String>? appUserId,
    Expression<bool>? isPro,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (deviceId != null) 'device_id': deviceId,
      if (targetBand != null) 'target_band': targetBand,
      if (examModule != null) 'exam_module': examModule,
      if (examId != null) 'exam_id': examId,
      if (targetDateSerial != null) 'target_date_serial': targetDateSerial,
      if (onboardingCompleted != null)
        'onboarding_completed': onboardingCompleted,
      if (freeDiagnosticUsed != null)
        'free_diagnostic_used': freeDiagnosticUsed,
      if (themeMode != null) 'theme_mode': themeMode,
      if (linkedEmail != null) 'linked_email': linkedEmail,
      if (appUserId != null) 'app_user_id': appUserId,
      if (isPro != null) 'is_pro': isPro,
      if (rowid != null) 'rowid': rowid,
    });
  }

  UserProfilesCompanion copyWith({
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<String>? deviceId,
    Value<double>? targetBand,
    Value<String>? examModule,
    Value<String>? examId,
    Value<int?>? targetDateSerial,
    Value<bool>? onboardingCompleted,
    Value<bool>? freeDiagnosticUsed,
    Value<String>? themeMode,
    Value<String?>? linkedEmail,
    Value<String?>? appUserId,
    Value<bool>? isPro,
    Value<int>? rowid,
  }) {
    return UserProfilesCompanion(
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      deviceId: deviceId ?? this.deviceId,
      targetBand: targetBand ?? this.targetBand,
      examModule: examModule ?? this.examModule,
      examId: examId ?? this.examId,
      targetDateSerial: targetDateSerial ?? this.targetDateSerial,
      onboardingCompleted: onboardingCompleted ?? this.onboardingCompleted,
      freeDiagnosticUsed: freeDiagnosticUsed ?? this.freeDiagnosticUsed,
      themeMode: themeMode ?? this.themeMode,
      linkedEmail: linkedEmail ?? this.linkedEmail,
      appUserId: appUserId ?? this.appUserId,
      isPro: isPro ?? this.isPro,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (deviceId.present) {
      map['device_id'] = Variable<String>(deviceId.value);
    }
    if (targetBand.present) {
      map['target_band'] = Variable<double>(targetBand.value);
    }
    if (examModule.present) {
      map['exam_module'] = Variable<String>(examModule.value);
    }
    if (examId.present) {
      map['exam_id'] = Variable<String>(examId.value);
    }
    if (targetDateSerial.present) {
      map['target_date_serial'] = Variable<int>(targetDateSerial.value);
    }
    if (onboardingCompleted.present) {
      map['onboarding_completed'] = Variable<bool>(onboardingCompleted.value);
    }
    if (freeDiagnosticUsed.present) {
      map['free_diagnostic_used'] = Variable<bool>(freeDiagnosticUsed.value);
    }
    if (themeMode.present) {
      map['theme_mode'] = Variable<String>(themeMode.value);
    }
    if (linkedEmail.present) {
      map['linked_email'] = Variable<String>(linkedEmail.value);
    }
    if (appUserId.present) {
      map['app_user_id'] = Variable<String>(appUserId.value);
    }
    if (isPro.present) {
      map['is_pro'] = Variable<bool>(isPro.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('UserProfilesCompanion(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('deviceId: $deviceId, ')
          ..write('targetBand: $targetBand, ')
          ..write('examModule: $examModule, ')
          ..write('examId: $examId, ')
          ..write('targetDateSerial: $targetDateSerial, ')
          ..write('onboardingCompleted: $onboardingCompleted, ')
          ..write('freeDiagnosticUsed: $freeDiagnosticUsed, ')
          ..write('themeMode: $themeMode, ')
          ..write('linkedEmail: $linkedEmail, ')
          ..write('appUserId: $appUserId, ')
          ..write('isPro: $isPro, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ExamPacksTable extends ExamPacks
    with TableInfo<$ExamPacksTable, ExamPackRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ExamPacksTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _packIdMeta = const VerificationMeta('packId');
  @override
  late final GeneratedColumn<String> packId = GeneratedColumn<String>(
    'pack_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _trackMeta = const VerificationMeta('track');
  @override
  late final GeneratedColumn<String> track = GeneratedColumn<String>(
    'track',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('academic'),
  );
  static const VerificationMeta _skillMeta = const VerificationMeta('skill');
  @override
  late final GeneratedColumn<String> skill = GeneratedColumn<String>(
    'skill',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _descriptionMeta = const VerificationMeta(
    'description',
  );
  @override
  late final GeneratedColumn<String> description = GeneratedColumn<String>(
    'description',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant(''),
  );
  static const VerificationMeta _durationSecondsMeta = const VerificationMeta(
    'durationSeconds',
  );
  @override
  late final GeneratedColumn<int> durationSeconds = GeneratedColumn<int>(
    'duration_seconds',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _questionCountMeta = const VerificationMeta(
    'questionCount',
  );
  @override
  late final GeneratedColumn<int> questionCount = GeneratedColumn<int>(
    'question_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _accentMeta = const VerificationMeta('accent');
  @override
  late final GeneratedColumn<String> accent = GeneratedColumn<String>(
    'accent',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _mediaUrlMeta = const VerificationMeta(
    'mediaUrl',
  );
  @override
  late final GeneratedColumn<String> mediaUrl = GeneratedColumn<String>(
    'media_url',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _versionMeta = const VerificationMeta(
    'version',
  );
  @override
  late final GeneratedColumn<String> version = GeneratedColumn<String>(
    'version',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sha256Meta = const VerificationMeta('sha256');
  @override
  late final GeneratedColumn<String> sha256 = GeneratedColumn<String>(
    'sha256',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _localPathMeta = const VerificationMeta(
    'localPath',
  );
  @override
  late final GeneratedColumn<String> localPath = GeneratedColumn<String>(
    'local_path',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    createdAt,
    updatedAt,
    packId,
    track,
    skill,
    title,
    description,
    durationSeconds,
    questionCount,
    accent,
    mediaUrl,
    version,
    sha256,
    localPath,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'exam_packs';
  @override
  VerificationContext validateIntegrity(
    Insertable<ExamPackRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('pack_id')) {
      context.handle(
        _packIdMeta,
        packId.isAcceptableOrUnknown(data['pack_id']!, _packIdMeta),
      );
    } else if (isInserting) {
      context.missing(_packIdMeta);
    }
    if (data.containsKey('track')) {
      context.handle(
        _trackMeta,
        track.isAcceptableOrUnknown(data['track']!, _trackMeta),
      );
    }
    if (data.containsKey('skill')) {
      context.handle(
        _skillMeta,
        skill.isAcceptableOrUnknown(data['skill']!, _skillMeta),
      );
    } else if (isInserting) {
      context.missing(_skillMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    }
    if (data.containsKey('description')) {
      context.handle(
        _descriptionMeta,
        description.isAcceptableOrUnknown(
          data['description']!,
          _descriptionMeta,
        ),
      );
    }
    if (data.containsKey('duration_seconds')) {
      context.handle(
        _durationSecondsMeta,
        durationSeconds.isAcceptableOrUnknown(
          data['duration_seconds']!,
          _durationSecondsMeta,
        ),
      );
    }
    if (data.containsKey('question_count')) {
      context.handle(
        _questionCountMeta,
        questionCount.isAcceptableOrUnknown(
          data['question_count']!,
          _questionCountMeta,
        ),
      );
    }
    if (data.containsKey('accent')) {
      context.handle(
        _accentMeta,
        accent.isAcceptableOrUnknown(data['accent']!, _accentMeta),
      );
    }
    if (data.containsKey('media_url')) {
      context.handle(
        _mediaUrlMeta,
        mediaUrl.isAcceptableOrUnknown(data['media_url']!, _mediaUrlMeta),
      );
    }
    if (data.containsKey('version')) {
      context.handle(
        _versionMeta,
        version.isAcceptableOrUnknown(data['version']!, _versionMeta),
      );
    } else if (isInserting) {
      context.missing(_versionMeta);
    }
    if (data.containsKey('sha256')) {
      context.handle(
        _sha256Meta,
        sha256.isAcceptableOrUnknown(data['sha256']!, _sha256Meta),
      );
    } else if (isInserting) {
      context.missing(_sha256Meta);
    }
    if (data.containsKey('local_path')) {
      context.handle(
        _localPathMeta,
        localPath.isAcceptableOrUnknown(data['local_path']!, _localPathMeta),
      );
    } else if (isInserting) {
      context.missing(_localPathMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {packId};
  @override
  ExamPackRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ExamPackRow(
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      packId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pack_id'],
      )!,
      track: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}track'],
      )!,
      skill: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}skill'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      description: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}description'],
      )!,
      durationSeconds: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}duration_seconds'],
      )!,
      questionCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}question_count'],
      )!,
      accent: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}accent'],
      ),
      mediaUrl: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}media_url'],
      ),
      version: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}version'],
      )!,
      sha256: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sha256'],
      )!,
      localPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_path'],
      )!,
    );
  }

  @override
  $ExamPacksTable createAlias(String alias) {
    return $ExamPacksTable(attachedDatabase, alias);
  }
}

class ExamPackRow extends DataClass implements Insertable<ExamPackRow> {
  /// Record creation timestamp in UTC.
  final DateTime createdAt;

  /// Last local mutation timestamp in UTC.
  final DateTime updatedAt;

  /// Unique pack identifier (`ielts-acad-pack-001`, etc.).
  final String packId;

  /// Exam track (`academic`, `general_training`).
  final String track;

  /// Primary skill covered (`speaking`, `writing`, `reading`, `listening`, `fullMock`).
  final String skill;

  /// Display title from backend catalog.
  final String title;

  /// Concise subtitle/description from backend catalog.
  final String description;

  /// Total allotted duration in seconds.
  final int durationSeconds;

  /// Total question or task count.
  final int questionCount;

  /// Speaker accent when applicable (`UK`, `AU`, `US`, `NZ`).
  final String? accent;

  /// Backend media proxy path or relative object key.
  final String? mediaUrl;

  /// Monotonic content version string.
  final String version;

  /// SHA-256 hex digest verified after archive extraction.
  final String sha256;

  /// Local relative asset root or cache key.
  final String localPath;
  const ExamPackRow({
    required this.createdAt,
    required this.updatedAt,
    required this.packId,
    required this.track,
    required this.skill,
    required this.title,
    required this.description,
    required this.durationSeconds,
    required this.questionCount,
    this.accent,
    this.mediaUrl,
    required this.version,
    required this.sha256,
    required this.localPath,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['pack_id'] = Variable<String>(packId);
    map['track'] = Variable<String>(track);
    map['skill'] = Variable<String>(skill);
    map['title'] = Variable<String>(title);
    map['description'] = Variable<String>(description);
    map['duration_seconds'] = Variable<int>(durationSeconds);
    map['question_count'] = Variable<int>(questionCount);
    if (!nullToAbsent || accent != null) {
      map['accent'] = Variable<String>(accent);
    }
    if (!nullToAbsent || mediaUrl != null) {
      map['media_url'] = Variable<String>(mediaUrl);
    }
    map['version'] = Variable<String>(version);
    map['sha256'] = Variable<String>(sha256);
    map['local_path'] = Variable<String>(localPath);
    return map;
  }

  ExamPacksCompanion toCompanion(bool nullToAbsent) {
    return ExamPacksCompanion(
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      packId: Value(packId),
      track: Value(track),
      skill: Value(skill),
      title: Value(title),
      description: Value(description),
      durationSeconds: Value(durationSeconds),
      questionCount: Value(questionCount),
      accent: accent == null && nullToAbsent
          ? const Value.absent()
          : Value(accent),
      mediaUrl: mediaUrl == null && nullToAbsent
          ? const Value.absent()
          : Value(mediaUrl),
      version: Value(version),
      sha256: Value(sha256),
      localPath: Value(localPath),
    );
  }

  factory ExamPackRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ExamPackRow(
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      packId: serializer.fromJson<String>(json['packId']),
      track: serializer.fromJson<String>(json['track']),
      skill: serializer.fromJson<String>(json['skill']),
      title: serializer.fromJson<String>(json['title']),
      description: serializer.fromJson<String>(json['description']),
      durationSeconds: serializer.fromJson<int>(json['durationSeconds']),
      questionCount: serializer.fromJson<int>(json['questionCount']),
      accent: serializer.fromJson<String?>(json['accent']),
      mediaUrl: serializer.fromJson<String?>(json['mediaUrl']),
      version: serializer.fromJson<String>(json['version']),
      sha256: serializer.fromJson<String>(json['sha256']),
      localPath: serializer.fromJson<String>(json['localPath']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'packId': serializer.toJson<String>(packId),
      'track': serializer.toJson<String>(track),
      'skill': serializer.toJson<String>(skill),
      'title': serializer.toJson<String>(title),
      'description': serializer.toJson<String>(description),
      'durationSeconds': serializer.toJson<int>(durationSeconds),
      'questionCount': serializer.toJson<int>(questionCount),
      'accent': serializer.toJson<String?>(accent),
      'mediaUrl': serializer.toJson<String?>(mediaUrl),
      'version': serializer.toJson<String>(version),
      'sha256': serializer.toJson<String>(sha256),
      'localPath': serializer.toJson<String>(localPath),
    };
  }

  ExamPackRow copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    String? packId,
    String? track,
    String? skill,
    String? title,
    String? description,
    int? durationSeconds,
    int? questionCount,
    Value<String?> accent = const Value.absent(),
    Value<String?> mediaUrl = const Value.absent(),
    String? version,
    String? sha256,
    String? localPath,
  }) => ExamPackRow(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    packId: packId ?? this.packId,
    track: track ?? this.track,
    skill: skill ?? this.skill,
    title: title ?? this.title,
    description: description ?? this.description,
    durationSeconds: durationSeconds ?? this.durationSeconds,
    questionCount: questionCount ?? this.questionCount,
    accent: accent.present ? accent.value : this.accent,
    mediaUrl: mediaUrl.present ? mediaUrl.value : this.mediaUrl,
    version: version ?? this.version,
    sha256: sha256 ?? this.sha256,
    localPath: localPath ?? this.localPath,
  );
  ExamPackRow copyWithCompanion(ExamPacksCompanion data) {
    return ExamPackRow(
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      packId: data.packId.present ? data.packId.value : this.packId,
      track: data.track.present ? data.track.value : this.track,
      skill: data.skill.present ? data.skill.value : this.skill,
      title: data.title.present ? data.title.value : this.title,
      description: data.description.present
          ? data.description.value
          : this.description,
      durationSeconds: data.durationSeconds.present
          ? data.durationSeconds.value
          : this.durationSeconds,
      questionCount: data.questionCount.present
          ? data.questionCount.value
          : this.questionCount,
      accent: data.accent.present ? data.accent.value : this.accent,
      mediaUrl: data.mediaUrl.present ? data.mediaUrl.value : this.mediaUrl,
      version: data.version.present ? data.version.value : this.version,
      sha256: data.sha256.present ? data.sha256.value : this.sha256,
      localPath: data.localPath.present ? data.localPath.value : this.localPath,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ExamPackRow(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('packId: $packId, ')
          ..write('track: $track, ')
          ..write('skill: $skill, ')
          ..write('title: $title, ')
          ..write('description: $description, ')
          ..write('durationSeconds: $durationSeconds, ')
          ..write('questionCount: $questionCount, ')
          ..write('accent: $accent, ')
          ..write('mediaUrl: $mediaUrl, ')
          ..write('version: $version, ')
          ..write('sha256: $sha256, ')
          ..write('localPath: $localPath')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    createdAt,
    updatedAt,
    packId,
    track,
    skill,
    title,
    description,
    durationSeconds,
    questionCount,
    accent,
    mediaUrl,
    version,
    sha256,
    localPath,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ExamPackRow &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.packId == this.packId &&
          other.track == this.track &&
          other.skill == this.skill &&
          other.title == this.title &&
          other.description == this.description &&
          other.durationSeconds == this.durationSeconds &&
          other.questionCount == this.questionCount &&
          other.accent == this.accent &&
          other.mediaUrl == this.mediaUrl &&
          other.version == this.version &&
          other.sha256 == this.sha256 &&
          other.localPath == this.localPath);
}

class ExamPacksCompanion extends UpdateCompanion<ExamPackRow> {
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<String> packId;
  final Value<String> track;
  final Value<String> skill;
  final Value<String> title;
  final Value<String> description;
  final Value<int> durationSeconds;
  final Value<int> questionCount;
  final Value<String?> accent;
  final Value<String?> mediaUrl;
  final Value<String> version;
  final Value<String> sha256;
  final Value<String> localPath;
  final Value<int> rowid;
  const ExamPacksCompanion({
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.packId = const Value.absent(),
    this.track = const Value.absent(),
    this.skill = const Value.absent(),
    this.title = const Value.absent(),
    this.description = const Value.absent(),
    this.durationSeconds = const Value.absent(),
    this.questionCount = const Value.absent(),
    this.accent = const Value.absent(),
    this.mediaUrl = const Value.absent(),
    this.version = const Value.absent(),
    this.sha256 = const Value.absent(),
    this.localPath = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ExamPacksCompanion.insert({
    required DateTime createdAt,
    required DateTime updatedAt,
    required String packId,
    this.track = const Value.absent(),
    required String skill,
    this.title = const Value.absent(),
    this.description = const Value.absent(),
    this.durationSeconds = const Value.absent(),
    this.questionCount = const Value.absent(),
    this.accent = const Value.absent(),
    this.mediaUrl = const Value.absent(),
    required String version,
    required String sha256,
    required String localPath,
    this.rowid = const Value.absent(),
  }) : createdAt = Value(createdAt),
       updatedAt = Value(updatedAt),
       packId = Value(packId),
       skill = Value(skill),
       version = Value(version),
       sha256 = Value(sha256),
       localPath = Value(localPath);
  static Insertable<ExamPackRow> custom({
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<String>? packId,
    Expression<String>? track,
    Expression<String>? skill,
    Expression<String>? title,
    Expression<String>? description,
    Expression<int>? durationSeconds,
    Expression<int>? questionCount,
    Expression<String>? accent,
    Expression<String>? mediaUrl,
    Expression<String>? version,
    Expression<String>? sha256,
    Expression<String>? localPath,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (packId != null) 'pack_id': packId,
      if (track != null) 'track': track,
      if (skill != null) 'skill': skill,
      if (title != null) 'title': title,
      if (description != null) 'description': description,
      if (durationSeconds != null) 'duration_seconds': durationSeconds,
      if (questionCount != null) 'question_count': questionCount,
      if (accent != null) 'accent': accent,
      if (mediaUrl != null) 'media_url': mediaUrl,
      if (version != null) 'version': version,
      if (sha256 != null) 'sha256': sha256,
      if (localPath != null) 'local_path': localPath,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ExamPacksCompanion copyWith({
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<String>? packId,
    Value<String>? track,
    Value<String>? skill,
    Value<String>? title,
    Value<String>? description,
    Value<int>? durationSeconds,
    Value<int>? questionCount,
    Value<String?>? accent,
    Value<String?>? mediaUrl,
    Value<String>? version,
    Value<String>? sha256,
    Value<String>? localPath,
    Value<int>? rowid,
  }) {
    return ExamPacksCompanion(
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      packId: packId ?? this.packId,
      track: track ?? this.track,
      skill: skill ?? this.skill,
      title: title ?? this.title,
      description: description ?? this.description,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      questionCount: questionCount ?? this.questionCount,
      accent: accent ?? this.accent,
      mediaUrl: mediaUrl ?? this.mediaUrl,
      version: version ?? this.version,
      sha256: sha256 ?? this.sha256,
      localPath: localPath ?? this.localPath,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (packId.present) {
      map['pack_id'] = Variable<String>(packId.value);
    }
    if (track.present) {
      map['track'] = Variable<String>(track.value);
    }
    if (skill.present) {
      map['skill'] = Variable<String>(skill.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (description.present) {
      map['description'] = Variable<String>(description.value);
    }
    if (durationSeconds.present) {
      map['duration_seconds'] = Variable<int>(durationSeconds.value);
    }
    if (questionCount.present) {
      map['question_count'] = Variable<int>(questionCount.value);
    }
    if (accent.present) {
      map['accent'] = Variable<String>(accent.value);
    }
    if (mediaUrl.present) {
      map['media_url'] = Variable<String>(mediaUrl.value);
    }
    if (version.present) {
      map['version'] = Variable<String>(version.value);
    }
    if (sha256.present) {
      map['sha256'] = Variable<String>(sha256.value);
    }
    if (localPath.present) {
      map['local_path'] = Variable<String>(localPath.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ExamPacksCompanion(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('packId: $packId, ')
          ..write('track: $track, ')
          ..write('skill: $skill, ')
          ..write('title: $title, ')
          ..write('description: $description, ')
          ..write('durationSeconds: $durationSeconds, ')
          ..write('questionCount: $questionCount, ')
          ..write('accent: $accent, ')
          ..write('mediaUrl: $mediaUrl, ')
          ..write('version: $version, ')
          ..write('sha256: $sha256, ')
          ..write('localPath: $localPath, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ExamPayloadsTable extends ExamPayloads
    with TableInfo<$ExamPayloadsTable, ExamPayloadRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ExamPayloadsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _packIdMeta = const VerificationMeta('packId');
  @override
  late final GeneratedColumn<String> packId = GeneratedColumn<String>(
    'pack_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _bundleJsonMeta = const VerificationMeta(
    'bundleJson',
  );
  @override
  late final GeneratedColumn<String> bundleJson = GeneratedColumn<String>(
    'bundle_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sizeBytesMeta = const VerificationMeta(
    'sizeBytes',
  );
  @override
  late final GeneratedColumn<int> sizeBytes = GeneratedColumn<int>(
    'size_bytes',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  @override
  List<GeneratedColumn> get $columns => [
    createdAt,
    updatedAt,
    packId,
    bundleJson,
    sizeBytes,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'exam_payloads';
  @override
  VerificationContext validateIntegrity(
    Insertable<ExamPayloadRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('pack_id')) {
      context.handle(
        _packIdMeta,
        packId.isAcceptableOrUnknown(data['pack_id']!, _packIdMeta),
      );
    } else if (isInserting) {
      context.missing(_packIdMeta);
    }
    if (data.containsKey('bundle_json')) {
      context.handle(
        _bundleJsonMeta,
        bundleJson.isAcceptableOrUnknown(data['bundle_json']!, _bundleJsonMeta),
      );
    } else if (isInserting) {
      context.missing(_bundleJsonMeta);
    }
    if (data.containsKey('size_bytes')) {
      context.handle(
        _sizeBytesMeta,
        sizeBytes.isAcceptableOrUnknown(data['size_bytes']!, _sizeBytesMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {packId};
  @override
  ExamPayloadRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ExamPayloadRow(
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      packId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pack_id'],
      )!,
      bundleJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}bundle_json'],
      )!,
      sizeBytes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}size_bytes'],
      )!,
    );
  }

  @override
  $ExamPayloadsTable createAlias(String alias) {
    return $ExamPayloadsTable(attachedDatabase, alias);
  }
}

class ExamPayloadRow extends DataClass implements Insertable<ExamPayloadRow> {
  /// Record creation timestamp in UTC.
  final DateTime createdAt;

  /// Last local mutation timestamp in UTC.
  final DateTime updatedAt;

  /// Pack primary key matching `ExamPacks.packId`.
  final String packId;

  /// Serialized `ExamBundle` JSON payload (sections, prompts, questions).
  final String bundleJson;

  /// Byte size of the cached payload for storage diagnostics.
  final int sizeBytes;
  const ExamPayloadRow({
    required this.createdAt,
    required this.updatedAt,
    required this.packId,
    required this.bundleJson,
    required this.sizeBytes,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['pack_id'] = Variable<String>(packId);
    map['bundle_json'] = Variable<String>(bundleJson);
    map['size_bytes'] = Variable<int>(sizeBytes);
    return map;
  }

  ExamPayloadsCompanion toCompanion(bool nullToAbsent) {
    return ExamPayloadsCompanion(
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      packId: Value(packId),
      bundleJson: Value(bundleJson),
      sizeBytes: Value(sizeBytes),
    );
  }

  factory ExamPayloadRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ExamPayloadRow(
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      packId: serializer.fromJson<String>(json['packId']),
      bundleJson: serializer.fromJson<String>(json['bundleJson']),
      sizeBytes: serializer.fromJson<int>(json['sizeBytes']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'packId': serializer.toJson<String>(packId),
      'bundleJson': serializer.toJson<String>(bundleJson),
      'sizeBytes': serializer.toJson<int>(sizeBytes),
    };
  }

  ExamPayloadRow copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    String? packId,
    String? bundleJson,
    int? sizeBytes,
  }) => ExamPayloadRow(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    packId: packId ?? this.packId,
    bundleJson: bundleJson ?? this.bundleJson,
    sizeBytes: sizeBytes ?? this.sizeBytes,
  );
  ExamPayloadRow copyWithCompanion(ExamPayloadsCompanion data) {
    return ExamPayloadRow(
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      packId: data.packId.present ? data.packId.value : this.packId,
      bundleJson: data.bundleJson.present
          ? data.bundleJson.value
          : this.bundleJson,
      sizeBytes: data.sizeBytes.present ? data.sizeBytes.value : this.sizeBytes,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ExamPayloadRow(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('packId: $packId, ')
          ..write('bundleJson: $bundleJson, ')
          ..write('sizeBytes: $sizeBytes')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(createdAt, updatedAt, packId, bundleJson, sizeBytes);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ExamPayloadRow &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.packId == this.packId &&
          other.bundleJson == this.bundleJson &&
          other.sizeBytes == this.sizeBytes);
}

class ExamPayloadsCompanion extends UpdateCompanion<ExamPayloadRow> {
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<String> packId;
  final Value<String> bundleJson;
  final Value<int> sizeBytes;
  final Value<int> rowid;
  const ExamPayloadsCompanion({
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.packId = const Value.absent(),
    this.bundleJson = const Value.absent(),
    this.sizeBytes = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ExamPayloadsCompanion.insert({
    required DateTime createdAt,
    required DateTime updatedAt,
    required String packId,
    required String bundleJson,
    this.sizeBytes = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : createdAt = Value(createdAt),
       updatedAt = Value(updatedAt),
       packId = Value(packId),
       bundleJson = Value(bundleJson);
  static Insertable<ExamPayloadRow> custom({
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<String>? packId,
    Expression<String>? bundleJson,
    Expression<int>? sizeBytes,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (packId != null) 'pack_id': packId,
      if (bundleJson != null) 'bundle_json': bundleJson,
      if (sizeBytes != null) 'size_bytes': sizeBytes,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ExamPayloadsCompanion copyWith({
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<String>? packId,
    Value<String>? bundleJson,
    Value<int>? sizeBytes,
    Value<int>? rowid,
  }) {
    return ExamPayloadsCompanion(
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      packId: packId ?? this.packId,
      bundleJson: bundleJson ?? this.bundleJson,
      sizeBytes: sizeBytes ?? this.sizeBytes,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (packId.present) {
      map['pack_id'] = Variable<String>(packId.value);
    }
    if (bundleJson.present) {
      map['bundle_json'] = Variable<String>(bundleJson.value);
    }
    if (sizeBytes.present) {
      map['size_bytes'] = Variable<int>(sizeBytes.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ExamPayloadsCompanion(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('packId: $packId, ')
          ..write('bundleJson: $bundleJson, ')
          ..write('sizeBytes: $sizeBytes, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedDrillsTable extends CachedDrills
    with TableInfo<$CachedDrillsTable, CachedDrillRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedDrillsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _drillIdMeta = const VerificationMeta(
    'drillId',
  );
  @override
  late final GeneratedColumn<String> drillId = GeneratedColumn<String>(
    'drill_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _drillTypeMeta = const VerificationMeta(
    'drillType',
  );
  @override
  late final GeneratedColumn<String> drillType = GeneratedColumn<String>(
    'drill_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _skillMeta = const VerificationMeta('skill');
  @override
  late final GeneratedColumn<String> skill = GeneratedColumn<String>(
    'skill',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('reading'),
  );
  static const VerificationMeta _durationSecondsMeta = const VerificationMeta(
    'durationSeconds',
  );
  @override
  late final GeneratedColumn<int> durationSeconds = GeneratedColumn<int>(
    'duration_seconds',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(180),
  );
  static const VerificationMeta _itemsJsonMeta = const VerificationMeta(
    'itemsJson',
  );
  @override
  late final GeneratedColumn<String> itemsJson = GeneratedColumn<String>(
    'items_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    createdAt,
    updatedAt,
    drillId,
    title,
    drillType,
    skill,
    durationSeconds,
    itemsJson,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_drills';
  @override
  VerificationContext validateIntegrity(
    Insertable<CachedDrillRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('drill_id')) {
      context.handle(
        _drillIdMeta,
        drillId.isAcceptableOrUnknown(data['drill_id']!, _drillIdMeta),
      );
    } else if (isInserting) {
      context.missing(_drillIdMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('drill_type')) {
      context.handle(
        _drillTypeMeta,
        drillType.isAcceptableOrUnknown(data['drill_type']!, _drillTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_drillTypeMeta);
    }
    if (data.containsKey('skill')) {
      context.handle(
        _skillMeta,
        skill.isAcceptableOrUnknown(data['skill']!, _skillMeta),
      );
    }
    if (data.containsKey('duration_seconds')) {
      context.handle(
        _durationSecondsMeta,
        durationSeconds.isAcceptableOrUnknown(
          data['duration_seconds']!,
          _durationSecondsMeta,
        ),
      );
    }
    if (data.containsKey('items_json')) {
      context.handle(
        _itemsJsonMeta,
        itemsJson.isAcceptableOrUnknown(data['items_json']!, _itemsJsonMeta),
      );
    } else if (isInserting) {
      context.missing(_itemsJsonMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {drillId};
  @override
  CachedDrillRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedDrillRow(
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      drillId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}drill_id'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      drillType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}drill_type'],
      )!,
      skill: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}skill'],
      )!,
      durationSeconds: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}duration_seconds'],
      )!,
      itemsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}items_json'],
      )!,
    );
  }

  @override
  $CachedDrillsTable createAlias(String alias) {
    return $CachedDrillsTable(attachedDatabase, alias);
  }
}

class CachedDrillRow extends DataClass implements Insertable<CachedDrillRow> {
  /// Record creation timestamp in UTC.
  final DateTime createdAt;

  /// Last local mutation timestamp in UTC.
  final DateTime updatedAt;

  /// Unique drill identifier.
  final String drillId;

  /// Drill display title.
  final String title;

  /// Weakness/criterion category code (`CC`, `LR`, `GRA`, `FC`).
  final String drillType;

  /// Associated IELTS skill (`speaking`, `writing`, `reading`, `listening`).
  final String skill;

  /// Timer allowance in seconds.
  final int durationSeconds;

  /// JSON-serialized array of drill exercise items.
  final String itemsJson;
  const CachedDrillRow({
    required this.createdAt,
    required this.updatedAt,
    required this.drillId,
    required this.title,
    required this.drillType,
    required this.skill,
    required this.durationSeconds,
    required this.itemsJson,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['drill_id'] = Variable<String>(drillId);
    map['title'] = Variable<String>(title);
    map['drill_type'] = Variable<String>(drillType);
    map['skill'] = Variable<String>(skill);
    map['duration_seconds'] = Variable<int>(durationSeconds);
    map['items_json'] = Variable<String>(itemsJson);
    return map;
  }

  CachedDrillsCompanion toCompanion(bool nullToAbsent) {
    return CachedDrillsCompanion(
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      drillId: Value(drillId),
      title: Value(title),
      drillType: Value(drillType),
      skill: Value(skill),
      durationSeconds: Value(durationSeconds),
      itemsJson: Value(itemsJson),
    );
  }

  factory CachedDrillRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedDrillRow(
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      drillId: serializer.fromJson<String>(json['drillId']),
      title: serializer.fromJson<String>(json['title']),
      drillType: serializer.fromJson<String>(json['drillType']),
      skill: serializer.fromJson<String>(json['skill']),
      durationSeconds: serializer.fromJson<int>(json['durationSeconds']),
      itemsJson: serializer.fromJson<String>(json['itemsJson']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'drillId': serializer.toJson<String>(drillId),
      'title': serializer.toJson<String>(title),
      'drillType': serializer.toJson<String>(drillType),
      'skill': serializer.toJson<String>(skill),
      'durationSeconds': serializer.toJson<int>(durationSeconds),
      'itemsJson': serializer.toJson<String>(itemsJson),
    };
  }

  CachedDrillRow copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    String? drillId,
    String? title,
    String? drillType,
    String? skill,
    int? durationSeconds,
    String? itemsJson,
  }) => CachedDrillRow(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    drillId: drillId ?? this.drillId,
    title: title ?? this.title,
    drillType: drillType ?? this.drillType,
    skill: skill ?? this.skill,
    durationSeconds: durationSeconds ?? this.durationSeconds,
    itemsJson: itemsJson ?? this.itemsJson,
  );
  CachedDrillRow copyWithCompanion(CachedDrillsCompanion data) {
    return CachedDrillRow(
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      drillId: data.drillId.present ? data.drillId.value : this.drillId,
      title: data.title.present ? data.title.value : this.title,
      drillType: data.drillType.present ? data.drillType.value : this.drillType,
      skill: data.skill.present ? data.skill.value : this.skill,
      durationSeconds: data.durationSeconds.present
          ? data.durationSeconds.value
          : this.durationSeconds,
      itemsJson: data.itemsJson.present ? data.itemsJson.value : this.itemsJson,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedDrillRow(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('drillId: $drillId, ')
          ..write('title: $title, ')
          ..write('drillType: $drillType, ')
          ..write('skill: $skill, ')
          ..write('durationSeconds: $durationSeconds, ')
          ..write('itemsJson: $itemsJson')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    createdAt,
    updatedAt,
    drillId,
    title,
    drillType,
    skill,
    durationSeconds,
    itemsJson,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedDrillRow &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.drillId == this.drillId &&
          other.title == this.title &&
          other.drillType == this.drillType &&
          other.skill == this.skill &&
          other.durationSeconds == this.durationSeconds &&
          other.itemsJson == this.itemsJson);
}

class CachedDrillsCompanion extends UpdateCompanion<CachedDrillRow> {
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<String> drillId;
  final Value<String> title;
  final Value<String> drillType;
  final Value<String> skill;
  final Value<int> durationSeconds;
  final Value<String> itemsJson;
  final Value<int> rowid;
  const CachedDrillsCompanion({
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.drillId = const Value.absent(),
    this.title = const Value.absent(),
    this.drillType = const Value.absent(),
    this.skill = const Value.absent(),
    this.durationSeconds = const Value.absent(),
    this.itemsJson = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedDrillsCompanion.insert({
    required DateTime createdAt,
    required DateTime updatedAt,
    required String drillId,
    required String title,
    required String drillType,
    this.skill = const Value.absent(),
    this.durationSeconds = const Value.absent(),
    required String itemsJson,
    this.rowid = const Value.absent(),
  }) : createdAt = Value(createdAt),
       updatedAt = Value(updatedAt),
       drillId = Value(drillId),
       title = Value(title),
       drillType = Value(drillType),
       itemsJson = Value(itemsJson);
  static Insertable<CachedDrillRow> custom({
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<String>? drillId,
    Expression<String>? title,
    Expression<String>? drillType,
    Expression<String>? skill,
    Expression<int>? durationSeconds,
    Expression<String>? itemsJson,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (drillId != null) 'drill_id': drillId,
      if (title != null) 'title': title,
      if (drillType != null) 'drill_type': drillType,
      if (skill != null) 'skill': skill,
      if (durationSeconds != null) 'duration_seconds': durationSeconds,
      if (itemsJson != null) 'items_json': itemsJson,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedDrillsCompanion copyWith({
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<String>? drillId,
    Value<String>? title,
    Value<String>? drillType,
    Value<String>? skill,
    Value<int>? durationSeconds,
    Value<String>? itemsJson,
    Value<int>? rowid,
  }) {
    return CachedDrillsCompanion(
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      drillId: drillId ?? this.drillId,
      title: title ?? this.title,
      drillType: drillType ?? this.drillType,
      skill: skill ?? this.skill,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      itemsJson: itemsJson ?? this.itemsJson,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (drillId.present) {
      map['drill_id'] = Variable<String>(drillId.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (drillType.present) {
      map['drill_type'] = Variable<String>(drillType.value);
    }
    if (skill.present) {
      map['skill'] = Variable<String>(skill.value);
    }
    if (durationSeconds.present) {
      map['duration_seconds'] = Variable<int>(durationSeconds.value);
    }
    if (itemsJson.present) {
      map['items_json'] = Variable<String>(itemsJson.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedDrillsCompanion(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('drillId: $drillId, ')
          ..write('title: $title, ')
          ..write('drillType: $drillType, ')
          ..write('skill: $skill, ')
          ..write('durationSeconds: $durationSeconds, ')
          ..write('itemsJson: $itemsJson, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ExamAttemptsTable extends ExamAttempts
    with TableInfo<$ExamAttemptsTable, ExamAttemptRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ExamAttemptsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attemptIdMeta = const VerificationMeta(
    'attemptId',
  );
  @override
  late final GeneratedColumn<String> attemptId = GeneratedColumn<String>(
    'attempt_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _examIdMeta = const VerificationMeta('examId');
  @override
  late final GeneratedColumn<String> examId = GeneratedColumn<String>(
    'exam_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('ielts_academic'),
  );
  static const VerificationMeta _packIdMeta = const VerificationMeta('packId');
  @override
  late final GeneratedColumn<String> packId = GeneratedColumn<String>(
    'pack_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _skillMeta = const VerificationMeta('skill');
  @override
  late final GeneratedColumn<String> skill = GeneratedColumn<String>(
    'skill',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _remoteJobIdMeta = const VerificationMeta(
    'remoteJobId',
  );
  @override
  late final GeneratedColumn<String> remoteJobId = GeneratedColumn<String>(
    'remote_job_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _submissionJsonMeta = const VerificationMeta(
    'submissionJson',
  );
  @override
  late final GeneratedColumn<String> submissionJson = GeneratedColumn<String>(
    'submission_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _evaluationJsonMeta = const VerificationMeta(
    'evaluationJson',
  );
  @override
  late final GeneratedColumn<String> evaluationJson = GeneratedColumn<String>(
    'evaluation_json',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _overallBandMeta = const VerificationMeta(
    'overallBand',
  );
  @override
  late final GeneratedColumn<double> overallBand = GeneratedColumn<double>(
    'overall_band',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _errorCodeMeta = const VerificationMeta(
    'errorCode',
  );
  @override
  late final GeneratedColumn<String> errorCode = GeneratedColumn<String>(
    'error_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _startedAtUtcMsMeta = const VerificationMeta(
    'startedAtUtcMs',
  );
  @override
  late final GeneratedColumn<int> startedAtUtcMs = GeneratedColumn<int>(
    'started_at_utc_ms',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _completedAtUtcMsMeta = const VerificationMeta(
    'completedAtUtcMs',
  );
  @override
  late final GeneratedColumn<int> completedAtUtcMs = GeneratedColumn<int>(
    'completed_at_utc_ms',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _durationSecondsMeta = const VerificationMeta(
    'durationSeconds',
  );
  @override
  late final GeneratedColumn<int> durationSeconds = GeneratedColumn<int>(
    'duration_seconds',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _usedStudyModeMeta = const VerificationMeta(
    'usedStudyMode',
  );
  @override
  late final GeneratedColumn<bool> usedStudyMode = GeneratedColumn<bool>(
    'used_study_mode',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("used_study_mode" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [
    createdAt,
    updatedAt,
    attemptId,
    examId,
    packId,
    skill,
    status,
    remoteJobId,
    submissionJson,
    evaluationJson,
    overallBand,
    errorCode,
    startedAtUtcMs,
    completedAtUtcMs,
    durationSeconds,
    usedStudyMode,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'exam_attempts';
  @override
  VerificationContext validateIntegrity(
    Insertable<ExamAttemptRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('attempt_id')) {
      context.handle(
        _attemptIdMeta,
        attemptId.isAcceptableOrUnknown(data['attempt_id']!, _attemptIdMeta),
      );
    } else if (isInserting) {
      context.missing(_attemptIdMeta);
    }
    if (data.containsKey('exam_id')) {
      context.handle(
        _examIdMeta,
        examId.isAcceptableOrUnknown(data['exam_id']!, _examIdMeta),
      );
    }
    if (data.containsKey('pack_id')) {
      context.handle(
        _packIdMeta,
        packId.isAcceptableOrUnknown(data['pack_id']!, _packIdMeta),
      );
    } else if (isInserting) {
      context.missing(_packIdMeta);
    }
    if (data.containsKey('skill')) {
      context.handle(
        _skillMeta,
        skill.isAcceptableOrUnknown(data['skill']!, _skillMeta),
      );
    } else if (isInserting) {
      context.missing(_skillMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    } else if (isInserting) {
      context.missing(_statusMeta);
    }
    if (data.containsKey('remote_job_id')) {
      context.handle(
        _remoteJobIdMeta,
        remoteJobId.isAcceptableOrUnknown(
          data['remote_job_id']!,
          _remoteJobIdMeta,
        ),
      );
    }
    if (data.containsKey('submission_json')) {
      context.handle(
        _submissionJsonMeta,
        submissionJson.isAcceptableOrUnknown(
          data['submission_json']!,
          _submissionJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_submissionJsonMeta);
    }
    if (data.containsKey('evaluation_json')) {
      context.handle(
        _evaluationJsonMeta,
        evaluationJson.isAcceptableOrUnknown(
          data['evaluation_json']!,
          _evaluationJsonMeta,
        ),
      );
    }
    if (data.containsKey('overall_band')) {
      context.handle(
        _overallBandMeta,
        overallBand.isAcceptableOrUnknown(
          data['overall_band']!,
          _overallBandMeta,
        ),
      );
    }
    if (data.containsKey('error_code')) {
      context.handle(
        _errorCodeMeta,
        errorCode.isAcceptableOrUnknown(data['error_code']!, _errorCodeMeta),
      );
    }
    if (data.containsKey('started_at_utc_ms')) {
      context.handle(
        _startedAtUtcMsMeta,
        startedAtUtcMs.isAcceptableOrUnknown(
          data['started_at_utc_ms']!,
          _startedAtUtcMsMeta,
        ),
      );
    }
    if (data.containsKey('completed_at_utc_ms')) {
      context.handle(
        _completedAtUtcMsMeta,
        completedAtUtcMs.isAcceptableOrUnknown(
          data['completed_at_utc_ms']!,
          _completedAtUtcMsMeta,
        ),
      );
    }
    if (data.containsKey('duration_seconds')) {
      context.handle(
        _durationSecondsMeta,
        durationSeconds.isAcceptableOrUnknown(
          data['duration_seconds']!,
          _durationSecondsMeta,
        ),
      );
    }
    if (data.containsKey('used_study_mode')) {
      context.handle(
        _usedStudyModeMeta,
        usedStudyMode.isAcceptableOrUnknown(
          data['used_study_mode']!,
          _usedStudyModeMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {attemptId};
  @override
  ExamAttemptRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ExamAttemptRow(
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      attemptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}attempt_id'],
      )!,
      examId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}exam_id'],
      )!,
      packId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pack_id'],
      )!,
      skill: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}skill'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      remoteJobId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}remote_job_id'],
      ),
      submissionJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}submission_json'],
      )!,
      evaluationJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}evaluation_json'],
      ),
      overallBand: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}overall_band'],
      ),
      errorCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}error_code'],
      ),
      startedAtUtcMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}started_at_utc_ms'],
      ),
      completedAtUtcMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}completed_at_utc_ms'],
      ),
      durationSeconds: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}duration_seconds'],
      )!,
      usedStudyMode: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}used_study_mode'],
      )!,
    );
  }

  @override
  $ExamAttemptsTable createAlias(String alias) {
    return $ExamAttemptsTable(attachedDatabase, alias);
  }
}

class ExamAttemptRow extends DataClass implements Insertable<ExamAttemptRow> {
  /// Record creation timestamp in UTC.
  final DateTime createdAt;

  /// Last local mutation timestamp in UTC.
  final DateTime updatedAt;

  /// Client-generated UUIDv4 identifier used as backend idempotency key.
  final String attemptId;

  /// Target exam track (`ielts_academic`, `ielts_general`, `pte_academic`, etc.).
  final String examId;

  /// Owning content pack identifier.
  final String packId;

  /// Primary skill (`speaking`, `writing`, `reading`, `listening`).
  final String skill;

  /// Lifecycle state matching `AttemptStatus.name`.
  final String status;

  /// Server evaluation job ID once queued on the backend.
  final String? remoteJobId;

  /// JSON-serialized submission payload (answers map or essay text).
  final String submissionJson;

  /// JSON-serialized local or AI rubric evaluation output.
  final String? evaluationJson;

  /// Final IELTS band if already scored (`0.0..9.0`).
  final double? overallBand;

  /// Non-secret user-visible retry reason when upload/evaluation fails.
  final String? errorCode;

  /// Session start timestamp in UTC milliseconds.
  final int? startedAtUtcMs;

  /// Session completion timestamp in UTC milliseconds.
  final int? completedAtUtcMs;

  /// Total duration spent active in seconds.
  final int durationSeconds;

  /// Whether the attempt was conducted in untimed study mode rather than exam mode.
  final bool usedStudyMode;
  const ExamAttemptRow({
    required this.createdAt,
    required this.updatedAt,
    required this.attemptId,
    required this.examId,
    required this.packId,
    required this.skill,
    required this.status,
    this.remoteJobId,
    required this.submissionJson,
    this.evaluationJson,
    this.overallBand,
    this.errorCode,
    this.startedAtUtcMs,
    this.completedAtUtcMs,
    required this.durationSeconds,
    required this.usedStudyMode,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['attempt_id'] = Variable<String>(attemptId);
    map['exam_id'] = Variable<String>(examId);
    map['pack_id'] = Variable<String>(packId);
    map['skill'] = Variable<String>(skill);
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || remoteJobId != null) {
      map['remote_job_id'] = Variable<String>(remoteJobId);
    }
    map['submission_json'] = Variable<String>(submissionJson);
    if (!nullToAbsent || evaluationJson != null) {
      map['evaluation_json'] = Variable<String>(evaluationJson);
    }
    if (!nullToAbsent || overallBand != null) {
      map['overall_band'] = Variable<double>(overallBand);
    }
    if (!nullToAbsent || errorCode != null) {
      map['error_code'] = Variable<String>(errorCode);
    }
    if (!nullToAbsent || startedAtUtcMs != null) {
      map['started_at_utc_ms'] = Variable<int>(startedAtUtcMs);
    }
    if (!nullToAbsent || completedAtUtcMs != null) {
      map['completed_at_utc_ms'] = Variable<int>(completedAtUtcMs);
    }
    map['duration_seconds'] = Variable<int>(durationSeconds);
    map['used_study_mode'] = Variable<bool>(usedStudyMode);
    return map;
  }

  ExamAttemptsCompanion toCompanion(bool nullToAbsent) {
    return ExamAttemptsCompanion(
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      attemptId: Value(attemptId),
      examId: Value(examId),
      packId: Value(packId),
      skill: Value(skill),
      status: Value(status),
      remoteJobId: remoteJobId == null && nullToAbsent
          ? const Value.absent()
          : Value(remoteJobId),
      submissionJson: Value(submissionJson),
      evaluationJson: evaluationJson == null && nullToAbsent
          ? const Value.absent()
          : Value(evaluationJson),
      overallBand: overallBand == null && nullToAbsent
          ? const Value.absent()
          : Value(overallBand),
      errorCode: errorCode == null && nullToAbsent
          ? const Value.absent()
          : Value(errorCode),
      startedAtUtcMs: startedAtUtcMs == null && nullToAbsent
          ? const Value.absent()
          : Value(startedAtUtcMs),
      completedAtUtcMs: completedAtUtcMs == null && nullToAbsent
          ? const Value.absent()
          : Value(completedAtUtcMs),
      durationSeconds: Value(durationSeconds),
      usedStudyMode: Value(usedStudyMode),
    );
  }

  factory ExamAttemptRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ExamAttemptRow(
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      attemptId: serializer.fromJson<String>(json['attemptId']),
      examId: serializer.fromJson<String>(json['examId']),
      packId: serializer.fromJson<String>(json['packId']),
      skill: serializer.fromJson<String>(json['skill']),
      status: serializer.fromJson<String>(json['status']),
      remoteJobId: serializer.fromJson<String?>(json['remoteJobId']),
      submissionJson: serializer.fromJson<String>(json['submissionJson']),
      evaluationJson: serializer.fromJson<String?>(json['evaluationJson']),
      overallBand: serializer.fromJson<double?>(json['overallBand']),
      errorCode: serializer.fromJson<String?>(json['errorCode']),
      startedAtUtcMs: serializer.fromJson<int?>(json['startedAtUtcMs']),
      completedAtUtcMs: serializer.fromJson<int?>(json['completedAtUtcMs']),
      durationSeconds: serializer.fromJson<int>(json['durationSeconds']),
      usedStudyMode: serializer.fromJson<bool>(json['usedStudyMode']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'attemptId': serializer.toJson<String>(attemptId),
      'examId': serializer.toJson<String>(examId),
      'packId': serializer.toJson<String>(packId),
      'skill': serializer.toJson<String>(skill),
      'status': serializer.toJson<String>(status),
      'remoteJobId': serializer.toJson<String?>(remoteJobId),
      'submissionJson': serializer.toJson<String>(submissionJson),
      'evaluationJson': serializer.toJson<String?>(evaluationJson),
      'overallBand': serializer.toJson<double?>(overallBand),
      'errorCode': serializer.toJson<String?>(errorCode),
      'startedAtUtcMs': serializer.toJson<int?>(startedAtUtcMs),
      'completedAtUtcMs': serializer.toJson<int?>(completedAtUtcMs),
      'durationSeconds': serializer.toJson<int>(durationSeconds),
      'usedStudyMode': serializer.toJson<bool>(usedStudyMode),
    };
  }

  ExamAttemptRow copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    String? attemptId,
    String? examId,
    String? packId,
    String? skill,
    String? status,
    Value<String?> remoteJobId = const Value.absent(),
    String? submissionJson,
    Value<String?> evaluationJson = const Value.absent(),
    Value<double?> overallBand = const Value.absent(),
    Value<String?> errorCode = const Value.absent(),
    Value<int?> startedAtUtcMs = const Value.absent(),
    Value<int?> completedAtUtcMs = const Value.absent(),
    int? durationSeconds,
    bool? usedStudyMode,
  }) => ExamAttemptRow(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    attemptId: attemptId ?? this.attemptId,
    examId: examId ?? this.examId,
    packId: packId ?? this.packId,
    skill: skill ?? this.skill,
    status: status ?? this.status,
    remoteJobId: remoteJobId.present ? remoteJobId.value : this.remoteJobId,
    submissionJson: submissionJson ?? this.submissionJson,
    evaluationJson: evaluationJson.present
        ? evaluationJson.value
        : this.evaluationJson,
    overallBand: overallBand.present ? overallBand.value : this.overallBand,
    errorCode: errorCode.present ? errorCode.value : this.errorCode,
    startedAtUtcMs: startedAtUtcMs.present
        ? startedAtUtcMs.value
        : this.startedAtUtcMs,
    completedAtUtcMs: completedAtUtcMs.present
        ? completedAtUtcMs.value
        : this.completedAtUtcMs,
    durationSeconds: durationSeconds ?? this.durationSeconds,
    usedStudyMode: usedStudyMode ?? this.usedStudyMode,
  );
  ExamAttemptRow copyWithCompanion(ExamAttemptsCompanion data) {
    return ExamAttemptRow(
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      attemptId: data.attemptId.present ? data.attemptId.value : this.attemptId,
      examId: data.examId.present ? data.examId.value : this.examId,
      packId: data.packId.present ? data.packId.value : this.packId,
      skill: data.skill.present ? data.skill.value : this.skill,
      status: data.status.present ? data.status.value : this.status,
      remoteJobId: data.remoteJobId.present
          ? data.remoteJobId.value
          : this.remoteJobId,
      submissionJson: data.submissionJson.present
          ? data.submissionJson.value
          : this.submissionJson,
      evaluationJson: data.evaluationJson.present
          ? data.evaluationJson.value
          : this.evaluationJson,
      overallBand: data.overallBand.present
          ? data.overallBand.value
          : this.overallBand,
      errorCode: data.errorCode.present ? data.errorCode.value : this.errorCode,
      startedAtUtcMs: data.startedAtUtcMs.present
          ? data.startedAtUtcMs.value
          : this.startedAtUtcMs,
      completedAtUtcMs: data.completedAtUtcMs.present
          ? data.completedAtUtcMs.value
          : this.completedAtUtcMs,
      durationSeconds: data.durationSeconds.present
          ? data.durationSeconds.value
          : this.durationSeconds,
      usedStudyMode: data.usedStudyMode.present
          ? data.usedStudyMode.value
          : this.usedStudyMode,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ExamAttemptRow(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('attemptId: $attemptId, ')
          ..write('examId: $examId, ')
          ..write('packId: $packId, ')
          ..write('skill: $skill, ')
          ..write('status: $status, ')
          ..write('remoteJobId: $remoteJobId, ')
          ..write('submissionJson: $submissionJson, ')
          ..write('evaluationJson: $evaluationJson, ')
          ..write('overallBand: $overallBand, ')
          ..write('errorCode: $errorCode, ')
          ..write('startedAtUtcMs: $startedAtUtcMs, ')
          ..write('completedAtUtcMs: $completedAtUtcMs, ')
          ..write('durationSeconds: $durationSeconds, ')
          ..write('usedStudyMode: $usedStudyMode')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    createdAt,
    updatedAt,
    attemptId,
    examId,
    packId,
    skill,
    status,
    remoteJobId,
    submissionJson,
    evaluationJson,
    overallBand,
    errorCode,
    startedAtUtcMs,
    completedAtUtcMs,
    durationSeconds,
    usedStudyMode,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ExamAttemptRow &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.attemptId == this.attemptId &&
          other.examId == this.examId &&
          other.packId == this.packId &&
          other.skill == this.skill &&
          other.status == this.status &&
          other.remoteJobId == this.remoteJobId &&
          other.submissionJson == this.submissionJson &&
          other.evaluationJson == this.evaluationJson &&
          other.overallBand == this.overallBand &&
          other.errorCode == this.errorCode &&
          other.startedAtUtcMs == this.startedAtUtcMs &&
          other.completedAtUtcMs == this.completedAtUtcMs &&
          other.durationSeconds == this.durationSeconds &&
          other.usedStudyMode == this.usedStudyMode);
}

class ExamAttemptsCompanion extends UpdateCompanion<ExamAttemptRow> {
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<String> attemptId;
  final Value<String> examId;
  final Value<String> packId;
  final Value<String> skill;
  final Value<String> status;
  final Value<String?> remoteJobId;
  final Value<String> submissionJson;
  final Value<String?> evaluationJson;
  final Value<double?> overallBand;
  final Value<String?> errorCode;
  final Value<int?> startedAtUtcMs;
  final Value<int?> completedAtUtcMs;
  final Value<int> durationSeconds;
  final Value<bool> usedStudyMode;
  final Value<int> rowid;
  const ExamAttemptsCompanion({
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.attemptId = const Value.absent(),
    this.examId = const Value.absent(),
    this.packId = const Value.absent(),
    this.skill = const Value.absent(),
    this.status = const Value.absent(),
    this.remoteJobId = const Value.absent(),
    this.submissionJson = const Value.absent(),
    this.evaluationJson = const Value.absent(),
    this.overallBand = const Value.absent(),
    this.errorCode = const Value.absent(),
    this.startedAtUtcMs = const Value.absent(),
    this.completedAtUtcMs = const Value.absent(),
    this.durationSeconds = const Value.absent(),
    this.usedStudyMode = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ExamAttemptsCompanion.insert({
    required DateTime createdAt,
    required DateTime updatedAt,
    required String attemptId,
    this.examId = const Value.absent(),
    required String packId,
    required String skill,
    required String status,
    this.remoteJobId = const Value.absent(),
    required String submissionJson,
    this.evaluationJson = const Value.absent(),
    this.overallBand = const Value.absent(),
    this.errorCode = const Value.absent(),
    this.startedAtUtcMs = const Value.absent(),
    this.completedAtUtcMs = const Value.absent(),
    this.durationSeconds = const Value.absent(),
    this.usedStudyMode = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : createdAt = Value(createdAt),
       updatedAt = Value(updatedAt),
       attemptId = Value(attemptId),
       packId = Value(packId),
       skill = Value(skill),
       status = Value(status),
       submissionJson = Value(submissionJson);
  static Insertable<ExamAttemptRow> custom({
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<String>? attemptId,
    Expression<String>? examId,
    Expression<String>? packId,
    Expression<String>? skill,
    Expression<String>? status,
    Expression<String>? remoteJobId,
    Expression<String>? submissionJson,
    Expression<String>? evaluationJson,
    Expression<double>? overallBand,
    Expression<String>? errorCode,
    Expression<int>? startedAtUtcMs,
    Expression<int>? completedAtUtcMs,
    Expression<int>? durationSeconds,
    Expression<bool>? usedStudyMode,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (attemptId != null) 'attempt_id': attemptId,
      if (examId != null) 'exam_id': examId,
      if (packId != null) 'pack_id': packId,
      if (skill != null) 'skill': skill,
      if (status != null) 'status': status,
      if (remoteJobId != null) 'remote_job_id': remoteJobId,
      if (submissionJson != null) 'submission_json': submissionJson,
      if (evaluationJson != null) 'evaluation_json': evaluationJson,
      if (overallBand != null) 'overall_band': overallBand,
      if (errorCode != null) 'error_code': errorCode,
      if (startedAtUtcMs != null) 'started_at_utc_ms': startedAtUtcMs,
      if (completedAtUtcMs != null) 'completed_at_utc_ms': completedAtUtcMs,
      if (durationSeconds != null) 'duration_seconds': durationSeconds,
      if (usedStudyMode != null) 'used_study_mode': usedStudyMode,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ExamAttemptsCompanion copyWith({
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<String>? attemptId,
    Value<String>? examId,
    Value<String>? packId,
    Value<String>? skill,
    Value<String>? status,
    Value<String?>? remoteJobId,
    Value<String>? submissionJson,
    Value<String?>? evaluationJson,
    Value<double?>? overallBand,
    Value<String?>? errorCode,
    Value<int?>? startedAtUtcMs,
    Value<int?>? completedAtUtcMs,
    Value<int>? durationSeconds,
    Value<bool>? usedStudyMode,
    Value<int>? rowid,
  }) {
    return ExamAttemptsCompanion(
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      attemptId: attemptId ?? this.attemptId,
      examId: examId ?? this.examId,
      packId: packId ?? this.packId,
      skill: skill ?? this.skill,
      status: status ?? this.status,
      remoteJobId: remoteJobId ?? this.remoteJobId,
      submissionJson: submissionJson ?? this.submissionJson,
      evaluationJson: evaluationJson ?? this.evaluationJson,
      overallBand: overallBand ?? this.overallBand,
      errorCode: errorCode ?? this.errorCode,
      startedAtUtcMs: startedAtUtcMs ?? this.startedAtUtcMs,
      completedAtUtcMs: completedAtUtcMs ?? this.completedAtUtcMs,
      durationSeconds: durationSeconds ?? this.durationSeconds,
      usedStudyMode: usedStudyMode ?? this.usedStudyMode,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (attemptId.present) {
      map['attempt_id'] = Variable<String>(attemptId.value);
    }
    if (examId.present) {
      map['exam_id'] = Variable<String>(examId.value);
    }
    if (packId.present) {
      map['pack_id'] = Variable<String>(packId.value);
    }
    if (skill.present) {
      map['skill'] = Variable<String>(skill.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (remoteJobId.present) {
      map['remote_job_id'] = Variable<String>(remoteJobId.value);
    }
    if (submissionJson.present) {
      map['submission_json'] = Variable<String>(submissionJson.value);
    }
    if (evaluationJson.present) {
      map['evaluation_json'] = Variable<String>(evaluationJson.value);
    }
    if (overallBand.present) {
      map['overall_band'] = Variable<double>(overallBand.value);
    }
    if (errorCode.present) {
      map['error_code'] = Variable<String>(errorCode.value);
    }
    if (startedAtUtcMs.present) {
      map['started_at_utc_ms'] = Variable<int>(startedAtUtcMs.value);
    }
    if (completedAtUtcMs.present) {
      map['completed_at_utc_ms'] = Variable<int>(completedAtUtcMs.value);
    }
    if (durationSeconds.present) {
      map['duration_seconds'] = Variable<int>(durationSeconds.value);
    }
    if (usedStudyMode.present) {
      map['used_study_mode'] = Variable<bool>(usedStudyMode.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ExamAttemptsCompanion(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('attemptId: $attemptId, ')
          ..write('examId: $examId, ')
          ..write('packId: $packId, ')
          ..write('skill: $skill, ')
          ..write('status: $status, ')
          ..write('remoteJobId: $remoteJobId, ')
          ..write('submissionJson: $submissionJson, ')
          ..write('evaluationJson: $evaluationJson, ')
          ..write('overallBand: $overallBand, ')
          ..write('errorCode: $errorCode, ')
          ..write('startedAtUtcMs: $startedAtUtcMs, ')
          ..write('completedAtUtcMs: $completedAtUtcMs, ')
          ..write('durationSeconds: $durationSeconds, ')
          ..write('usedStudyMode: $usedStudyMode, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $AudioRecordingsTable extends AudioRecordings
    with TableInfo<$AudioRecordingsTable, AudioRecordingRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $AudioRecordingsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _recordingIdMeta = const VerificationMeta(
    'recordingId',
  );
  @override
  late final GeneratedColumn<String> recordingId = GeneratedColumn<String>(
    'recording_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _attemptIdMeta = const VerificationMeta(
    'attemptId',
  );
  @override
  late final GeneratedColumn<String> attemptId = GeneratedColumn<String>(
    'attempt_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES exam_attempts (attempt_id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _partIndexMeta = const VerificationMeta(
    'partIndex',
  );
  @override
  late final GeneratedColumn<int> partIndex = GeneratedColumn<int>(
    'part_index',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _localFilePathMeta = const VerificationMeta(
    'localFilePath',
  );
  @override
  late final GeneratedColumn<String> localFilePath = GeneratedColumn<String>(
    'local_file_path',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _durationMsMeta = const VerificationMeta(
    'durationMs',
  );
  @override
  late final GeneratedColumn<int> durationMs = GeneratedColumn<int>(
    'duration_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _remoteObjectKeyMeta = const VerificationMeta(
    'remoteObjectKey',
  );
  @override
  late final GeneratedColumn<String> remoteObjectKey = GeneratedColumn<String>(
    'remote_object_key',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    createdAt,
    updatedAt,
    recordingId,
    attemptId,
    partIndex,
    localFilePath,
    durationMs,
    remoteObjectKey,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'audio_recordings';
  @override
  VerificationContext validateIntegrity(
    Insertable<AudioRecordingRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('recording_id')) {
      context.handle(
        _recordingIdMeta,
        recordingId.isAcceptableOrUnknown(
          data['recording_id']!,
          _recordingIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_recordingIdMeta);
    }
    if (data.containsKey('attempt_id')) {
      context.handle(
        _attemptIdMeta,
        attemptId.isAcceptableOrUnknown(data['attempt_id']!, _attemptIdMeta),
      );
    } else if (isInserting) {
      context.missing(_attemptIdMeta);
    }
    if (data.containsKey('part_index')) {
      context.handle(
        _partIndexMeta,
        partIndex.isAcceptableOrUnknown(data['part_index']!, _partIndexMeta),
      );
    } else if (isInserting) {
      context.missing(_partIndexMeta);
    }
    if (data.containsKey('local_file_path')) {
      context.handle(
        _localFilePathMeta,
        localFilePath.isAcceptableOrUnknown(
          data['local_file_path']!,
          _localFilePathMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_localFilePathMeta);
    }
    if (data.containsKey('duration_ms')) {
      context.handle(
        _durationMsMeta,
        durationMs.isAcceptableOrUnknown(data['duration_ms']!, _durationMsMeta),
      );
    } else if (isInserting) {
      context.missing(_durationMsMeta);
    }
    if (data.containsKey('remote_object_key')) {
      context.handle(
        _remoteObjectKeyMeta,
        remoteObjectKey.isAcceptableOrUnknown(
          data['remote_object_key']!,
          _remoteObjectKeyMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {recordingId};
  @override
  AudioRecordingRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return AudioRecordingRow(
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      recordingId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}recording_id'],
      )!,
      attemptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}attempt_id'],
      )!,
      partIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}part_index'],
      )!,
      localFilePath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_file_path'],
      )!,
      durationMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}duration_ms'],
      )!,
      remoteObjectKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}remote_object_key'],
      ),
    );
  }

  @override
  $AudioRecordingsTable createAlias(String alias) {
    return $AudioRecordingsTable(attachedDatabase, alias);
  }
}

class AudioRecordingRow extends DataClass
    implements Insertable<AudioRecordingRow> {
  /// Record creation timestamp in UTC.
  final DateTime createdAt;

  /// Last local mutation timestamp in UTC.
  final DateTime updatedAt;

  /// Unique recording chunk identifier.
  final String recordingId;

  /// Parent attempt identifier.
  final String attemptId;

  /// IELTS Speaking part index (`1`, `2`, or `3`).
  final int partIndex;

  /// Local path inside app support audio directory.
  final String localFilePath;

  /// Audio length in milliseconds for duration guard checks.
  final int durationMs;

  /// Object key returned after presigned S3 upload completes.
  final String? remoteObjectKey;
  const AudioRecordingRow({
    required this.createdAt,
    required this.updatedAt,
    required this.recordingId,
    required this.attemptId,
    required this.partIndex,
    required this.localFilePath,
    required this.durationMs,
    this.remoteObjectKey,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['recording_id'] = Variable<String>(recordingId);
    map['attempt_id'] = Variable<String>(attemptId);
    map['part_index'] = Variable<int>(partIndex);
    map['local_file_path'] = Variable<String>(localFilePath);
    map['duration_ms'] = Variable<int>(durationMs);
    if (!nullToAbsent || remoteObjectKey != null) {
      map['remote_object_key'] = Variable<String>(remoteObjectKey);
    }
    return map;
  }

  AudioRecordingsCompanion toCompanion(bool nullToAbsent) {
    return AudioRecordingsCompanion(
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      recordingId: Value(recordingId),
      attemptId: Value(attemptId),
      partIndex: Value(partIndex),
      localFilePath: Value(localFilePath),
      durationMs: Value(durationMs),
      remoteObjectKey: remoteObjectKey == null && nullToAbsent
          ? const Value.absent()
          : Value(remoteObjectKey),
    );
  }

  factory AudioRecordingRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return AudioRecordingRow(
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      recordingId: serializer.fromJson<String>(json['recordingId']),
      attemptId: serializer.fromJson<String>(json['attemptId']),
      partIndex: serializer.fromJson<int>(json['partIndex']),
      localFilePath: serializer.fromJson<String>(json['localFilePath']),
      durationMs: serializer.fromJson<int>(json['durationMs']),
      remoteObjectKey: serializer.fromJson<String?>(json['remoteObjectKey']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'recordingId': serializer.toJson<String>(recordingId),
      'attemptId': serializer.toJson<String>(attemptId),
      'partIndex': serializer.toJson<int>(partIndex),
      'localFilePath': serializer.toJson<String>(localFilePath),
      'durationMs': serializer.toJson<int>(durationMs),
      'remoteObjectKey': serializer.toJson<String?>(remoteObjectKey),
    };
  }

  AudioRecordingRow copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    String? recordingId,
    String? attemptId,
    int? partIndex,
    String? localFilePath,
    int? durationMs,
    Value<String?> remoteObjectKey = const Value.absent(),
  }) => AudioRecordingRow(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    recordingId: recordingId ?? this.recordingId,
    attemptId: attemptId ?? this.attemptId,
    partIndex: partIndex ?? this.partIndex,
    localFilePath: localFilePath ?? this.localFilePath,
    durationMs: durationMs ?? this.durationMs,
    remoteObjectKey: remoteObjectKey.present
        ? remoteObjectKey.value
        : this.remoteObjectKey,
  );
  AudioRecordingRow copyWithCompanion(AudioRecordingsCompanion data) {
    return AudioRecordingRow(
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      recordingId: data.recordingId.present
          ? data.recordingId.value
          : this.recordingId,
      attemptId: data.attemptId.present ? data.attemptId.value : this.attemptId,
      partIndex: data.partIndex.present ? data.partIndex.value : this.partIndex,
      localFilePath: data.localFilePath.present
          ? data.localFilePath.value
          : this.localFilePath,
      durationMs: data.durationMs.present
          ? data.durationMs.value
          : this.durationMs,
      remoteObjectKey: data.remoteObjectKey.present
          ? data.remoteObjectKey.value
          : this.remoteObjectKey,
    );
  }

  @override
  String toString() {
    return (StringBuffer('AudioRecordingRow(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('recordingId: $recordingId, ')
          ..write('attemptId: $attemptId, ')
          ..write('partIndex: $partIndex, ')
          ..write('localFilePath: $localFilePath, ')
          ..write('durationMs: $durationMs, ')
          ..write('remoteObjectKey: $remoteObjectKey')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    createdAt,
    updatedAt,
    recordingId,
    attemptId,
    partIndex,
    localFilePath,
    durationMs,
    remoteObjectKey,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AudioRecordingRow &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.recordingId == this.recordingId &&
          other.attemptId == this.attemptId &&
          other.partIndex == this.partIndex &&
          other.localFilePath == this.localFilePath &&
          other.durationMs == this.durationMs &&
          other.remoteObjectKey == this.remoteObjectKey);
}

class AudioRecordingsCompanion extends UpdateCompanion<AudioRecordingRow> {
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<String> recordingId;
  final Value<String> attemptId;
  final Value<int> partIndex;
  final Value<String> localFilePath;
  final Value<int> durationMs;
  final Value<String?> remoteObjectKey;
  final Value<int> rowid;
  const AudioRecordingsCompanion({
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.recordingId = const Value.absent(),
    this.attemptId = const Value.absent(),
    this.partIndex = const Value.absent(),
    this.localFilePath = const Value.absent(),
    this.durationMs = const Value.absent(),
    this.remoteObjectKey = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  AudioRecordingsCompanion.insert({
    required DateTime createdAt,
    required DateTime updatedAt,
    required String recordingId,
    required String attemptId,
    required int partIndex,
    required String localFilePath,
    required int durationMs,
    this.remoteObjectKey = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : createdAt = Value(createdAt),
       updatedAt = Value(updatedAt),
       recordingId = Value(recordingId),
       attemptId = Value(attemptId),
       partIndex = Value(partIndex),
       localFilePath = Value(localFilePath),
       durationMs = Value(durationMs);
  static Insertable<AudioRecordingRow> custom({
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<String>? recordingId,
    Expression<String>? attemptId,
    Expression<int>? partIndex,
    Expression<String>? localFilePath,
    Expression<int>? durationMs,
    Expression<String>? remoteObjectKey,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (recordingId != null) 'recording_id': recordingId,
      if (attemptId != null) 'attempt_id': attemptId,
      if (partIndex != null) 'part_index': partIndex,
      if (localFilePath != null) 'local_file_path': localFilePath,
      if (durationMs != null) 'duration_ms': durationMs,
      if (remoteObjectKey != null) 'remote_object_key': remoteObjectKey,
      if (rowid != null) 'rowid': rowid,
    });
  }

  AudioRecordingsCompanion copyWith({
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<String>? recordingId,
    Value<String>? attemptId,
    Value<int>? partIndex,
    Value<String>? localFilePath,
    Value<int>? durationMs,
    Value<String?>? remoteObjectKey,
    Value<int>? rowid,
  }) {
    return AudioRecordingsCompanion(
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      recordingId: recordingId ?? this.recordingId,
      attemptId: attemptId ?? this.attemptId,
      partIndex: partIndex ?? this.partIndex,
      localFilePath: localFilePath ?? this.localFilePath,
      durationMs: durationMs ?? this.durationMs,
      remoteObjectKey: remoteObjectKey ?? this.remoteObjectKey,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (recordingId.present) {
      map['recording_id'] = Variable<String>(recordingId.value);
    }
    if (attemptId.present) {
      map['attempt_id'] = Variable<String>(attemptId.value);
    }
    if (partIndex.present) {
      map['part_index'] = Variable<int>(partIndex.value);
    }
    if (localFilePath.present) {
      map['local_file_path'] = Variable<String>(localFilePath.value);
    }
    if (durationMs.present) {
      map['duration_ms'] = Variable<int>(durationMs.value);
    }
    if (remoteObjectKey.present) {
      map['remote_object_key'] = Variable<String>(remoteObjectKey.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('AudioRecordingsCompanion(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('recordingId: $recordingId, ')
          ..write('attemptId: $attemptId, ')
          ..write('partIndex: $partIndex, ')
          ..write('localFilePath: $localFilePath, ')
          ..write('durationMs: $durationMs, ')
          ..write('remoteObjectKey: $remoteObjectKey, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $WritingDraftsTable extends WritingDrafts
    with TableInfo<$WritingDraftsTable, WritingDraftRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $WritingDraftsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _attemptIdMeta = const VerificationMeta(
    'attemptId',
  );
  @override
  late final GeneratedColumn<String> attemptId = GeneratedColumn<String>(
    'attempt_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES exam_attempts (attempt_id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _packIdMeta = const VerificationMeta('packId');
  @override
  late final GeneratedColumn<String> packId = GeneratedColumn<String>(
    'pack_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _taskTypeMeta = const VerificationMeta(
    'taskType',
  );
  @override
  late final GeneratedColumn<String> taskType = GeneratedColumn<String>(
    'task_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _draftTextMeta = const VerificationMeta(
    'draftText',
  );
  @override
  late final GeneratedColumn<String> draftText = GeneratedColumn<String>(
    'draft_text',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _wordCountMeta = const VerificationMeta(
    'wordCount',
  );
  @override
  late final GeneratedColumn<int> wordCount = GeneratedColumn<int>(
    'word_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _timerRemainingSecMeta = const VerificationMeta(
    'timerRemainingSec',
  );
  @override
  late final GeneratedColumn<int> timerRemainingSec = GeneratedColumn<int>(
    'timer_remaining_sec',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _updatedAtUtcMsMeta = const VerificationMeta(
    'updatedAtUtcMs',
  );
  @override
  late final GeneratedColumn<int> updatedAtUtcMs = GeneratedColumn<int>(
    'updated_at_utc_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    attemptId,
    packId,
    taskType,
    draftText,
    wordCount,
    timerRemainingSec,
    updatedAtUtcMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'writing_drafts';
  @override
  VerificationContext validateIntegrity(
    Insertable<WritingDraftRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('attempt_id')) {
      context.handle(
        _attemptIdMeta,
        attemptId.isAcceptableOrUnknown(data['attempt_id']!, _attemptIdMeta),
      );
    } else if (isInserting) {
      context.missing(_attemptIdMeta);
    }
    if (data.containsKey('pack_id')) {
      context.handle(
        _packIdMeta,
        packId.isAcceptableOrUnknown(data['pack_id']!, _packIdMeta),
      );
    } else if (isInserting) {
      context.missing(_packIdMeta);
    }
    if (data.containsKey('task_type')) {
      context.handle(
        _taskTypeMeta,
        taskType.isAcceptableOrUnknown(data['task_type']!, _taskTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_taskTypeMeta);
    }
    if (data.containsKey('draft_text')) {
      context.handle(
        _draftTextMeta,
        draftText.isAcceptableOrUnknown(data['draft_text']!, _draftTextMeta),
      );
    } else if (isInserting) {
      context.missing(_draftTextMeta);
    }
    if (data.containsKey('word_count')) {
      context.handle(
        _wordCountMeta,
        wordCount.isAcceptableOrUnknown(data['word_count']!, _wordCountMeta),
      );
    }
    if (data.containsKey('timer_remaining_sec')) {
      context.handle(
        _timerRemainingSecMeta,
        timerRemainingSec.isAcceptableOrUnknown(
          data['timer_remaining_sec']!,
          _timerRemainingSecMeta,
        ),
      );
    }
    if (data.containsKey('updated_at_utc_ms')) {
      context.handle(
        _updatedAtUtcMsMeta,
        updatedAtUtcMs.isAcceptableOrUnknown(
          data['updated_at_utc_ms']!,
          _updatedAtUtcMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_updatedAtUtcMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {attemptId};
  @override
  WritingDraftRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return WritingDraftRow(
      attemptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}attempt_id'],
      )!,
      packId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pack_id'],
      )!,
      taskType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}task_type'],
      )!,
      draftText: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}draft_text'],
      )!,
      wordCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}word_count'],
      )!,
      timerRemainingSec: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}timer_remaining_sec'],
      )!,
      updatedAtUtcMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}updated_at_utc_ms'],
      )!,
    );
  }

  @override
  $WritingDraftsTable createAlias(String alias) {
    return $WritingDraftsTable(attachedDatabase, alias);
  }

  @override
  bool get isStrict => true;
}

class WritingDraftRow extends DataClass implements Insertable<WritingDraftRow> {
  /// Attempt foreign key and primary key (1:1 with ExamAttempts).
  final String attemptId;

  /// Owning content pack identifier.
  final String packId;

  /// Task category (`task1Academic`, `task1General`, `task2Essay`).
  final String taskType;

  /// In-progress raw essay draft text.
  final String draftText;

  /// Calculated word count.
  final int wordCount;

  /// Remaining exam timer seconds when draft was saved.
  final int timerRemainingSec;

  /// UTC millisecond timestamp when last updated.
  final int updatedAtUtcMs;
  const WritingDraftRow({
    required this.attemptId,
    required this.packId,
    required this.taskType,
    required this.draftText,
    required this.wordCount,
    required this.timerRemainingSec,
    required this.updatedAtUtcMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['attempt_id'] = Variable<String>(attemptId);
    map['pack_id'] = Variable<String>(packId);
    map['task_type'] = Variable<String>(taskType);
    map['draft_text'] = Variable<String>(draftText);
    map['word_count'] = Variable<int>(wordCount);
    map['timer_remaining_sec'] = Variable<int>(timerRemainingSec);
    map['updated_at_utc_ms'] = Variable<int>(updatedAtUtcMs);
    return map;
  }

  WritingDraftsCompanion toCompanion(bool nullToAbsent) {
    return WritingDraftsCompanion(
      attemptId: Value(attemptId),
      packId: Value(packId),
      taskType: Value(taskType),
      draftText: Value(draftText),
      wordCount: Value(wordCount),
      timerRemainingSec: Value(timerRemainingSec),
      updatedAtUtcMs: Value(updatedAtUtcMs),
    );
  }

  factory WritingDraftRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return WritingDraftRow(
      attemptId: serializer.fromJson<String>(json['attemptId']),
      packId: serializer.fromJson<String>(json['packId']),
      taskType: serializer.fromJson<String>(json['taskType']),
      draftText: serializer.fromJson<String>(json['draftText']),
      wordCount: serializer.fromJson<int>(json['wordCount']),
      timerRemainingSec: serializer.fromJson<int>(json['timerRemainingSec']),
      updatedAtUtcMs: serializer.fromJson<int>(json['updatedAtUtcMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'attemptId': serializer.toJson<String>(attemptId),
      'packId': serializer.toJson<String>(packId),
      'taskType': serializer.toJson<String>(taskType),
      'draftText': serializer.toJson<String>(draftText),
      'wordCount': serializer.toJson<int>(wordCount),
      'timerRemainingSec': serializer.toJson<int>(timerRemainingSec),
      'updatedAtUtcMs': serializer.toJson<int>(updatedAtUtcMs),
    };
  }

  WritingDraftRow copyWith({
    String? attemptId,
    String? packId,
    String? taskType,
    String? draftText,
    int? wordCount,
    int? timerRemainingSec,
    int? updatedAtUtcMs,
  }) => WritingDraftRow(
    attemptId: attemptId ?? this.attemptId,
    packId: packId ?? this.packId,
    taskType: taskType ?? this.taskType,
    draftText: draftText ?? this.draftText,
    wordCount: wordCount ?? this.wordCount,
    timerRemainingSec: timerRemainingSec ?? this.timerRemainingSec,
    updatedAtUtcMs: updatedAtUtcMs ?? this.updatedAtUtcMs,
  );
  WritingDraftRow copyWithCompanion(WritingDraftsCompanion data) {
    return WritingDraftRow(
      attemptId: data.attemptId.present ? data.attemptId.value : this.attemptId,
      packId: data.packId.present ? data.packId.value : this.packId,
      taskType: data.taskType.present ? data.taskType.value : this.taskType,
      draftText: data.draftText.present ? data.draftText.value : this.draftText,
      wordCount: data.wordCount.present ? data.wordCount.value : this.wordCount,
      timerRemainingSec: data.timerRemainingSec.present
          ? data.timerRemainingSec.value
          : this.timerRemainingSec,
      updatedAtUtcMs: data.updatedAtUtcMs.present
          ? data.updatedAtUtcMs.value
          : this.updatedAtUtcMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('WritingDraftRow(')
          ..write('attemptId: $attemptId, ')
          ..write('packId: $packId, ')
          ..write('taskType: $taskType, ')
          ..write('draftText: $draftText, ')
          ..write('wordCount: $wordCount, ')
          ..write('timerRemainingSec: $timerRemainingSec, ')
          ..write('updatedAtUtcMs: $updatedAtUtcMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    attemptId,
    packId,
    taskType,
    draftText,
    wordCount,
    timerRemainingSec,
    updatedAtUtcMs,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is WritingDraftRow &&
          other.attemptId == this.attemptId &&
          other.packId == this.packId &&
          other.taskType == this.taskType &&
          other.draftText == this.draftText &&
          other.wordCount == this.wordCount &&
          other.timerRemainingSec == this.timerRemainingSec &&
          other.updatedAtUtcMs == this.updatedAtUtcMs);
}

class WritingDraftsCompanion extends UpdateCompanion<WritingDraftRow> {
  final Value<String> attemptId;
  final Value<String> packId;
  final Value<String> taskType;
  final Value<String> draftText;
  final Value<int> wordCount;
  final Value<int> timerRemainingSec;
  final Value<int> updatedAtUtcMs;
  final Value<int> rowid;
  const WritingDraftsCompanion({
    this.attemptId = const Value.absent(),
    this.packId = const Value.absent(),
    this.taskType = const Value.absent(),
    this.draftText = const Value.absent(),
    this.wordCount = const Value.absent(),
    this.timerRemainingSec = const Value.absent(),
    this.updatedAtUtcMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  WritingDraftsCompanion.insert({
    required String attemptId,
    required String packId,
    required String taskType,
    required String draftText,
    this.wordCount = const Value.absent(),
    this.timerRemainingSec = const Value.absent(),
    required int updatedAtUtcMs,
    this.rowid = const Value.absent(),
  }) : attemptId = Value(attemptId),
       packId = Value(packId),
       taskType = Value(taskType),
       draftText = Value(draftText),
       updatedAtUtcMs = Value(updatedAtUtcMs);
  static Insertable<WritingDraftRow> custom({
    Expression<String>? attemptId,
    Expression<String>? packId,
    Expression<String>? taskType,
    Expression<String>? draftText,
    Expression<int>? wordCount,
    Expression<int>? timerRemainingSec,
    Expression<int>? updatedAtUtcMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (attemptId != null) 'attempt_id': attemptId,
      if (packId != null) 'pack_id': packId,
      if (taskType != null) 'task_type': taskType,
      if (draftText != null) 'draft_text': draftText,
      if (wordCount != null) 'word_count': wordCount,
      if (timerRemainingSec != null) 'timer_remaining_sec': timerRemainingSec,
      if (updatedAtUtcMs != null) 'updated_at_utc_ms': updatedAtUtcMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  WritingDraftsCompanion copyWith({
    Value<String>? attemptId,
    Value<String>? packId,
    Value<String>? taskType,
    Value<String>? draftText,
    Value<int>? wordCount,
    Value<int>? timerRemainingSec,
    Value<int>? updatedAtUtcMs,
    Value<int>? rowid,
  }) {
    return WritingDraftsCompanion(
      attemptId: attemptId ?? this.attemptId,
      packId: packId ?? this.packId,
      taskType: taskType ?? this.taskType,
      draftText: draftText ?? this.draftText,
      wordCount: wordCount ?? this.wordCount,
      timerRemainingSec: timerRemainingSec ?? this.timerRemainingSec,
      updatedAtUtcMs: updatedAtUtcMs ?? this.updatedAtUtcMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (attemptId.present) {
      map['attempt_id'] = Variable<String>(attemptId.value);
    }
    if (packId.present) {
      map['pack_id'] = Variable<String>(packId.value);
    }
    if (taskType.present) {
      map['task_type'] = Variable<String>(taskType.value);
    }
    if (draftText.present) {
      map['draft_text'] = Variable<String>(draftText.value);
    }
    if (wordCount.present) {
      map['word_count'] = Variable<int>(wordCount.value);
    }
    if (timerRemainingSec.present) {
      map['timer_remaining_sec'] = Variable<int>(timerRemainingSec.value);
    }
    if (updatedAtUtcMs.present) {
      map['updated_at_utc_ms'] = Variable<int>(updatedAtUtcMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('WritingDraftsCompanion(')
          ..write('attemptId: $attemptId, ')
          ..write('packId: $packId, ')
          ..write('taskType: $taskType, ')
          ..write('draftText: $draftText, ')
          ..write('wordCount: $wordCount, ')
          ..write('timerRemainingSec: $timerRemainingSec, ')
          ..write('updatedAtUtcMs: $updatedAtUtcMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ReadingAnnotationsTable extends ReadingAnnotations
    with TableInfo<$ReadingAnnotationsTable, ReadingAnnotationRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ReadingAnnotationsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _annotationIdMeta = const VerificationMeta(
    'annotationId',
  );
  @override
  late final GeneratedColumn<String> annotationId = GeneratedColumn<String>(
    'annotation_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _packIdMeta = const VerificationMeta('packId');
  @override
  late final GeneratedColumn<String> packId = GeneratedColumn<String>(
    'pack_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _passageIndexMeta = const VerificationMeta(
    'passageIndex',
  );
  @override
  late final GeneratedColumn<int> passageIndex = GeneratedColumn<int>(
    'passage_index',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _startOffsetMeta = const VerificationMeta(
    'startOffset',
  );
  @override
  late final GeneratedColumn<int> startOffset = GeneratedColumn<int>(
    'start_offset',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _endOffsetMeta = const VerificationMeta(
    'endOffset',
  );
  @override
  late final GeneratedColumn<int> endOffset = GeneratedColumn<int>(
    'end_offset',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _colorCodeMeta = const VerificationMeta(
    'colorCode',
  );
  @override
  late final GeneratedColumn<String> colorCode = GeneratedColumn<String>(
    'color_code',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('yellow'),
  );
  static const VerificationMeta _noteTextMeta = const VerificationMeta(
    'noteText',
  );
  @override
  late final GeneratedColumn<String> noteText = GeneratedColumn<String>(
    'note_text',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _isDeletedMeta = const VerificationMeta(
    'isDeleted',
  );
  @override
  late final GeneratedColumn<bool> isDeleted = GeneratedColumn<bool>(
    'is_deleted',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("is_deleted" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [
    createdAt,
    updatedAt,
    annotationId,
    packId,
    passageIndex,
    startOffset,
    endOffset,
    colorCode,
    noteText,
    isDeleted,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'reading_annotations';
  @override
  VerificationContext validateIntegrity(
    Insertable<ReadingAnnotationRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('annotation_id')) {
      context.handle(
        _annotationIdMeta,
        annotationId.isAcceptableOrUnknown(
          data['annotation_id']!,
          _annotationIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_annotationIdMeta);
    }
    if (data.containsKey('pack_id')) {
      context.handle(
        _packIdMeta,
        packId.isAcceptableOrUnknown(data['pack_id']!, _packIdMeta),
      );
    } else if (isInserting) {
      context.missing(_packIdMeta);
    }
    if (data.containsKey('passage_index')) {
      context.handle(
        _passageIndexMeta,
        passageIndex.isAcceptableOrUnknown(
          data['passage_index']!,
          _passageIndexMeta,
        ),
      );
    }
    if (data.containsKey('start_offset')) {
      context.handle(
        _startOffsetMeta,
        startOffset.isAcceptableOrUnknown(
          data['start_offset']!,
          _startOffsetMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_startOffsetMeta);
    }
    if (data.containsKey('end_offset')) {
      context.handle(
        _endOffsetMeta,
        endOffset.isAcceptableOrUnknown(data['end_offset']!, _endOffsetMeta),
      );
    } else if (isInserting) {
      context.missing(_endOffsetMeta);
    }
    if (data.containsKey('color_code')) {
      context.handle(
        _colorCodeMeta,
        colorCode.isAcceptableOrUnknown(data['color_code']!, _colorCodeMeta),
      );
    }
    if (data.containsKey('note_text')) {
      context.handle(
        _noteTextMeta,
        noteText.isAcceptableOrUnknown(data['note_text']!, _noteTextMeta),
      );
    }
    if (data.containsKey('is_deleted')) {
      context.handle(
        _isDeletedMeta,
        isDeleted.isAcceptableOrUnknown(data['is_deleted']!, _isDeletedMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {annotationId};
  @override
  ReadingAnnotationRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ReadingAnnotationRow(
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      annotationId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}annotation_id'],
      )!,
      packId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}pack_id'],
      )!,
      passageIndex: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}passage_index'],
      )!,
      startOffset: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}start_offset'],
      )!,
      endOffset: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}end_offset'],
      )!,
      colorCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}color_code'],
      )!,
      noteText: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}note_text'],
      ),
      isDeleted: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}is_deleted'],
      )!,
    );
  }

  @override
  $ReadingAnnotationsTable createAlias(String alias) {
    return $ReadingAnnotationsTable(attachedDatabase, alias);
  }

  @override
  bool get isStrict => true;
}

class ReadingAnnotationRow extends DataClass
    implements Insertable<ReadingAnnotationRow> {
  /// Record creation timestamp in UTC.
  final DateTime createdAt;

  /// Last local mutation timestamp in UTC.
  final DateTime updatedAt;

  /// Unique annotation identifier.
  final String annotationId;

  /// Owning reading pack identifier.
  final String packId;

  /// Passage index within pack (0, 1, or 2).
  final int passageIndex;

  /// Start UTF-16 character offset in passage text.
  final int startOffset;

  /// End UTF-16 character offset in passage text.
  final int endOffset;

  /// Highlight color category ('yellow', 'green', 'pink').
  final String colorCode;

  /// Optional attached student marginal note text.
  final String? noteText;

  /// Soft-deletion flag.
  final bool isDeleted;
  const ReadingAnnotationRow({
    required this.createdAt,
    required this.updatedAt,
    required this.annotationId,
    required this.packId,
    required this.passageIndex,
    required this.startOffset,
    required this.endOffset,
    required this.colorCode,
    this.noteText,
    required this.isDeleted,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['annotation_id'] = Variable<String>(annotationId);
    map['pack_id'] = Variable<String>(packId);
    map['passage_index'] = Variable<int>(passageIndex);
    map['start_offset'] = Variable<int>(startOffset);
    map['end_offset'] = Variable<int>(endOffset);
    map['color_code'] = Variable<String>(colorCode);
    if (!nullToAbsent || noteText != null) {
      map['note_text'] = Variable<String>(noteText);
    }
    map['is_deleted'] = Variable<bool>(isDeleted);
    return map;
  }

  ReadingAnnotationsCompanion toCompanion(bool nullToAbsent) {
    return ReadingAnnotationsCompanion(
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      annotationId: Value(annotationId),
      packId: Value(packId),
      passageIndex: Value(passageIndex),
      startOffset: Value(startOffset),
      endOffset: Value(endOffset),
      colorCode: Value(colorCode),
      noteText: noteText == null && nullToAbsent
          ? const Value.absent()
          : Value(noteText),
      isDeleted: Value(isDeleted),
    );
  }

  factory ReadingAnnotationRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ReadingAnnotationRow(
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      annotationId: serializer.fromJson<String>(json['annotationId']),
      packId: serializer.fromJson<String>(json['packId']),
      passageIndex: serializer.fromJson<int>(json['passageIndex']),
      startOffset: serializer.fromJson<int>(json['startOffset']),
      endOffset: serializer.fromJson<int>(json['endOffset']),
      colorCode: serializer.fromJson<String>(json['colorCode']),
      noteText: serializer.fromJson<String?>(json['noteText']),
      isDeleted: serializer.fromJson<bool>(json['isDeleted']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'annotationId': serializer.toJson<String>(annotationId),
      'packId': serializer.toJson<String>(packId),
      'passageIndex': serializer.toJson<int>(passageIndex),
      'startOffset': serializer.toJson<int>(startOffset),
      'endOffset': serializer.toJson<int>(endOffset),
      'colorCode': serializer.toJson<String>(colorCode),
      'noteText': serializer.toJson<String?>(noteText),
      'isDeleted': serializer.toJson<bool>(isDeleted),
    };
  }

  ReadingAnnotationRow copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    String? annotationId,
    String? packId,
    int? passageIndex,
    int? startOffset,
    int? endOffset,
    String? colorCode,
    Value<String?> noteText = const Value.absent(),
    bool? isDeleted,
  }) => ReadingAnnotationRow(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    annotationId: annotationId ?? this.annotationId,
    packId: packId ?? this.packId,
    passageIndex: passageIndex ?? this.passageIndex,
    startOffset: startOffset ?? this.startOffset,
    endOffset: endOffset ?? this.endOffset,
    colorCode: colorCode ?? this.colorCode,
    noteText: noteText.present ? noteText.value : this.noteText,
    isDeleted: isDeleted ?? this.isDeleted,
  );
  ReadingAnnotationRow copyWithCompanion(ReadingAnnotationsCompanion data) {
    return ReadingAnnotationRow(
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      annotationId: data.annotationId.present
          ? data.annotationId.value
          : this.annotationId,
      packId: data.packId.present ? data.packId.value : this.packId,
      passageIndex: data.passageIndex.present
          ? data.passageIndex.value
          : this.passageIndex,
      startOffset: data.startOffset.present
          ? data.startOffset.value
          : this.startOffset,
      endOffset: data.endOffset.present ? data.endOffset.value : this.endOffset,
      colorCode: data.colorCode.present ? data.colorCode.value : this.colorCode,
      noteText: data.noteText.present ? data.noteText.value : this.noteText,
      isDeleted: data.isDeleted.present ? data.isDeleted.value : this.isDeleted,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ReadingAnnotationRow(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('annotationId: $annotationId, ')
          ..write('packId: $packId, ')
          ..write('passageIndex: $passageIndex, ')
          ..write('startOffset: $startOffset, ')
          ..write('endOffset: $endOffset, ')
          ..write('colorCode: $colorCode, ')
          ..write('noteText: $noteText, ')
          ..write('isDeleted: $isDeleted')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    createdAt,
    updatedAt,
    annotationId,
    packId,
    passageIndex,
    startOffset,
    endOffset,
    colorCode,
    noteText,
    isDeleted,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ReadingAnnotationRow &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.annotationId == this.annotationId &&
          other.packId == this.packId &&
          other.passageIndex == this.passageIndex &&
          other.startOffset == this.startOffset &&
          other.endOffset == this.endOffset &&
          other.colorCode == this.colorCode &&
          other.noteText == this.noteText &&
          other.isDeleted == this.isDeleted);
}

class ReadingAnnotationsCompanion
    extends UpdateCompanion<ReadingAnnotationRow> {
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<String> annotationId;
  final Value<String> packId;
  final Value<int> passageIndex;
  final Value<int> startOffset;
  final Value<int> endOffset;
  final Value<String> colorCode;
  final Value<String?> noteText;
  final Value<bool> isDeleted;
  final Value<int> rowid;
  const ReadingAnnotationsCompanion({
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.annotationId = const Value.absent(),
    this.packId = const Value.absent(),
    this.passageIndex = const Value.absent(),
    this.startOffset = const Value.absent(),
    this.endOffset = const Value.absent(),
    this.colorCode = const Value.absent(),
    this.noteText = const Value.absent(),
    this.isDeleted = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ReadingAnnotationsCompanion.insert({
    required DateTime createdAt,
    required DateTime updatedAt,
    required String annotationId,
    required String packId,
    this.passageIndex = const Value.absent(),
    required int startOffset,
    required int endOffset,
    this.colorCode = const Value.absent(),
    this.noteText = const Value.absent(),
    this.isDeleted = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : createdAt = Value(createdAt),
       updatedAt = Value(updatedAt),
       annotationId = Value(annotationId),
       packId = Value(packId),
       startOffset = Value(startOffset),
       endOffset = Value(endOffset);
  static Insertable<ReadingAnnotationRow> custom({
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<String>? annotationId,
    Expression<String>? packId,
    Expression<int>? passageIndex,
    Expression<int>? startOffset,
    Expression<int>? endOffset,
    Expression<String>? colorCode,
    Expression<String>? noteText,
    Expression<bool>? isDeleted,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (annotationId != null) 'annotation_id': annotationId,
      if (packId != null) 'pack_id': packId,
      if (passageIndex != null) 'passage_index': passageIndex,
      if (startOffset != null) 'start_offset': startOffset,
      if (endOffset != null) 'end_offset': endOffset,
      if (colorCode != null) 'color_code': colorCode,
      if (noteText != null) 'note_text': noteText,
      if (isDeleted != null) 'is_deleted': isDeleted,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ReadingAnnotationsCompanion copyWith({
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<String>? annotationId,
    Value<String>? packId,
    Value<int>? passageIndex,
    Value<int>? startOffset,
    Value<int>? endOffset,
    Value<String>? colorCode,
    Value<String?>? noteText,
    Value<bool>? isDeleted,
    Value<int>? rowid,
  }) {
    return ReadingAnnotationsCompanion(
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      annotationId: annotationId ?? this.annotationId,
      packId: packId ?? this.packId,
      passageIndex: passageIndex ?? this.passageIndex,
      startOffset: startOffset ?? this.startOffset,
      endOffset: endOffset ?? this.endOffset,
      colorCode: colorCode ?? this.colorCode,
      noteText: noteText ?? this.noteText,
      isDeleted: isDeleted ?? this.isDeleted,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (annotationId.present) {
      map['annotation_id'] = Variable<String>(annotationId.value);
    }
    if (packId.present) {
      map['pack_id'] = Variable<String>(packId.value);
    }
    if (passageIndex.present) {
      map['passage_index'] = Variable<int>(passageIndex.value);
    }
    if (startOffset.present) {
      map['start_offset'] = Variable<int>(startOffset.value);
    }
    if (endOffset.present) {
      map['end_offset'] = Variable<int>(endOffset.value);
    }
    if (colorCode.present) {
      map['color_code'] = Variable<String>(colorCode.value);
    }
    if (noteText.present) {
      map['note_text'] = Variable<String>(noteText.value);
    }
    if (isDeleted.present) {
      map['is_deleted'] = Variable<bool>(isDeleted.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ReadingAnnotationsCompanion(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('annotationId: $annotationId, ')
          ..write('packId: $packId, ')
          ..write('passageIndex: $passageIndex, ')
          ..write('startOffset: $startOffset, ')
          ..write('endOffset: $endOffset, ')
          ..write('colorCode: $colorCode, ')
          ..write('noteText: $noteText, ')
          ..write('isDeleted: $isDeleted, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $VocabCardsTable extends VocabCards
    with TableInfo<$VocabCardsTable, VocabCardRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $VocabCardsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cardIdMeta = const VerificationMeta('cardId');
  @override
  late final GeneratedColumn<String> cardId = GeneratedColumn<String>(
    'card_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _headwordMeta = const VerificationMeta(
    'headword',
  );
  @override
  late final GeneratedColumn<String> headword = GeneratedColumn<String>(
    'headword',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _ipaMeta = const VerificationMeta('ipa');
  @override
  late final GeneratedColumn<String> ipa = GeneratedColumn<String>(
    'ipa',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _definitionMeta = const VerificationMeta(
    'definition',
  );
  @override
  late final GeneratedColumn<String> definition = GeneratedColumn<String>(
    'definition',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _topicTagMeta = const VerificationMeta(
    'topicTag',
  );
  @override
  late final GeneratedColumn<String> topicTag = GeneratedColumn<String>(
    'topic_tag',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _repetitionsMeta = const VerificationMeta(
    'repetitions',
  );
  @override
  late final GeneratedColumn<int> repetitions = GeneratedColumn<int>(
    'repetitions',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _intervalDaysMeta = const VerificationMeta(
    'intervalDays',
  );
  @override
  late final GeneratedColumn<int> intervalDays = GeneratedColumn<int>(
    'interval_days',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _easeFactorMeta = const VerificationMeta(
    'easeFactor',
  );
  @override
  late final GeneratedColumn<double> easeFactor = GeneratedColumn<double>(
    'ease_factor',
    aliasedName,
    false,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
    defaultValue: const Constant(2.5),
  );
  static const VerificationMeta _easeFactorMilliMeta = const VerificationMeta(
    'easeFactorMilli',
  );
  @override
  late final GeneratedColumn<int> easeFactorMilli = GeneratedColumn<int>(
    'ease_factor_milli',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(2500),
  );
  static const VerificationMeta _dueDayMeta = const VerificationMeta('dueDay');
  @override
  late final GeneratedColumn<int> dueDay = GeneratedColumn<int>(
    'due_day',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dueDaySerialMeta = const VerificationMeta(
    'dueDaySerial',
  );
  @override
  late final GeneratedColumn<int> dueDaySerial = GeneratedColumn<int>(
    'due_day_serial',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _contextSentenceMeta = const VerificationMeta(
    'contextSentence',
  );
  @override
  late final GeneratedColumn<String> contextSentence = GeneratedColumn<String>(
    'context_sentence',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _paraphraseHintsJsonMeta =
      const VerificationMeta('paraphraseHintsJson');
  @override
  late final GeneratedColumn<String> paraphraseHintsJson =
      GeneratedColumn<String>(
        'paraphrase_hints_json',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _usageNoteMeta = const VerificationMeta(
    'usageNote',
  );
  @override
  late final GeneratedColumn<String> usageNote = GeneratedColumn<String>(
    'usage_note',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sourceSkillMeta = const VerificationMeta(
    'sourceSkill',
  );
  @override
  late final GeneratedColumn<String> sourceSkill = GeneratedColumn<String>(
    'source_skill',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sourceAttemptIdMeta = const VerificationMeta(
    'sourceAttemptId',
  );
  @override
  late final GeneratedColumn<String> sourceAttemptId = GeneratedColumn<String>(
    'source_attempt_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sourceRefLabelMeta = const VerificationMeta(
    'sourceRefLabel',
  );
  @override
  late final GeneratedColumn<String> sourceRefLabel = GeneratedColumn<String>(
    'source_ref_label',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    createdAt,
    updatedAt,
    cardId,
    headword,
    ipa,
    definition,
    topicTag,
    repetitions,
    intervalDays,
    easeFactor,
    easeFactorMilli,
    dueDay,
    dueDaySerial,
    contextSentence,
    paraphraseHintsJson,
    usageNote,
    sourceSkill,
    sourceAttemptId,
    sourceRefLabel,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'vocab_cards';
  @override
  VerificationContext validateIntegrity(
    Insertable<VocabCardRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('card_id')) {
      context.handle(
        _cardIdMeta,
        cardId.isAcceptableOrUnknown(data['card_id']!, _cardIdMeta),
      );
    } else if (isInserting) {
      context.missing(_cardIdMeta);
    }
    if (data.containsKey('headword')) {
      context.handle(
        _headwordMeta,
        headword.isAcceptableOrUnknown(data['headword']!, _headwordMeta),
      );
    } else if (isInserting) {
      context.missing(_headwordMeta);
    }
    if (data.containsKey('ipa')) {
      context.handle(
        _ipaMeta,
        ipa.isAcceptableOrUnknown(data['ipa']!, _ipaMeta),
      );
    }
    if (data.containsKey('definition')) {
      context.handle(
        _definitionMeta,
        definition.isAcceptableOrUnknown(data['definition']!, _definitionMeta),
      );
    } else if (isInserting) {
      context.missing(_definitionMeta);
    }
    if (data.containsKey('topic_tag')) {
      context.handle(
        _topicTagMeta,
        topicTag.isAcceptableOrUnknown(data['topic_tag']!, _topicTagMeta),
      );
    } else if (isInserting) {
      context.missing(_topicTagMeta);
    }
    if (data.containsKey('repetitions')) {
      context.handle(
        _repetitionsMeta,
        repetitions.isAcceptableOrUnknown(
          data['repetitions']!,
          _repetitionsMeta,
        ),
      );
    }
    if (data.containsKey('interval_days')) {
      context.handle(
        _intervalDaysMeta,
        intervalDays.isAcceptableOrUnknown(
          data['interval_days']!,
          _intervalDaysMeta,
        ),
      );
    }
    if (data.containsKey('ease_factor')) {
      context.handle(
        _easeFactorMeta,
        easeFactor.isAcceptableOrUnknown(data['ease_factor']!, _easeFactorMeta),
      );
    }
    if (data.containsKey('ease_factor_milli')) {
      context.handle(
        _easeFactorMilliMeta,
        easeFactorMilli.isAcceptableOrUnknown(
          data['ease_factor_milli']!,
          _easeFactorMilliMeta,
        ),
      );
    }
    if (data.containsKey('due_day')) {
      context.handle(
        _dueDayMeta,
        dueDay.isAcceptableOrUnknown(data['due_day']!, _dueDayMeta),
      );
    } else if (isInserting) {
      context.missing(_dueDayMeta);
    }
    if (data.containsKey('due_day_serial')) {
      context.handle(
        _dueDaySerialMeta,
        dueDaySerial.isAcceptableOrUnknown(
          data['due_day_serial']!,
          _dueDaySerialMeta,
        ),
      );
    }
    if (data.containsKey('context_sentence')) {
      context.handle(
        _contextSentenceMeta,
        contextSentence.isAcceptableOrUnknown(
          data['context_sentence']!,
          _contextSentenceMeta,
        ),
      );
    }
    if (data.containsKey('paraphrase_hints_json')) {
      context.handle(
        _paraphraseHintsJsonMeta,
        paraphraseHintsJson.isAcceptableOrUnknown(
          data['paraphrase_hints_json']!,
          _paraphraseHintsJsonMeta,
        ),
      );
    }
    if (data.containsKey('usage_note')) {
      context.handle(
        _usageNoteMeta,
        usageNote.isAcceptableOrUnknown(data['usage_note']!, _usageNoteMeta),
      );
    }
    if (data.containsKey('source_skill')) {
      context.handle(
        _sourceSkillMeta,
        sourceSkill.isAcceptableOrUnknown(
          data['source_skill']!,
          _sourceSkillMeta,
        ),
      );
    }
    if (data.containsKey('source_attempt_id')) {
      context.handle(
        _sourceAttemptIdMeta,
        sourceAttemptId.isAcceptableOrUnknown(
          data['source_attempt_id']!,
          _sourceAttemptIdMeta,
        ),
      );
    }
    if (data.containsKey('source_ref_label')) {
      context.handle(
        _sourceRefLabelMeta,
        sourceRefLabel.isAcceptableOrUnknown(
          data['source_ref_label']!,
          _sourceRefLabelMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {cardId};
  @override
  VocabCardRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return VocabCardRow(
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      cardId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}card_id'],
      )!,
      headword: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}headword'],
      )!,
      ipa: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}ipa'],
      ),
      definition: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}definition'],
      )!,
      topicTag: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}topic_tag'],
      )!,
      repetitions: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}repetitions'],
      )!,
      intervalDays: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}interval_days'],
      )!,
      easeFactor: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}ease_factor'],
      )!,
      easeFactorMilli: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}ease_factor_milli'],
      )!,
      dueDay: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}due_day'],
      )!,
      dueDaySerial: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}due_day_serial'],
      )!,
      contextSentence: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}context_sentence'],
      ),
      paraphraseHintsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}paraphrase_hints_json'],
      ),
      usageNote: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}usage_note'],
      ),
      sourceSkill: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source_skill'],
      ),
      sourceAttemptId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source_attempt_id'],
      ),
      sourceRefLabel: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source_ref_label'],
      ),
    );
  }

  @override
  $VocabCardsTable createAlias(String alias) {
    return $VocabCardsTable(attachedDatabase, alias);
  }
}

class VocabCardRow extends DataClass implements Insertable<VocabCardRow> {
  /// Record creation timestamp in UTC.
  final DateTime createdAt;

  /// Last local mutation timestamp in UTC.
  final DateTime updatedAt;

  /// Unique lexical card identifier.
  final String cardId;

  /// Target headword or collocation.
  final String headword;

  /// IPA pronunciation string when available.
  final String? ipa;

  /// Learner definition and band-8 context example.
  final String definition;

  /// Topic tag (`environment`, `technology`, `education`, etc.).
  final String topicTag;

  /// SM-2 consecutive repetition streak.
  final int repetitions;

  /// Scheduled review interval in days.
  final int intervalDays;

  /// Legacy ease multiplier (float).
  final double easeFactor;

  /// Integer ease factor in thousandths (floor 1300, default 2500) per ADR-006 / ADR-013.
  final int easeFactorMilli;

  /// Integer UTC serial day when the card next becomes due.
  final int dueDay;

  /// Alias for integer UTC serial day due date.
  final int dueDaySerial;

  /// Example context sentence illustrating band 8+ usage.
  final String? contextSentence;

  /// JSON list of academic paraphrase hints.
  final String? paraphraseHintsJson;

  /// Register / collocation usage guidance.
  final String? usageNote;

  /// Source skill where mistake was captured (`writing`, `speaking`, `reading`).
  final String? sourceSkill;

  /// Attempt ID from which this card was captured.
  final String? sourceAttemptId;

  /// Reference label (e.g. "Task 2 Essay", "Part 2 Cue Card").
  final String? sourceRefLabel;
  const VocabCardRow({
    required this.createdAt,
    required this.updatedAt,
    required this.cardId,
    required this.headword,
    this.ipa,
    required this.definition,
    required this.topicTag,
    required this.repetitions,
    required this.intervalDays,
    required this.easeFactor,
    required this.easeFactorMilli,
    required this.dueDay,
    required this.dueDaySerial,
    this.contextSentence,
    this.paraphraseHintsJson,
    this.usageNote,
    this.sourceSkill,
    this.sourceAttemptId,
    this.sourceRefLabel,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['card_id'] = Variable<String>(cardId);
    map['headword'] = Variable<String>(headword);
    if (!nullToAbsent || ipa != null) {
      map['ipa'] = Variable<String>(ipa);
    }
    map['definition'] = Variable<String>(definition);
    map['topic_tag'] = Variable<String>(topicTag);
    map['repetitions'] = Variable<int>(repetitions);
    map['interval_days'] = Variable<int>(intervalDays);
    map['ease_factor'] = Variable<double>(easeFactor);
    map['ease_factor_milli'] = Variable<int>(easeFactorMilli);
    map['due_day'] = Variable<int>(dueDay);
    map['due_day_serial'] = Variable<int>(dueDaySerial);
    if (!nullToAbsent || contextSentence != null) {
      map['context_sentence'] = Variable<String>(contextSentence);
    }
    if (!nullToAbsent || paraphraseHintsJson != null) {
      map['paraphrase_hints_json'] = Variable<String>(paraphraseHintsJson);
    }
    if (!nullToAbsent || usageNote != null) {
      map['usage_note'] = Variable<String>(usageNote);
    }
    if (!nullToAbsent || sourceSkill != null) {
      map['source_skill'] = Variable<String>(sourceSkill);
    }
    if (!nullToAbsent || sourceAttemptId != null) {
      map['source_attempt_id'] = Variable<String>(sourceAttemptId);
    }
    if (!nullToAbsent || sourceRefLabel != null) {
      map['source_ref_label'] = Variable<String>(sourceRefLabel);
    }
    return map;
  }

  VocabCardsCompanion toCompanion(bool nullToAbsent) {
    return VocabCardsCompanion(
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      cardId: Value(cardId),
      headword: Value(headword),
      ipa: ipa == null && nullToAbsent ? const Value.absent() : Value(ipa),
      definition: Value(definition),
      topicTag: Value(topicTag),
      repetitions: Value(repetitions),
      intervalDays: Value(intervalDays),
      easeFactor: Value(easeFactor),
      easeFactorMilli: Value(easeFactorMilli),
      dueDay: Value(dueDay),
      dueDaySerial: Value(dueDaySerial),
      contextSentence: contextSentence == null && nullToAbsent
          ? const Value.absent()
          : Value(contextSentence),
      paraphraseHintsJson: paraphraseHintsJson == null && nullToAbsent
          ? const Value.absent()
          : Value(paraphraseHintsJson),
      usageNote: usageNote == null && nullToAbsent
          ? const Value.absent()
          : Value(usageNote),
      sourceSkill: sourceSkill == null && nullToAbsent
          ? const Value.absent()
          : Value(sourceSkill),
      sourceAttemptId: sourceAttemptId == null && nullToAbsent
          ? const Value.absent()
          : Value(sourceAttemptId),
      sourceRefLabel: sourceRefLabel == null && nullToAbsent
          ? const Value.absent()
          : Value(sourceRefLabel),
    );
  }

  factory VocabCardRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return VocabCardRow(
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      cardId: serializer.fromJson<String>(json['cardId']),
      headword: serializer.fromJson<String>(json['headword']),
      ipa: serializer.fromJson<String?>(json['ipa']),
      definition: serializer.fromJson<String>(json['definition']),
      topicTag: serializer.fromJson<String>(json['topicTag']),
      repetitions: serializer.fromJson<int>(json['repetitions']),
      intervalDays: serializer.fromJson<int>(json['intervalDays']),
      easeFactor: serializer.fromJson<double>(json['easeFactor']),
      easeFactorMilli: serializer.fromJson<int>(json['easeFactorMilli']),
      dueDay: serializer.fromJson<int>(json['dueDay']),
      dueDaySerial: serializer.fromJson<int>(json['dueDaySerial']),
      contextSentence: serializer.fromJson<String?>(json['contextSentence']),
      paraphraseHintsJson: serializer.fromJson<String?>(
        json['paraphraseHintsJson'],
      ),
      usageNote: serializer.fromJson<String?>(json['usageNote']),
      sourceSkill: serializer.fromJson<String?>(json['sourceSkill']),
      sourceAttemptId: serializer.fromJson<String?>(json['sourceAttemptId']),
      sourceRefLabel: serializer.fromJson<String?>(json['sourceRefLabel']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'cardId': serializer.toJson<String>(cardId),
      'headword': serializer.toJson<String>(headword),
      'ipa': serializer.toJson<String?>(ipa),
      'definition': serializer.toJson<String>(definition),
      'topicTag': serializer.toJson<String>(topicTag),
      'repetitions': serializer.toJson<int>(repetitions),
      'intervalDays': serializer.toJson<int>(intervalDays),
      'easeFactor': serializer.toJson<double>(easeFactor),
      'easeFactorMilli': serializer.toJson<int>(easeFactorMilli),
      'dueDay': serializer.toJson<int>(dueDay),
      'dueDaySerial': serializer.toJson<int>(dueDaySerial),
      'contextSentence': serializer.toJson<String?>(contextSentence),
      'paraphraseHintsJson': serializer.toJson<String?>(paraphraseHintsJson),
      'usageNote': serializer.toJson<String?>(usageNote),
      'sourceSkill': serializer.toJson<String?>(sourceSkill),
      'sourceAttemptId': serializer.toJson<String?>(sourceAttemptId),
      'sourceRefLabel': serializer.toJson<String?>(sourceRefLabel),
    };
  }

  VocabCardRow copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    String? cardId,
    String? headword,
    Value<String?> ipa = const Value.absent(),
    String? definition,
    String? topicTag,
    int? repetitions,
    int? intervalDays,
    double? easeFactor,
    int? easeFactorMilli,
    int? dueDay,
    int? dueDaySerial,
    Value<String?> contextSentence = const Value.absent(),
    Value<String?> paraphraseHintsJson = const Value.absent(),
    Value<String?> usageNote = const Value.absent(),
    Value<String?> sourceSkill = const Value.absent(),
    Value<String?> sourceAttemptId = const Value.absent(),
    Value<String?> sourceRefLabel = const Value.absent(),
  }) => VocabCardRow(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    cardId: cardId ?? this.cardId,
    headword: headword ?? this.headword,
    ipa: ipa.present ? ipa.value : this.ipa,
    definition: definition ?? this.definition,
    topicTag: topicTag ?? this.topicTag,
    repetitions: repetitions ?? this.repetitions,
    intervalDays: intervalDays ?? this.intervalDays,
    easeFactor: easeFactor ?? this.easeFactor,
    easeFactorMilli: easeFactorMilli ?? this.easeFactorMilli,
    dueDay: dueDay ?? this.dueDay,
    dueDaySerial: dueDaySerial ?? this.dueDaySerial,
    contextSentence: contextSentence.present
        ? contextSentence.value
        : this.contextSentence,
    paraphraseHintsJson: paraphraseHintsJson.present
        ? paraphraseHintsJson.value
        : this.paraphraseHintsJson,
    usageNote: usageNote.present ? usageNote.value : this.usageNote,
    sourceSkill: sourceSkill.present ? sourceSkill.value : this.sourceSkill,
    sourceAttemptId: sourceAttemptId.present
        ? sourceAttemptId.value
        : this.sourceAttemptId,
    sourceRefLabel: sourceRefLabel.present
        ? sourceRefLabel.value
        : this.sourceRefLabel,
  );
  VocabCardRow copyWithCompanion(VocabCardsCompanion data) {
    return VocabCardRow(
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      cardId: data.cardId.present ? data.cardId.value : this.cardId,
      headword: data.headword.present ? data.headword.value : this.headword,
      ipa: data.ipa.present ? data.ipa.value : this.ipa,
      definition: data.definition.present
          ? data.definition.value
          : this.definition,
      topicTag: data.topicTag.present ? data.topicTag.value : this.topicTag,
      repetitions: data.repetitions.present
          ? data.repetitions.value
          : this.repetitions,
      intervalDays: data.intervalDays.present
          ? data.intervalDays.value
          : this.intervalDays,
      easeFactor: data.easeFactor.present
          ? data.easeFactor.value
          : this.easeFactor,
      easeFactorMilli: data.easeFactorMilli.present
          ? data.easeFactorMilli.value
          : this.easeFactorMilli,
      dueDay: data.dueDay.present ? data.dueDay.value : this.dueDay,
      dueDaySerial: data.dueDaySerial.present
          ? data.dueDaySerial.value
          : this.dueDaySerial,
      contextSentence: data.contextSentence.present
          ? data.contextSentence.value
          : this.contextSentence,
      paraphraseHintsJson: data.paraphraseHintsJson.present
          ? data.paraphraseHintsJson.value
          : this.paraphraseHintsJson,
      usageNote: data.usageNote.present ? data.usageNote.value : this.usageNote,
      sourceSkill: data.sourceSkill.present
          ? data.sourceSkill.value
          : this.sourceSkill,
      sourceAttemptId: data.sourceAttemptId.present
          ? data.sourceAttemptId.value
          : this.sourceAttemptId,
      sourceRefLabel: data.sourceRefLabel.present
          ? data.sourceRefLabel.value
          : this.sourceRefLabel,
    );
  }

  @override
  String toString() {
    return (StringBuffer('VocabCardRow(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('cardId: $cardId, ')
          ..write('headword: $headword, ')
          ..write('ipa: $ipa, ')
          ..write('definition: $definition, ')
          ..write('topicTag: $topicTag, ')
          ..write('repetitions: $repetitions, ')
          ..write('intervalDays: $intervalDays, ')
          ..write('easeFactor: $easeFactor, ')
          ..write('easeFactorMilli: $easeFactorMilli, ')
          ..write('dueDay: $dueDay, ')
          ..write('dueDaySerial: $dueDaySerial, ')
          ..write('contextSentence: $contextSentence, ')
          ..write('paraphraseHintsJson: $paraphraseHintsJson, ')
          ..write('usageNote: $usageNote, ')
          ..write('sourceSkill: $sourceSkill, ')
          ..write('sourceAttemptId: $sourceAttemptId, ')
          ..write('sourceRefLabel: $sourceRefLabel')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    createdAt,
    updatedAt,
    cardId,
    headword,
    ipa,
    definition,
    topicTag,
    repetitions,
    intervalDays,
    easeFactor,
    easeFactorMilli,
    dueDay,
    dueDaySerial,
    contextSentence,
    paraphraseHintsJson,
    usageNote,
    sourceSkill,
    sourceAttemptId,
    sourceRefLabel,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is VocabCardRow &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.cardId == this.cardId &&
          other.headword == this.headword &&
          other.ipa == this.ipa &&
          other.definition == this.definition &&
          other.topicTag == this.topicTag &&
          other.repetitions == this.repetitions &&
          other.intervalDays == this.intervalDays &&
          other.easeFactor == this.easeFactor &&
          other.easeFactorMilli == this.easeFactorMilli &&
          other.dueDay == this.dueDay &&
          other.dueDaySerial == this.dueDaySerial &&
          other.contextSentence == this.contextSentence &&
          other.paraphraseHintsJson == this.paraphraseHintsJson &&
          other.usageNote == this.usageNote &&
          other.sourceSkill == this.sourceSkill &&
          other.sourceAttemptId == this.sourceAttemptId &&
          other.sourceRefLabel == this.sourceRefLabel);
}

class VocabCardsCompanion extends UpdateCompanion<VocabCardRow> {
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<String> cardId;
  final Value<String> headword;
  final Value<String?> ipa;
  final Value<String> definition;
  final Value<String> topicTag;
  final Value<int> repetitions;
  final Value<int> intervalDays;
  final Value<double> easeFactor;
  final Value<int> easeFactorMilli;
  final Value<int> dueDay;
  final Value<int> dueDaySerial;
  final Value<String?> contextSentence;
  final Value<String?> paraphraseHintsJson;
  final Value<String?> usageNote;
  final Value<String?> sourceSkill;
  final Value<String?> sourceAttemptId;
  final Value<String?> sourceRefLabel;
  final Value<int> rowid;
  const VocabCardsCompanion({
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.cardId = const Value.absent(),
    this.headword = const Value.absent(),
    this.ipa = const Value.absent(),
    this.definition = const Value.absent(),
    this.topicTag = const Value.absent(),
    this.repetitions = const Value.absent(),
    this.intervalDays = const Value.absent(),
    this.easeFactor = const Value.absent(),
    this.easeFactorMilli = const Value.absent(),
    this.dueDay = const Value.absent(),
    this.dueDaySerial = const Value.absent(),
    this.contextSentence = const Value.absent(),
    this.paraphraseHintsJson = const Value.absent(),
    this.usageNote = const Value.absent(),
    this.sourceSkill = const Value.absent(),
    this.sourceAttemptId = const Value.absent(),
    this.sourceRefLabel = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  VocabCardsCompanion.insert({
    required DateTime createdAt,
    required DateTime updatedAt,
    required String cardId,
    required String headword,
    this.ipa = const Value.absent(),
    required String definition,
    required String topicTag,
    this.repetitions = const Value.absent(),
    this.intervalDays = const Value.absent(),
    this.easeFactor = const Value.absent(),
    this.easeFactorMilli = const Value.absent(),
    required int dueDay,
    this.dueDaySerial = const Value.absent(),
    this.contextSentence = const Value.absent(),
    this.paraphraseHintsJson = const Value.absent(),
    this.usageNote = const Value.absent(),
    this.sourceSkill = const Value.absent(),
    this.sourceAttemptId = const Value.absent(),
    this.sourceRefLabel = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : createdAt = Value(createdAt),
       updatedAt = Value(updatedAt),
       cardId = Value(cardId),
       headword = Value(headword),
       definition = Value(definition),
       topicTag = Value(topicTag),
       dueDay = Value(dueDay);
  static Insertable<VocabCardRow> custom({
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<String>? cardId,
    Expression<String>? headword,
    Expression<String>? ipa,
    Expression<String>? definition,
    Expression<String>? topicTag,
    Expression<int>? repetitions,
    Expression<int>? intervalDays,
    Expression<double>? easeFactor,
    Expression<int>? easeFactorMilli,
    Expression<int>? dueDay,
    Expression<int>? dueDaySerial,
    Expression<String>? contextSentence,
    Expression<String>? paraphraseHintsJson,
    Expression<String>? usageNote,
    Expression<String>? sourceSkill,
    Expression<String>? sourceAttemptId,
    Expression<String>? sourceRefLabel,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (cardId != null) 'card_id': cardId,
      if (headword != null) 'headword': headword,
      if (ipa != null) 'ipa': ipa,
      if (definition != null) 'definition': definition,
      if (topicTag != null) 'topic_tag': topicTag,
      if (repetitions != null) 'repetitions': repetitions,
      if (intervalDays != null) 'interval_days': intervalDays,
      if (easeFactor != null) 'ease_factor': easeFactor,
      if (easeFactorMilli != null) 'ease_factor_milli': easeFactorMilli,
      if (dueDay != null) 'due_day': dueDay,
      if (dueDaySerial != null) 'due_day_serial': dueDaySerial,
      if (contextSentence != null) 'context_sentence': contextSentence,
      if (paraphraseHintsJson != null)
        'paraphrase_hints_json': paraphraseHintsJson,
      if (usageNote != null) 'usage_note': usageNote,
      if (sourceSkill != null) 'source_skill': sourceSkill,
      if (sourceAttemptId != null) 'source_attempt_id': sourceAttemptId,
      if (sourceRefLabel != null) 'source_ref_label': sourceRefLabel,
      if (rowid != null) 'rowid': rowid,
    });
  }

  VocabCardsCompanion copyWith({
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<String>? cardId,
    Value<String>? headword,
    Value<String?>? ipa,
    Value<String>? definition,
    Value<String>? topicTag,
    Value<int>? repetitions,
    Value<int>? intervalDays,
    Value<double>? easeFactor,
    Value<int>? easeFactorMilli,
    Value<int>? dueDay,
    Value<int>? dueDaySerial,
    Value<String?>? contextSentence,
    Value<String?>? paraphraseHintsJson,
    Value<String?>? usageNote,
    Value<String?>? sourceSkill,
    Value<String?>? sourceAttemptId,
    Value<String?>? sourceRefLabel,
    Value<int>? rowid,
  }) {
    return VocabCardsCompanion(
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      cardId: cardId ?? this.cardId,
      headword: headword ?? this.headword,
      ipa: ipa ?? this.ipa,
      definition: definition ?? this.definition,
      topicTag: topicTag ?? this.topicTag,
      repetitions: repetitions ?? this.repetitions,
      intervalDays: intervalDays ?? this.intervalDays,
      easeFactor: easeFactor ?? this.easeFactor,
      easeFactorMilli: easeFactorMilli ?? this.easeFactorMilli,
      dueDay: dueDay ?? this.dueDay,
      dueDaySerial: dueDaySerial ?? this.dueDaySerial,
      contextSentence: contextSentence ?? this.contextSentence,
      paraphraseHintsJson: paraphraseHintsJson ?? this.paraphraseHintsJson,
      usageNote: usageNote ?? this.usageNote,
      sourceSkill: sourceSkill ?? this.sourceSkill,
      sourceAttemptId: sourceAttemptId ?? this.sourceAttemptId,
      sourceRefLabel: sourceRefLabel ?? this.sourceRefLabel,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (cardId.present) {
      map['card_id'] = Variable<String>(cardId.value);
    }
    if (headword.present) {
      map['headword'] = Variable<String>(headword.value);
    }
    if (ipa.present) {
      map['ipa'] = Variable<String>(ipa.value);
    }
    if (definition.present) {
      map['definition'] = Variable<String>(definition.value);
    }
    if (topicTag.present) {
      map['topic_tag'] = Variable<String>(topicTag.value);
    }
    if (repetitions.present) {
      map['repetitions'] = Variable<int>(repetitions.value);
    }
    if (intervalDays.present) {
      map['interval_days'] = Variable<int>(intervalDays.value);
    }
    if (easeFactor.present) {
      map['ease_factor'] = Variable<double>(easeFactor.value);
    }
    if (easeFactorMilli.present) {
      map['ease_factor_milli'] = Variable<int>(easeFactorMilli.value);
    }
    if (dueDay.present) {
      map['due_day'] = Variable<int>(dueDay.value);
    }
    if (dueDaySerial.present) {
      map['due_day_serial'] = Variable<int>(dueDaySerial.value);
    }
    if (contextSentence.present) {
      map['context_sentence'] = Variable<String>(contextSentence.value);
    }
    if (paraphraseHintsJson.present) {
      map['paraphrase_hints_json'] = Variable<String>(
        paraphraseHintsJson.value,
      );
    }
    if (usageNote.present) {
      map['usage_note'] = Variable<String>(usageNote.value);
    }
    if (sourceSkill.present) {
      map['source_skill'] = Variable<String>(sourceSkill.value);
    }
    if (sourceAttemptId.present) {
      map['source_attempt_id'] = Variable<String>(sourceAttemptId.value);
    }
    if (sourceRefLabel.present) {
      map['source_ref_label'] = Variable<String>(sourceRefLabel.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('VocabCardsCompanion(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('cardId: $cardId, ')
          ..write('headword: $headword, ')
          ..write('ipa: $ipa, ')
          ..write('definition: $definition, ')
          ..write('topicTag: $topicTag, ')
          ..write('repetitions: $repetitions, ')
          ..write('intervalDays: $intervalDays, ')
          ..write('easeFactor: $easeFactor, ')
          ..write('easeFactorMilli: $easeFactorMilli, ')
          ..write('dueDay: $dueDay, ')
          ..write('dueDaySerial: $dueDaySerial, ')
          ..write('contextSentence: $contextSentence, ')
          ..write('paraphraseHintsJson: $paraphraseHintsJson, ')
          ..write('usageNote: $usageNote, ')
          ..write('sourceSkill: $sourceSkill, ')
          ..write('sourceAttemptId: $sourceAttemptId, ')
          ..write('sourceRefLabel: $sourceRefLabel, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $VocabReviewLogsTable extends VocabReviewLogs
    with TableInfo<$VocabReviewLogsTable, VocabReviewLogRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $VocabReviewLogsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _logIdMeta = const VerificationMeta('logId');
  @override
  late final GeneratedColumn<String> logId = GeneratedColumn<String>(
    'log_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cardIdMeta = const VerificationMeta('cardId');
  @override
  late final GeneratedColumn<String> cardId = GeneratedColumn<String>(
    'card_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES vocab_cards (card_id) ON DELETE CASCADE',
    ),
  );
  static const VerificationMeta _ratingMeta = const VerificationMeta('rating');
  @override
  late final GeneratedColumn<int> rating = GeneratedColumn<int>(
    'rating',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _reviewedDaySerialMeta = const VerificationMeta(
    'reviewedDaySerial',
  );
  @override
  late final GeneratedColumn<int> reviewedDaySerial = GeneratedColumn<int>(
    'reviewed_day_serial',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _reviewedAtUtcMsMeta = const VerificationMeta(
    'reviewedAtUtcMs',
  );
  @override
  late final GeneratedColumn<int> reviewedAtUtcMs = GeneratedColumn<int>(
    'reviewed_at_utc_ms',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    logId,
    cardId,
    rating,
    reviewedDaySerial,
    reviewedAtUtcMs,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'vocab_review_logs';
  @override
  VerificationContext validateIntegrity(
    Insertable<VocabReviewLogRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('log_id')) {
      context.handle(
        _logIdMeta,
        logId.isAcceptableOrUnknown(data['log_id']!, _logIdMeta),
      );
    } else if (isInserting) {
      context.missing(_logIdMeta);
    }
    if (data.containsKey('card_id')) {
      context.handle(
        _cardIdMeta,
        cardId.isAcceptableOrUnknown(data['card_id']!, _cardIdMeta),
      );
    } else if (isInserting) {
      context.missing(_cardIdMeta);
    }
    if (data.containsKey('rating')) {
      context.handle(
        _ratingMeta,
        rating.isAcceptableOrUnknown(data['rating']!, _ratingMeta),
      );
    } else if (isInserting) {
      context.missing(_ratingMeta);
    }
    if (data.containsKey('reviewed_day_serial')) {
      context.handle(
        _reviewedDaySerialMeta,
        reviewedDaySerial.isAcceptableOrUnknown(
          data['reviewed_day_serial']!,
          _reviewedDaySerialMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_reviewedDaySerialMeta);
    }
    if (data.containsKey('reviewed_at_utc_ms')) {
      context.handle(
        _reviewedAtUtcMsMeta,
        reviewedAtUtcMs.isAcceptableOrUnknown(
          data['reviewed_at_utc_ms']!,
          _reviewedAtUtcMsMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_reviewedAtUtcMsMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {logId};
  @override
  VocabReviewLogRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return VocabReviewLogRow(
      logId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}log_id'],
      )!,
      cardId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}card_id'],
      )!,
      rating: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}rating'],
      )!,
      reviewedDaySerial: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}reviewed_day_serial'],
      )!,
      reviewedAtUtcMs: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}reviewed_at_utc_ms'],
      )!,
    );
  }

  @override
  $VocabReviewLogsTable createAlias(String alias) {
    return $VocabReviewLogsTable(attachedDatabase, alias);
  }

  @override
  bool get isStrict => true;
}

class VocabReviewLogRow extends DataClass
    implements Insertable<VocabReviewLogRow> {
  /// Unique log entry identifier.
  final String logId;

  /// Parent card foreign key.
  final String cardId;

  /// User rating (0=Again, 1=Hard, 2=Good, 3=Easy, or 0..5 SM-2 scale).
  final int rating;

  /// UTC serial day when reviewed.
  final int reviewedDaySerial;

  /// Timestamp in UTC milliseconds when reviewed.
  final int reviewedAtUtcMs;
  const VocabReviewLogRow({
    required this.logId,
    required this.cardId,
    required this.rating,
    required this.reviewedDaySerial,
    required this.reviewedAtUtcMs,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['log_id'] = Variable<String>(logId);
    map['card_id'] = Variable<String>(cardId);
    map['rating'] = Variable<int>(rating);
    map['reviewed_day_serial'] = Variable<int>(reviewedDaySerial);
    map['reviewed_at_utc_ms'] = Variable<int>(reviewedAtUtcMs);
    return map;
  }

  VocabReviewLogsCompanion toCompanion(bool nullToAbsent) {
    return VocabReviewLogsCompanion(
      logId: Value(logId),
      cardId: Value(cardId),
      rating: Value(rating),
      reviewedDaySerial: Value(reviewedDaySerial),
      reviewedAtUtcMs: Value(reviewedAtUtcMs),
    );
  }

  factory VocabReviewLogRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return VocabReviewLogRow(
      logId: serializer.fromJson<String>(json['logId']),
      cardId: serializer.fromJson<String>(json['cardId']),
      rating: serializer.fromJson<int>(json['rating']),
      reviewedDaySerial: serializer.fromJson<int>(json['reviewedDaySerial']),
      reviewedAtUtcMs: serializer.fromJson<int>(json['reviewedAtUtcMs']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'logId': serializer.toJson<String>(logId),
      'cardId': serializer.toJson<String>(cardId),
      'rating': serializer.toJson<int>(rating),
      'reviewedDaySerial': serializer.toJson<int>(reviewedDaySerial),
      'reviewedAtUtcMs': serializer.toJson<int>(reviewedAtUtcMs),
    };
  }

  VocabReviewLogRow copyWith({
    String? logId,
    String? cardId,
    int? rating,
    int? reviewedDaySerial,
    int? reviewedAtUtcMs,
  }) => VocabReviewLogRow(
    logId: logId ?? this.logId,
    cardId: cardId ?? this.cardId,
    rating: rating ?? this.rating,
    reviewedDaySerial: reviewedDaySerial ?? this.reviewedDaySerial,
    reviewedAtUtcMs: reviewedAtUtcMs ?? this.reviewedAtUtcMs,
  );
  VocabReviewLogRow copyWithCompanion(VocabReviewLogsCompanion data) {
    return VocabReviewLogRow(
      logId: data.logId.present ? data.logId.value : this.logId,
      cardId: data.cardId.present ? data.cardId.value : this.cardId,
      rating: data.rating.present ? data.rating.value : this.rating,
      reviewedDaySerial: data.reviewedDaySerial.present
          ? data.reviewedDaySerial.value
          : this.reviewedDaySerial,
      reviewedAtUtcMs: data.reviewedAtUtcMs.present
          ? data.reviewedAtUtcMs.value
          : this.reviewedAtUtcMs,
    );
  }

  @override
  String toString() {
    return (StringBuffer('VocabReviewLogRow(')
          ..write('logId: $logId, ')
          ..write('cardId: $cardId, ')
          ..write('rating: $rating, ')
          ..write('reviewedDaySerial: $reviewedDaySerial, ')
          ..write('reviewedAtUtcMs: $reviewedAtUtcMs')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(logId, cardId, rating, reviewedDaySerial, reviewedAtUtcMs);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is VocabReviewLogRow &&
          other.logId == this.logId &&
          other.cardId == this.cardId &&
          other.rating == this.rating &&
          other.reviewedDaySerial == this.reviewedDaySerial &&
          other.reviewedAtUtcMs == this.reviewedAtUtcMs);
}

class VocabReviewLogsCompanion extends UpdateCompanion<VocabReviewLogRow> {
  final Value<String> logId;
  final Value<String> cardId;
  final Value<int> rating;
  final Value<int> reviewedDaySerial;
  final Value<int> reviewedAtUtcMs;
  final Value<int> rowid;
  const VocabReviewLogsCompanion({
    this.logId = const Value.absent(),
    this.cardId = const Value.absent(),
    this.rating = const Value.absent(),
    this.reviewedDaySerial = const Value.absent(),
    this.reviewedAtUtcMs = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  VocabReviewLogsCompanion.insert({
    required String logId,
    required String cardId,
    required int rating,
    required int reviewedDaySerial,
    required int reviewedAtUtcMs,
    this.rowid = const Value.absent(),
  }) : logId = Value(logId),
       cardId = Value(cardId),
       rating = Value(rating),
       reviewedDaySerial = Value(reviewedDaySerial),
       reviewedAtUtcMs = Value(reviewedAtUtcMs);
  static Insertable<VocabReviewLogRow> custom({
    Expression<String>? logId,
    Expression<String>? cardId,
    Expression<int>? rating,
    Expression<int>? reviewedDaySerial,
    Expression<int>? reviewedAtUtcMs,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (logId != null) 'log_id': logId,
      if (cardId != null) 'card_id': cardId,
      if (rating != null) 'rating': rating,
      if (reviewedDaySerial != null) 'reviewed_day_serial': reviewedDaySerial,
      if (reviewedAtUtcMs != null) 'reviewed_at_utc_ms': reviewedAtUtcMs,
      if (rowid != null) 'rowid': rowid,
    });
  }

  VocabReviewLogsCompanion copyWith({
    Value<String>? logId,
    Value<String>? cardId,
    Value<int>? rating,
    Value<int>? reviewedDaySerial,
    Value<int>? reviewedAtUtcMs,
    Value<int>? rowid,
  }) {
    return VocabReviewLogsCompanion(
      logId: logId ?? this.logId,
      cardId: cardId ?? this.cardId,
      rating: rating ?? this.rating,
      reviewedDaySerial: reviewedDaySerial ?? this.reviewedDaySerial,
      reviewedAtUtcMs: reviewedAtUtcMs ?? this.reviewedAtUtcMs,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (logId.present) {
      map['log_id'] = Variable<String>(logId.value);
    }
    if (cardId.present) {
      map['card_id'] = Variable<String>(cardId.value);
    }
    if (rating.present) {
      map['rating'] = Variable<int>(rating.value);
    }
    if (reviewedDaySerial.present) {
      map['reviewed_day_serial'] = Variable<int>(reviewedDaySerial.value);
    }
    if (reviewedAtUtcMs.present) {
      map['reviewed_at_utc_ms'] = Variable<int>(reviewedAtUtcMs.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('VocabReviewLogsCompanion(')
          ..write('logId: $logId, ')
          ..write('cardId: $cardId, ')
          ..write('rating: $rating, ')
          ..write('reviewedDaySerial: $reviewedDaySerial, ')
          ..write('reviewedAtUtcMs: $reviewedAtUtcMs, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DailyStudyLogsTable extends DailyStudyLogs
    with TableInfo<$DailyStudyLogsTable, DailyStudyLogRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DailyStudyLogsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _serialDayMeta = const VerificationMeta(
    'serialDay',
  );
  @override
  late final GeneratedColumn<int> serialDay = GeneratedColumn<int>(
    'serial_day',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _studySecondsMeta = const VerificationMeta(
    'studySeconds',
  );
  @override
  late final GeneratedColumn<int> studySeconds = GeneratedColumn<int>(
    'study_seconds',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _completedItemsMeta = const VerificationMeta(
    'completedItems',
  );
  @override
  late final GeneratedColumn<int> completedItems = GeneratedColumn<int>(
    'completed_items',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  @override
  List<GeneratedColumn> get $columns => [
    createdAt,
    updatedAt,
    serialDay,
    studySeconds,
    completedItems,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'daily_study_logs';
  @override
  VerificationContext validateIntegrity(
    Insertable<DailyStudyLogRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('serial_day')) {
      context.handle(
        _serialDayMeta,
        serialDay.isAcceptableOrUnknown(data['serial_day']!, _serialDayMeta),
      );
    }
    if (data.containsKey('study_seconds')) {
      context.handle(
        _studySecondsMeta,
        studySeconds.isAcceptableOrUnknown(
          data['study_seconds']!,
          _studySecondsMeta,
        ),
      );
    }
    if (data.containsKey('completed_items')) {
      context.handle(
        _completedItemsMeta,
        completedItems.isAcceptableOrUnknown(
          data['completed_items']!,
          _completedItemsMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {serialDay};
  @override
  DailyStudyLogRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DailyStudyLogRow(
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      serialDay: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}serial_day'],
      )!,
      studySeconds: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}study_seconds'],
      )!,
      completedItems: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}completed_items'],
      )!,
    );
  }

  @override
  $DailyStudyLogsTable createAlias(String alias) {
    return $DailyStudyLogsTable(attachedDatabase, alias);
  }
}

class DailyStudyLogRow extends DataClass
    implements Insertable<DailyStudyLogRow> {
  /// Record creation timestamp in UTC.
  final DateTime createdAt;

  /// Last local mutation timestamp in UTC.
  final DateTime updatedAt;

  /// UTC integer day number since Unix epoch.
  final int serialDay;

  /// Accumulated study seconds recorded on this day.
  final int studySeconds;

  /// Completed drill/review items count.
  final int completedItems;
  const DailyStudyLogRow({
    required this.createdAt,
    required this.updatedAt,
    required this.serialDay,
    required this.studySeconds,
    required this.completedItems,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['serial_day'] = Variable<int>(serialDay);
    map['study_seconds'] = Variable<int>(studySeconds);
    map['completed_items'] = Variable<int>(completedItems);
    return map;
  }

  DailyStudyLogsCompanion toCompanion(bool nullToAbsent) {
    return DailyStudyLogsCompanion(
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      serialDay: Value(serialDay),
      studySeconds: Value(studySeconds),
      completedItems: Value(completedItems),
    );
  }

  factory DailyStudyLogRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DailyStudyLogRow(
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      serialDay: serializer.fromJson<int>(json['serialDay']),
      studySeconds: serializer.fromJson<int>(json['studySeconds']),
      completedItems: serializer.fromJson<int>(json['completedItems']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'serialDay': serializer.toJson<int>(serialDay),
      'studySeconds': serializer.toJson<int>(studySeconds),
      'completedItems': serializer.toJson<int>(completedItems),
    };
  }

  DailyStudyLogRow copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    int? serialDay,
    int? studySeconds,
    int? completedItems,
  }) => DailyStudyLogRow(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    serialDay: serialDay ?? this.serialDay,
    studySeconds: studySeconds ?? this.studySeconds,
    completedItems: completedItems ?? this.completedItems,
  );
  DailyStudyLogRow copyWithCompanion(DailyStudyLogsCompanion data) {
    return DailyStudyLogRow(
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      serialDay: data.serialDay.present ? data.serialDay.value : this.serialDay,
      studySeconds: data.studySeconds.present
          ? data.studySeconds.value
          : this.studySeconds,
      completedItems: data.completedItems.present
          ? data.completedItems.value
          : this.completedItems,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DailyStudyLogRow(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('serialDay: $serialDay, ')
          ..write('studySeconds: $studySeconds, ')
          ..write('completedItems: $completedItems')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    createdAt,
    updatedAt,
    serialDay,
    studySeconds,
    completedItems,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DailyStudyLogRow &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.serialDay == this.serialDay &&
          other.studySeconds == this.studySeconds &&
          other.completedItems == this.completedItems);
}

class DailyStudyLogsCompanion extends UpdateCompanion<DailyStudyLogRow> {
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> serialDay;
  final Value<int> studySeconds;
  final Value<int> completedItems;
  const DailyStudyLogsCompanion({
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.serialDay = const Value.absent(),
    this.studySeconds = const Value.absent(),
    this.completedItems = const Value.absent(),
  });
  DailyStudyLogsCompanion.insert({
    required DateTime createdAt,
    required DateTime updatedAt,
    this.serialDay = const Value.absent(),
    this.studySeconds = const Value.absent(),
    this.completedItems = const Value.absent(),
  }) : createdAt = Value(createdAt),
       updatedAt = Value(updatedAt);
  static Insertable<DailyStudyLogRow> custom({
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? serialDay,
    Expression<int>? studySeconds,
    Expression<int>? completedItems,
  }) {
    return RawValuesInsertable({
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (serialDay != null) 'serial_day': serialDay,
      if (studySeconds != null) 'study_seconds': studySeconds,
      if (completedItems != null) 'completed_items': completedItems,
    });
  }

  DailyStudyLogsCompanion copyWith({
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<int>? serialDay,
    Value<int>? studySeconds,
    Value<int>? completedItems,
  }) {
    return DailyStudyLogsCompanion(
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      serialDay: serialDay ?? this.serialDay,
      studySeconds: studySeconds ?? this.studySeconds,
      completedItems: completedItems ?? this.completedItems,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (serialDay.present) {
      map['serial_day'] = Variable<int>(serialDay.value);
    }
    if (studySeconds.present) {
      map['study_seconds'] = Variable<int>(studySeconds.value);
    }
    if (completedItems.present) {
      map['completed_items'] = Variable<int>(completedItems.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DailyStudyLogsCompanion(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('serialDay: $serialDay, ')
          ..write('studySeconds: $studySeconds, ')
          ..write('completedItems: $completedItems')
          ..write(')'))
        .toString();
  }
}

class $OutboxSyncQueueTable extends OutboxSyncQueue
    with TableInfo<$OutboxSyncQueueTable, OutboxSyncItemRow> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OutboxSyncQueueTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _actionTypeMeta = const VerificationMeta(
    'actionType',
  );
  @override
  late final GeneratedColumn<String> actionType = GeneratedColumn<String>(
    'action_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadJsonMeta = const VerificationMeta(
    'payloadJson',
  );
  @override
  late final GeneratedColumn<String> payloadJson = GeneratedColumn<String>(
    'payload_json',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _retryCountMeta = const VerificationMeta(
    'retryCount',
  );
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
    'retry_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _nextAttemptAtMeta = const VerificationMeta(
    'nextAttemptAt',
  );
  @override
  late final GeneratedColumn<DateTime> nextAttemptAt =
      GeneratedColumn<DateTime>(
        'next_attempt_at',
        aliasedName,
        false,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: true,
      );
  @override
  List<GeneratedColumn> get $columns => [
    createdAt,
    updatedAt,
    id,
    actionType,
    payloadJson,
    retryCount,
    nextAttemptAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'outbox_sync_queue';
  @override
  VerificationContext validateIntegrity(
    Insertable<OutboxSyncItemRow> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('action_type')) {
      context.handle(
        _actionTypeMeta,
        actionType.isAcceptableOrUnknown(data['action_type']!, _actionTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_actionTypeMeta);
    }
    if (data.containsKey('payload_json')) {
      context.handle(
        _payloadJsonMeta,
        payloadJson.isAcceptableOrUnknown(
          data['payload_json']!,
          _payloadJsonMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_payloadJsonMeta);
    }
    if (data.containsKey('retry_count')) {
      context.handle(
        _retryCountMeta,
        retryCount.isAcceptableOrUnknown(data['retry_count']!, _retryCountMeta),
      );
    }
    if (data.containsKey('next_attempt_at')) {
      context.handle(
        _nextAttemptAtMeta,
        nextAttemptAt.isAcceptableOrUnknown(
          data['next_attempt_at']!,
          _nextAttemptAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_nextAttemptAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  OutboxSyncItemRow map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OutboxSyncItemRow(
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      actionType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}action_type'],
      )!,
      payloadJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload_json'],
      )!,
      retryCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}retry_count'],
      )!,
      nextAttemptAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}next_attempt_at'],
      )!,
    );
  }

  @override
  $OutboxSyncQueueTable createAlias(String alias) {
    return $OutboxSyncQueueTable(attachedDatabase, alias);
  }
}

class OutboxSyncItemRow extends DataClass
    implements Insertable<OutboxSyncItemRow> {
  /// Record creation timestamp in UTC.
  final DateTime createdAt;

  /// Last local mutation timestamp in UTC.
  final DateTime updatedAt;

  /// Auto-increment queue sequence key.
  final int id;

  /// Operation type (`evaluate_speaking`, `evaluate_writing`, `sync_log`).
  final String actionType;

  /// JSON payload required to replay the operation.
  final String payloadJson;

  /// Attempt counter for exponential backoff.
  final int retryCount;

  /// Earliest UTC timestamp for the next scheduled retry.
  final DateTime nextAttemptAt;
  const OutboxSyncItemRow({
    required this.createdAt,
    required this.updatedAt,
    required this.id,
    required this.actionType,
    required this.payloadJson,
    required this.retryCount,
    required this.nextAttemptAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['created_at'] = Variable<DateTime>(createdAt);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    map['id'] = Variable<int>(id);
    map['action_type'] = Variable<String>(actionType);
    map['payload_json'] = Variable<String>(payloadJson);
    map['retry_count'] = Variable<int>(retryCount);
    map['next_attempt_at'] = Variable<DateTime>(nextAttemptAt);
    return map;
  }

  OutboxSyncQueueCompanion toCompanion(bool nullToAbsent) {
    return OutboxSyncQueueCompanion(
      createdAt: Value(createdAt),
      updatedAt: Value(updatedAt),
      id: Value(id),
      actionType: Value(actionType),
      payloadJson: Value(payloadJson),
      retryCount: Value(retryCount),
      nextAttemptAt: Value(nextAttemptAt),
    );
  }

  factory OutboxSyncItemRow.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OutboxSyncItemRow(
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
      id: serializer.fromJson<int>(json['id']),
      actionType: serializer.fromJson<String>(json['actionType']),
      payloadJson: serializer.fromJson<String>(json['payloadJson']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      nextAttemptAt: serializer.fromJson<DateTime>(json['nextAttemptAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
      'id': serializer.toJson<int>(id),
      'actionType': serializer.toJson<String>(actionType),
      'payloadJson': serializer.toJson<String>(payloadJson),
      'retryCount': serializer.toJson<int>(retryCount),
      'nextAttemptAt': serializer.toJson<DateTime>(nextAttemptAt),
    };
  }

  OutboxSyncItemRow copyWith({
    DateTime? createdAt,
    DateTime? updatedAt,
    int? id,
    String? actionType,
    String? payloadJson,
    int? retryCount,
    DateTime? nextAttemptAt,
  }) => OutboxSyncItemRow(
    createdAt: createdAt ?? this.createdAt,
    updatedAt: updatedAt ?? this.updatedAt,
    id: id ?? this.id,
    actionType: actionType ?? this.actionType,
    payloadJson: payloadJson ?? this.payloadJson,
    retryCount: retryCount ?? this.retryCount,
    nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
  );
  OutboxSyncItemRow copyWithCompanion(OutboxSyncQueueCompanion data) {
    return OutboxSyncItemRow(
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
      id: data.id.present ? data.id.value : this.id,
      actionType: data.actionType.present
          ? data.actionType.value
          : this.actionType,
      payloadJson: data.payloadJson.present
          ? data.payloadJson.value
          : this.payloadJson,
      retryCount: data.retryCount.present
          ? data.retryCount.value
          : this.retryCount,
      nextAttemptAt: data.nextAttemptAt.present
          ? data.nextAttemptAt.value
          : this.nextAttemptAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OutboxSyncItemRow(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('id: $id, ')
          ..write('actionType: $actionType, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('retryCount: $retryCount, ')
          ..write('nextAttemptAt: $nextAttemptAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    createdAt,
    updatedAt,
    id,
    actionType,
    payloadJson,
    retryCount,
    nextAttemptAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OutboxSyncItemRow &&
          other.createdAt == this.createdAt &&
          other.updatedAt == this.updatedAt &&
          other.id == this.id &&
          other.actionType == this.actionType &&
          other.payloadJson == this.payloadJson &&
          other.retryCount == this.retryCount &&
          other.nextAttemptAt == this.nextAttemptAt);
}

class OutboxSyncQueueCompanion extends UpdateCompanion<OutboxSyncItemRow> {
  final Value<DateTime> createdAt;
  final Value<DateTime> updatedAt;
  final Value<int> id;
  final Value<String> actionType;
  final Value<String> payloadJson;
  final Value<int> retryCount;
  final Value<DateTime> nextAttemptAt;
  const OutboxSyncQueueCompanion({
    this.createdAt = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.id = const Value.absent(),
    this.actionType = const Value.absent(),
    this.payloadJson = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
  });
  OutboxSyncQueueCompanion.insert({
    required DateTime createdAt,
    required DateTime updatedAt,
    this.id = const Value.absent(),
    required String actionType,
    required String payloadJson,
    this.retryCount = const Value.absent(),
    required DateTime nextAttemptAt,
  }) : createdAt = Value(createdAt),
       updatedAt = Value(updatedAt),
       actionType = Value(actionType),
       payloadJson = Value(payloadJson),
       nextAttemptAt = Value(nextAttemptAt);
  static Insertable<OutboxSyncItemRow> custom({
    Expression<DateTime>? createdAt,
    Expression<DateTime>? updatedAt,
    Expression<int>? id,
    Expression<String>? actionType,
    Expression<String>? payloadJson,
    Expression<int>? retryCount,
    Expression<DateTime>? nextAttemptAt,
  }) {
    return RawValuesInsertable({
      if (createdAt != null) 'created_at': createdAt,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (id != null) 'id': id,
      if (actionType != null) 'action_type': actionType,
      if (payloadJson != null) 'payload_json': payloadJson,
      if (retryCount != null) 'retry_count': retryCount,
      if (nextAttemptAt != null) 'next_attempt_at': nextAttemptAt,
    });
  }

  OutboxSyncQueueCompanion copyWith({
    Value<DateTime>? createdAt,
    Value<DateTime>? updatedAt,
    Value<int>? id,
    Value<String>? actionType,
    Value<String>? payloadJson,
    Value<int>? retryCount,
    Value<DateTime>? nextAttemptAt,
  }) {
    return OutboxSyncQueueCompanion(
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      id: id ?? this.id,
      actionType: actionType ?? this.actionType,
      payloadJson: payloadJson ?? this.payloadJson,
      retryCount: retryCount ?? this.retryCount,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (actionType.present) {
      map['action_type'] = Variable<String>(actionType.value);
    }
    if (payloadJson.present) {
      map['payload_json'] = Variable<String>(payloadJson.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (nextAttemptAt.present) {
      map['next_attempt_at'] = Variable<DateTime>(nextAttemptAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OutboxSyncQueueCompanion(')
          ..write('createdAt: $createdAt, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('id: $id, ')
          ..write('actionType: $actionType, ')
          ..write('payloadJson: $payloadJson, ')
          ..write('retryCount: $retryCount, ')
          ..write('nextAttemptAt: $nextAttemptAt')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $UserProfilesTable userProfiles = $UserProfilesTable(this);
  late final $ExamPacksTable examPacks = $ExamPacksTable(this);
  late final $ExamPayloadsTable examPayloads = $ExamPayloadsTable(this);
  late final $CachedDrillsTable cachedDrills = $CachedDrillsTable(this);
  late final $ExamAttemptsTable examAttempts = $ExamAttemptsTable(this);
  late final $AudioRecordingsTable audioRecordings = $AudioRecordingsTable(
    this,
  );
  late final $WritingDraftsTable writingDrafts = $WritingDraftsTable(this);
  late final $ReadingAnnotationsTable readingAnnotations =
      $ReadingAnnotationsTable(this);
  late final $VocabCardsTable vocabCards = $VocabCardsTable(this);
  late final $VocabReviewLogsTable vocabReviewLogs = $VocabReviewLogsTable(
    this,
  );
  late final $DailyStudyLogsTable dailyStudyLogs = $DailyStudyLogsTable(this);
  late final $OutboxSyncQueueTable outboxSyncQueue = $OutboxSyncQueueTable(
    this,
  );
  late final AttemptDao attemptDao = AttemptDao(this as AppDatabase);
  late final VocabDao vocabDao = VocabDao(this as AppDatabase);
  late final CatalogDao catalogDao = CatalogDao(this as AppDatabase);
  late final ProgressDao progressDao = ProgressDao(this as AppDatabase);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    userProfiles,
    examPacks,
    examPayloads,
    cachedDrills,
    examAttempts,
    audioRecordings,
    writingDrafts,
    readingAnnotations,
    vocabCards,
    vocabReviewLogs,
    dailyStudyLogs,
    outboxSyncQueue,
  ];
  @override
  StreamQueryUpdateRules get streamUpdateRules => const StreamQueryUpdateRules([
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'exam_attempts',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('audio_recordings', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'exam_attempts',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('writing_drafts', kind: UpdateKind.delete)],
    ),
    WritePropagation(
      on: TableUpdateQuery.onTableName(
        'vocab_cards',
        limitUpdateKind: UpdateKind.delete,
      ),
      result: [TableUpdate('vocab_review_logs', kind: UpdateKind.delete)],
    ),
  ]);
}

typedef $$UserProfilesTableCreateCompanionBuilder =
    UserProfilesCompanion Function({
      required DateTime createdAt,
      required DateTime updatedAt,
      required String deviceId,
      Value<double> targetBand,
      Value<String> examModule,
      Value<String> examId,
      Value<int?> targetDateSerial,
      Value<bool> onboardingCompleted,
      Value<bool> freeDiagnosticUsed,
      Value<String> themeMode,
      Value<String?> linkedEmail,
      Value<String?> appUserId,
      Value<bool> isPro,
      Value<int> rowid,
    });
typedef $$UserProfilesTableUpdateCompanionBuilder =
    UserProfilesCompanion Function({
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<String> deviceId,
      Value<double> targetBand,
      Value<String> examModule,
      Value<String> examId,
      Value<int?> targetDateSerial,
      Value<bool> onboardingCompleted,
      Value<bool> freeDiagnosticUsed,
      Value<String> themeMode,
      Value<String?> linkedEmail,
      Value<String?> appUserId,
      Value<bool> isPro,
      Value<int> rowid,
    });

class $$UserProfilesTableFilterComposer
    extends Composer<_$AppDatabase, $UserProfilesTable> {
  $$UserProfilesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get deviceId => $composableBuilder(
    column: $table.deviceId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get targetBand => $composableBuilder(
    column: $table.targetBand,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get examModule => $composableBuilder(
    column: $table.examModule,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get examId => $composableBuilder(
    column: $table.examId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get targetDateSerial => $composableBuilder(
    column: $table.targetDateSerial,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get onboardingCompleted => $composableBuilder(
    column: $table.onboardingCompleted,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get freeDiagnosticUsed => $composableBuilder(
    column: $table.freeDiagnosticUsed,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get themeMode => $composableBuilder(
    column: $table.themeMode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get linkedEmail => $composableBuilder(
    column: $table.linkedEmail,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get appUserId => $composableBuilder(
    column: $table.appUserId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isPro => $composableBuilder(
    column: $table.isPro,
    builder: (column) => ColumnFilters(column),
  );
}

class $$UserProfilesTableOrderingComposer
    extends Composer<_$AppDatabase, $UserProfilesTable> {
  $$UserProfilesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get deviceId => $composableBuilder(
    column: $table.deviceId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get targetBand => $composableBuilder(
    column: $table.targetBand,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get examModule => $composableBuilder(
    column: $table.examModule,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get examId => $composableBuilder(
    column: $table.examId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get targetDateSerial => $composableBuilder(
    column: $table.targetDateSerial,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get onboardingCompleted => $composableBuilder(
    column: $table.onboardingCompleted,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get freeDiagnosticUsed => $composableBuilder(
    column: $table.freeDiagnosticUsed,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get themeMode => $composableBuilder(
    column: $table.themeMode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get linkedEmail => $composableBuilder(
    column: $table.linkedEmail,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get appUserId => $composableBuilder(
    column: $table.appUserId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isPro => $composableBuilder(
    column: $table.isPro,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$UserProfilesTableAnnotationComposer
    extends Composer<_$AppDatabase, $UserProfilesTable> {
  $$UserProfilesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get deviceId =>
      $composableBuilder(column: $table.deviceId, builder: (column) => column);

  GeneratedColumn<double> get targetBand => $composableBuilder(
    column: $table.targetBand,
    builder: (column) => column,
  );

  GeneratedColumn<String> get examModule => $composableBuilder(
    column: $table.examModule,
    builder: (column) => column,
  );

  GeneratedColumn<String> get examId =>
      $composableBuilder(column: $table.examId, builder: (column) => column);

  GeneratedColumn<int> get targetDateSerial => $composableBuilder(
    column: $table.targetDateSerial,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get onboardingCompleted => $composableBuilder(
    column: $table.onboardingCompleted,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get freeDiagnosticUsed => $composableBuilder(
    column: $table.freeDiagnosticUsed,
    builder: (column) => column,
  );

  GeneratedColumn<String> get themeMode =>
      $composableBuilder(column: $table.themeMode, builder: (column) => column);

  GeneratedColumn<String> get linkedEmail => $composableBuilder(
    column: $table.linkedEmail,
    builder: (column) => column,
  );

  GeneratedColumn<String> get appUserId =>
      $composableBuilder(column: $table.appUserId, builder: (column) => column);

  GeneratedColumn<bool> get isPro =>
      $composableBuilder(column: $table.isPro, builder: (column) => column);
}

class $$UserProfilesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $UserProfilesTable,
          UserProfileRow,
          $$UserProfilesTableFilterComposer,
          $$UserProfilesTableOrderingComposer,
          $$UserProfilesTableAnnotationComposer,
          $$UserProfilesTableCreateCompanionBuilder,
          $$UserProfilesTableUpdateCompanionBuilder,
          (
            UserProfileRow,
            BaseReferences<_$AppDatabase, $UserProfilesTable, UserProfileRow>,
          ),
          UserProfileRow,
          PrefetchHooks Function()
        > {
  $$UserProfilesTableTableManager(_$AppDatabase db, $UserProfilesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$UserProfilesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$UserProfilesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$UserProfilesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<String> deviceId = const Value.absent(),
                Value<double> targetBand = const Value.absent(),
                Value<String> examModule = const Value.absent(),
                Value<String> examId = const Value.absent(),
                Value<int?> targetDateSerial = const Value.absent(),
                Value<bool> onboardingCompleted = const Value.absent(),
                Value<bool> freeDiagnosticUsed = const Value.absent(),
                Value<String> themeMode = const Value.absent(),
                Value<String?> linkedEmail = const Value.absent(),
                Value<String?> appUserId = const Value.absent(),
                Value<bool> isPro = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => UserProfilesCompanion(
                createdAt: createdAt,
                updatedAt: updatedAt,
                deviceId: deviceId,
                targetBand: targetBand,
                examModule: examModule,
                examId: examId,
                targetDateSerial: targetDateSerial,
                onboardingCompleted: onboardingCompleted,
                freeDiagnosticUsed: freeDiagnosticUsed,
                themeMode: themeMode,
                linkedEmail: linkedEmail,
                appUserId: appUserId,
                isPro: isPro,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required DateTime createdAt,
                required DateTime updatedAt,
                required String deviceId,
                Value<double> targetBand = const Value.absent(),
                Value<String> examModule = const Value.absent(),
                Value<String> examId = const Value.absent(),
                Value<int?> targetDateSerial = const Value.absent(),
                Value<bool> onboardingCompleted = const Value.absent(),
                Value<bool> freeDiagnosticUsed = const Value.absent(),
                Value<String> themeMode = const Value.absent(),
                Value<String?> linkedEmail = const Value.absent(),
                Value<String?> appUserId = const Value.absent(),
                Value<bool> isPro = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => UserProfilesCompanion.insert(
                createdAt: createdAt,
                updatedAt: updatedAt,
                deviceId: deviceId,
                targetBand: targetBand,
                examModule: examModule,
                examId: examId,
                targetDateSerial: targetDateSerial,
                onboardingCompleted: onboardingCompleted,
                freeDiagnosticUsed: freeDiagnosticUsed,
                themeMode: themeMode,
                linkedEmail: linkedEmail,
                appUserId: appUserId,
                isPro: isPro,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$UserProfilesTable, UserProfileRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $UserProfilesTable,
                    UserProfileRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$UserProfilesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $UserProfilesTable,
      UserProfileRow,
      $$UserProfilesTableFilterComposer,
      $$UserProfilesTableOrderingComposer,
      $$UserProfilesTableAnnotationComposer,
      $$UserProfilesTableCreateCompanionBuilder,
      $$UserProfilesTableUpdateCompanionBuilder,
      (
        UserProfileRow,
        BaseReferences<_$AppDatabase, $UserProfilesTable, UserProfileRow>,
      ),
      UserProfileRow,
      PrefetchHooks Function()
    >;
typedef $$ExamPacksTableCreateCompanionBuilder = ExamPacksCompanion Function({
  required DateTime createdAt,
  required DateTime updatedAt,
  required String packId,
  Value<String> track,
  required String skill,
  Value<String> title,
  Value<String> description,
  Value<int> durationSeconds,
  Value<int> questionCount,
  Value<String?> accent,
  Value<String?> mediaUrl,
  required String version,
  required String sha256,
  required String localPath,
  Value<int> rowid,
});
typedef $$ExamPacksTableUpdateCompanionBuilder = ExamPacksCompanion Function({
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<String> packId,
  Value<String> track,
  Value<String> skill,
  Value<String> title,
  Value<String> description,
  Value<int> durationSeconds,
  Value<int> questionCount,
  Value<String?> accent,
  Value<String?> mediaUrl,
  Value<String> version,
  Value<String> sha256,
  Value<String> localPath,
  Value<int> rowid,
});

class $$ExamPacksTableFilterComposer
    extends Composer<_$AppDatabase, $ExamPacksTable> {
  $$ExamPacksTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get track => $composableBuilder(
    column: $table.track,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get skill => $composableBuilder(
    column: $table.skill,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get durationSeconds => $composableBuilder(
    column: $table.durationSeconds,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get questionCount => $composableBuilder(
    column: $table.questionCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get accent => $composableBuilder(
    column: $table.accent,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get mediaUrl => $composableBuilder(
    column: $table.mediaUrl,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sha256 => $composableBuilder(
    column: $table.sha256,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localPath => $composableBuilder(
    column: $table.localPath,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ExamPacksTableOrderingComposer
    extends Composer<_$AppDatabase, $ExamPacksTable> {
  $$ExamPacksTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get track => $composableBuilder(
    column: $table.track,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get skill => $composableBuilder(
    column: $table.skill,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get durationSeconds => $composableBuilder(
    column: $table.durationSeconds,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get questionCount => $composableBuilder(
    column: $table.questionCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get accent => $composableBuilder(
    column: $table.accent,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get mediaUrl => $composableBuilder(
    column: $table.mediaUrl,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sha256 => $composableBuilder(
    column: $table.sha256,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localPath => $composableBuilder(
    column: $table.localPath,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ExamPacksTableAnnotationComposer
    extends Composer<_$AppDatabase, $ExamPacksTable> {
  $$ExamPacksTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get packId =>
      $composableBuilder(column: $table.packId, builder: (column) => column);

  GeneratedColumn<String> get track =>
      $composableBuilder(column: $table.track, builder: (column) => column);

  GeneratedColumn<String> get skill =>
      $composableBuilder(column: $table.skill, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get description => $composableBuilder(
    column: $table.description,
    builder: (column) => column,
  );

  GeneratedColumn<int> get durationSeconds => $composableBuilder(
    column: $table.durationSeconds,
    builder: (column) => column,
  );

  GeneratedColumn<int> get questionCount => $composableBuilder(
    column: $table.questionCount,
    builder: (column) => column,
  );

  GeneratedColumn<String> get accent =>
      $composableBuilder(column: $table.accent, builder: (column) => column);

  GeneratedColumn<String> get mediaUrl =>
      $composableBuilder(column: $table.mediaUrl, builder: (column) => column);

  GeneratedColumn<String> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<String> get sha256 =>
      $composableBuilder(column: $table.sha256, builder: (column) => column);

  GeneratedColumn<String> get localPath =>
      $composableBuilder(column: $table.localPath, builder: (column) => column);
}

class $$ExamPacksTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ExamPacksTable,
          ExamPackRow,
          $$ExamPacksTableFilterComposer,
          $$ExamPacksTableOrderingComposer,
          $$ExamPacksTableAnnotationComposer,
          $$ExamPacksTableCreateCompanionBuilder,
          $$ExamPacksTableUpdateCompanionBuilder,
          (
            ExamPackRow,
            BaseReferences<_$AppDatabase, $ExamPacksTable, ExamPackRow>,
          ),
          ExamPackRow,
          PrefetchHooks Function()
        > {
  $$ExamPacksTableTableManager(_$AppDatabase db, $ExamPacksTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ExamPacksTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ExamPacksTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ExamPacksTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<String> packId = const Value.absent(),
                Value<String> track = const Value.absent(),
                Value<String> skill = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> description = const Value.absent(),
                Value<int> durationSeconds = const Value.absent(),
                Value<int> questionCount = const Value.absent(),
                Value<String?> accent = const Value.absent(),
                Value<String?> mediaUrl = const Value.absent(),
                Value<String> version = const Value.absent(),
                Value<String> sha256 = const Value.absent(),
                Value<String> localPath = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExamPacksCompanion(
                createdAt: createdAt,
                updatedAt: updatedAt,
                packId: packId,
                track: track,
                skill: skill,
                title: title,
                description: description,
                durationSeconds: durationSeconds,
                questionCount: questionCount,
                accent: accent,
                mediaUrl: mediaUrl,
                version: version,
                sha256: sha256,
                localPath: localPath,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required DateTime createdAt,
                required DateTime updatedAt,
                required String packId,
                Value<String> track = const Value.absent(),
                required String skill,
                Value<String> title = const Value.absent(),
                Value<String> description = const Value.absent(),
                Value<int> durationSeconds = const Value.absent(),
                Value<int> questionCount = const Value.absent(),
                Value<String?> accent = const Value.absent(),
                Value<String?> mediaUrl = const Value.absent(),
                required String version,
                required String sha256,
                required String localPath,
                Value<int> rowid = const Value.absent(),
              }) => ExamPacksCompanion.insert(
                createdAt: createdAt,
                updatedAt: updatedAt,
                packId: packId,
                track: track,
                skill: skill,
                title: title,
                description: description,
                durationSeconds: durationSeconds,
                questionCount: questionCount,
                accent: accent,
                mediaUrl: mediaUrl,
                version: version,
                sha256: sha256,
                localPath: localPath,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$ExamPacksTable, ExamPackRow>(table),
                  BaseReferences<_$AppDatabase, $ExamPacksTable, ExamPackRow>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ExamPacksTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ExamPacksTable,
      ExamPackRow,
      $$ExamPacksTableFilterComposer,
      $$ExamPacksTableOrderingComposer,
      $$ExamPacksTableAnnotationComposer,
      $$ExamPacksTableCreateCompanionBuilder,
      $$ExamPacksTableUpdateCompanionBuilder,
      (
        ExamPackRow,
        BaseReferences<_$AppDatabase, $ExamPacksTable, ExamPackRow>,
      ),
      ExamPackRow,
      PrefetchHooks Function()
    >;
typedef $$ExamPayloadsTableCreateCompanionBuilder =
    ExamPayloadsCompanion Function({
      required DateTime createdAt,
      required DateTime updatedAt,
      required String packId,
      required String bundleJson,
      Value<int> sizeBytes,
      Value<int> rowid,
    });
typedef $$ExamPayloadsTableUpdateCompanionBuilder =
    ExamPayloadsCompanion Function({
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<String> packId,
      Value<String> bundleJson,
      Value<int> sizeBytes,
      Value<int> rowid,
    });

class $$ExamPayloadsTableFilterComposer
    extends Composer<_$AppDatabase, $ExamPayloadsTable> {
  $$ExamPayloadsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get bundleJson => $composableBuilder(
    column: $table.bundleJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sizeBytes => $composableBuilder(
    column: $table.sizeBytes,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ExamPayloadsTableOrderingComposer
    extends Composer<_$AppDatabase, $ExamPayloadsTable> {
  $$ExamPayloadsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get bundleJson => $composableBuilder(
    column: $table.bundleJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sizeBytes => $composableBuilder(
    column: $table.sizeBytes,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ExamPayloadsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ExamPayloadsTable> {
  $$ExamPayloadsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get packId =>
      $composableBuilder(column: $table.packId, builder: (column) => column);

  GeneratedColumn<String> get bundleJson => $composableBuilder(
    column: $table.bundleJson,
    builder: (column) => column,
  );

  GeneratedColumn<int> get sizeBytes =>
      $composableBuilder(column: $table.sizeBytes, builder: (column) => column);
}

class $$ExamPayloadsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ExamPayloadsTable,
          ExamPayloadRow,
          $$ExamPayloadsTableFilterComposer,
          $$ExamPayloadsTableOrderingComposer,
          $$ExamPayloadsTableAnnotationComposer,
          $$ExamPayloadsTableCreateCompanionBuilder,
          $$ExamPayloadsTableUpdateCompanionBuilder,
          (
            ExamPayloadRow,
            BaseReferences<_$AppDatabase, $ExamPayloadsTable, ExamPayloadRow>,
          ),
          ExamPayloadRow,
          PrefetchHooks Function()
        > {
  $$ExamPayloadsTableTableManager(_$AppDatabase db, $ExamPayloadsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ExamPayloadsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ExamPayloadsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ExamPayloadsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<String> packId = const Value.absent(),
                Value<String> bundleJson = const Value.absent(),
                Value<int> sizeBytes = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExamPayloadsCompanion(
                createdAt: createdAt,
                updatedAt: updatedAt,
                packId: packId,
                bundleJson: bundleJson,
                sizeBytes: sizeBytes,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required DateTime createdAt,
                required DateTime updatedAt,
                required String packId,
                required String bundleJson,
                Value<int> sizeBytes = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExamPayloadsCompanion.insert(
                createdAt: createdAt,
                updatedAt: updatedAt,
                packId: packId,
                bundleJson: bundleJson,
                sizeBytes: sizeBytes,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$ExamPayloadsTable, ExamPayloadRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $ExamPayloadsTable,
                    ExamPayloadRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ExamPayloadsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ExamPayloadsTable,
      ExamPayloadRow,
      $$ExamPayloadsTableFilterComposer,
      $$ExamPayloadsTableOrderingComposer,
      $$ExamPayloadsTableAnnotationComposer,
      $$ExamPayloadsTableCreateCompanionBuilder,
      $$ExamPayloadsTableUpdateCompanionBuilder,
      (
        ExamPayloadRow,
        BaseReferences<_$AppDatabase, $ExamPayloadsTable, ExamPayloadRow>,
      ),
      ExamPayloadRow,
      PrefetchHooks Function()
    >;
typedef $$CachedDrillsTableCreateCompanionBuilder =
    CachedDrillsCompanion Function({
      required DateTime createdAt,
      required DateTime updatedAt,
      required String drillId,
      required String title,
      required String drillType,
      Value<String> skill,
      Value<int> durationSeconds,
      required String itemsJson,
      Value<int> rowid,
    });
typedef $$CachedDrillsTableUpdateCompanionBuilder =
    CachedDrillsCompanion Function({
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<String> drillId,
      Value<String> title,
      Value<String> drillType,
      Value<String> skill,
      Value<int> durationSeconds,
      Value<String> itemsJson,
      Value<int> rowid,
    });

class $$CachedDrillsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedDrillsTable> {
  $$CachedDrillsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get drillId => $composableBuilder(
    column: $table.drillId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get drillType => $composableBuilder(
    column: $table.drillType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get skill => $composableBuilder(
    column: $table.skill,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get durationSeconds => $composableBuilder(
    column: $table.durationSeconds,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get itemsJson => $composableBuilder(
    column: $table.itemsJson,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CachedDrillsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedDrillsTable> {
  $$CachedDrillsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get drillId => $composableBuilder(
    column: $table.drillId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get drillType => $composableBuilder(
    column: $table.drillType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get skill => $composableBuilder(
    column: $table.skill,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get durationSeconds => $composableBuilder(
    column: $table.durationSeconds,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get itemsJson => $composableBuilder(
    column: $table.itemsJson,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CachedDrillsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedDrillsTable> {
  $$CachedDrillsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get drillId =>
      $composableBuilder(column: $table.drillId, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get drillType =>
      $composableBuilder(column: $table.drillType, builder: (column) => column);

  GeneratedColumn<String> get skill =>
      $composableBuilder(column: $table.skill, builder: (column) => column);

  GeneratedColumn<int> get durationSeconds => $composableBuilder(
    column: $table.durationSeconds,
    builder: (column) => column,
  );

  GeneratedColumn<String> get itemsJson =>
      $composableBuilder(column: $table.itemsJson, builder: (column) => column);
}

class $$CachedDrillsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CachedDrillsTable,
          CachedDrillRow,
          $$CachedDrillsTableFilterComposer,
          $$CachedDrillsTableOrderingComposer,
          $$CachedDrillsTableAnnotationComposer,
          $$CachedDrillsTableCreateCompanionBuilder,
          $$CachedDrillsTableUpdateCompanionBuilder,
          (
            CachedDrillRow,
            BaseReferences<_$AppDatabase, $CachedDrillsTable, CachedDrillRow>,
          ),
          CachedDrillRow,
          PrefetchHooks Function()
        > {
  $$CachedDrillsTableTableManager(_$AppDatabase db, $CachedDrillsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedDrillsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedDrillsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedDrillsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<String> drillId = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String> drillType = const Value.absent(),
                Value<String> skill = const Value.absent(),
                Value<int> durationSeconds = const Value.absent(),
                Value<String> itemsJson = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CachedDrillsCompanion(
                createdAt: createdAt,
                updatedAt: updatedAt,
                drillId: drillId,
                title: title,
                drillType: drillType,
                skill: skill,
                durationSeconds: durationSeconds,
                itemsJson: itemsJson,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required DateTime createdAt,
                required DateTime updatedAt,
                required String drillId,
                required String title,
                required String drillType,
                Value<String> skill = const Value.absent(),
                Value<int> durationSeconds = const Value.absent(),
                required String itemsJson,
                Value<int> rowid = const Value.absent(),
              }) => CachedDrillsCompanion.insert(
                createdAt: createdAt,
                updatedAt: updatedAt,
                drillId: drillId,
                title: title,
                drillType: drillType,
                skill: skill,
                durationSeconds: durationSeconds,
                itemsJson: itemsJson,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CachedDrillsTable, CachedDrillRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CachedDrillsTable,
                    CachedDrillRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CachedDrillsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CachedDrillsTable,
      CachedDrillRow,
      $$CachedDrillsTableFilterComposer,
      $$CachedDrillsTableOrderingComposer,
      $$CachedDrillsTableAnnotationComposer,
      $$CachedDrillsTableCreateCompanionBuilder,
      $$CachedDrillsTableUpdateCompanionBuilder,
      (
        CachedDrillRow,
        BaseReferences<_$AppDatabase, $CachedDrillsTable, CachedDrillRow>,
      ),
      CachedDrillRow,
      PrefetchHooks Function()
    >;
typedef $$ExamAttemptsTableCreateCompanionBuilder =
    ExamAttemptsCompanion Function({
      required DateTime createdAt,
      required DateTime updatedAt,
      required String attemptId,
      Value<String> examId,
      required String packId,
      required String skill,
      required String status,
      Value<String?> remoteJobId,
      required String submissionJson,
      Value<String?> evaluationJson,
      Value<double?> overallBand,
      Value<String?> errorCode,
      Value<int?> startedAtUtcMs,
      Value<int?> completedAtUtcMs,
      Value<int> durationSeconds,
      Value<bool> usedStudyMode,
      Value<int> rowid,
    });
typedef $$ExamAttemptsTableUpdateCompanionBuilder =
    ExamAttemptsCompanion Function({
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<String> attemptId,
      Value<String> examId,
      Value<String> packId,
      Value<String> skill,
      Value<String> status,
      Value<String?> remoteJobId,
      Value<String> submissionJson,
      Value<String?> evaluationJson,
      Value<double?> overallBand,
      Value<String?> errorCode,
      Value<int?> startedAtUtcMs,
      Value<int?> completedAtUtcMs,
      Value<int> durationSeconds,
      Value<bool> usedStudyMode,
      Value<int> rowid,
    });

final class $$ExamAttemptsTableReferences
    extends BaseReferences<_$AppDatabase, $ExamAttemptsTable, ExamAttemptRow> {
  $$ExamAttemptsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$AudioRecordingsTable, List<AudioRecordingRow>>
  _audioRecordingsRefsTable(_$AppDatabase db) => MultiTypedResultKey.fromTable(
    db.audioRecordings,
    aliasName: 'exam_attempts__attempt_id__audio_recordings__attempt_id',
  );

  $$AudioRecordingsTableProcessedTableManager get audioRecordingsRefs {
    final manager =
        $$AudioRecordingsTableTableManager($_db, $_db.audioRecordings).filter(
          (f) => f.attemptId.attemptId.sqlEquals(
            $_itemColumn<String>('attempt_id')!,
          ),
        );

    final cache = $_typedResult.readTableOrNull(
      _audioRecordingsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }

  static MultiTypedResultKey<$WritingDraftsTable, List<WritingDraftRow>>
  _writingDraftsRefsTable(_$AppDatabase db) => MultiTypedResultKey.fromTable(
    db.writingDrafts,
    aliasName: 'exam_attempts__attempt_id__writing_drafts__attempt_id',
  );

  $$WritingDraftsTableProcessedTableManager get writingDraftsRefs {
    final manager = $$WritingDraftsTableTableManager($_db, $_db.writingDrafts)
        .filter(
          (f) => f.attemptId.attemptId.sqlEquals(
            $_itemColumn<String>('attempt_id')!,
          ),
        );

    final cache = $_typedResult.readTableOrNull(_writingDraftsRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$ExamAttemptsTableFilterComposer
    extends Composer<_$AppDatabase, $ExamAttemptsTable> {
  $$ExamAttemptsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get attemptId => $composableBuilder(
    column: $table.attemptId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get examId => $composableBuilder(
    column: $table.examId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get skill => $composableBuilder(
    column: $table.skill,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get remoteJobId => $composableBuilder(
    column: $table.remoteJobId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get submissionJson => $composableBuilder(
    column: $table.submissionJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get evaluationJson => $composableBuilder(
    column: $table.evaluationJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get overallBand => $composableBuilder(
    column: $table.overallBand,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get errorCode => $composableBuilder(
    column: $table.errorCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get startedAtUtcMs => $composableBuilder(
    column: $table.startedAtUtcMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get completedAtUtcMs => $composableBuilder(
    column: $table.completedAtUtcMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get durationSeconds => $composableBuilder(
    column: $table.durationSeconds,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get usedStudyMode => $composableBuilder(
    column: $table.usedStudyMode,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> audioRecordingsRefs(
    Expression<bool> Function($$AudioRecordingsTableFilterComposer f) f,
  ) {
    final $$AudioRecordingsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.attemptId,
      referencedTable: $db.audioRecordings,
      getReferencedColumn: (t) => t.attemptId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$AudioRecordingsTableFilterComposer(
            $db: $db,
            $table: $db.audioRecordings,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<bool> writingDraftsRefs(
    Expression<bool> Function($$WritingDraftsTableFilterComposer f) f,
  ) {
    final $$WritingDraftsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.attemptId,
      referencedTable: $db.writingDrafts,
      getReferencedColumn: (t) => t.attemptId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$WritingDraftsTableFilterComposer(
            $db: $db,
            $table: $db.writingDrafts,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$ExamAttemptsTableOrderingComposer
    extends Composer<_$AppDatabase, $ExamAttemptsTable> {
  $$ExamAttemptsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get attemptId => $composableBuilder(
    column: $table.attemptId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get examId => $composableBuilder(
    column: $table.examId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get skill => $composableBuilder(
    column: $table.skill,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get remoteJobId => $composableBuilder(
    column: $table.remoteJobId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get submissionJson => $composableBuilder(
    column: $table.submissionJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get evaluationJson => $composableBuilder(
    column: $table.evaluationJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get overallBand => $composableBuilder(
    column: $table.overallBand,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get errorCode => $composableBuilder(
    column: $table.errorCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get startedAtUtcMs => $composableBuilder(
    column: $table.startedAtUtcMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get completedAtUtcMs => $composableBuilder(
    column: $table.completedAtUtcMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get durationSeconds => $composableBuilder(
    column: $table.durationSeconds,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get usedStudyMode => $composableBuilder(
    column: $table.usedStudyMode,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ExamAttemptsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ExamAttemptsTable> {
  $$ExamAttemptsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get attemptId =>
      $composableBuilder(column: $table.attemptId, builder: (column) => column);

  GeneratedColumn<String> get examId =>
      $composableBuilder(column: $table.examId, builder: (column) => column);

  GeneratedColumn<String> get packId =>
      $composableBuilder(column: $table.packId, builder: (column) => column);

  GeneratedColumn<String> get skill =>
      $composableBuilder(column: $table.skill, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get remoteJobId => $composableBuilder(
    column: $table.remoteJobId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get submissionJson => $composableBuilder(
    column: $table.submissionJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get evaluationJson => $composableBuilder(
    column: $table.evaluationJson,
    builder: (column) => column,
  );

  GeneratedColumn<double> get overallBand => $composableBuilder(
    column: $table.overallBand,
    builder: (column) => column,
  );

  GeneratedColumn<String> get errorCode =>
      $composableBuilder(column: $table.errorCode, builder: (column) => column);

  GeneratedColumn<int> get startedAtUtcMs => $composableBuilder(
    column: $table.startedAtUtcMs,
    builder: (column) => column,
  );

  GeneratedColumn<int> get completedAtUtcMs => $composableBuilder(
    column: $table.completedAtUtcMs,
    builder: (column) => column,
  );

  GeneratedColumn<int> get durationSeconds => $composableBuilder(
    column: $table.durationSeconds,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get usedStudyMode => $composableBuilder(
    column: $table.usedStudyMode,
    builder: (column) => column,
  );

  Expression<T> audioRecordingsRefs<T extends Object>(
    Expression<T> Function($$AudioRecordingsTableAnnotationComposer a) f,
  ) {
    final $$AudioRecordingsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.attemptId,
      referencedTable: $db.audioRecordings,
      getReferencedColumn: (t) => t.attemptId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$AudioRecordingsTableAnnotationComposer(
            $db: $db,
            $table: $db.audioRecordings,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }

  Expression<T> writingDraftsRefs<T extends Object>(
    Expression<T> Function($$WritingDraftsTableAnnotationComposer a) f,
  ) {
    final $$WritingDraftsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.attemptId,
      referencedTable: $db.writingDrafts,
      getReferencedColumn: (t) => t.attemptId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$WritingDraftsTableAnnotationComposer(
            $db: $db,
            $table: $db.writingDrafts,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$ExamAttemptsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ExamAttemptsTable,
          ExamAttemptRow,
          $$ExamAttemptsTableFilterComposer,
          $$ExamAttemptsTableOrderingComposer,
          $$ExamAttemptsTableAnnotationComposer,
          $$ExamAttemptsTableCreateCompanionBuilder,
          $$ExamAttemptsTableUpdateCompanionBuilder,
          (ExamAttemptRow, $$ExamAttemptsTableReferences),
          ExamAttemptRow,
          PrefetchHooks Function({
            bool audioRecordingsRefs,
            bool writingDraftsRefs,
          })
        > {
  $$ExamAttemptsTableTableManager(_$AppDatabase db, $ExamAttemptsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ExamAttemptsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ExamAttemptsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ExamAttemptsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<String> attemptId = const Value.absent(),
                Value<String> examId = const Value.absent(),
                Value<String> packId = const Value.absent(),
                Value<String> skill = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<String?> remoteJobId = const Value.absent(),
                Value<String> submissionJson = const Value.absent(),
                Value<String?> evaluationJson = const Value.absent(),
                Value<double?> overallBand = const Value.absent(),
                Value<String?> errorCode = const Value.absent(),
                Value<int?> startedAtUtcMs = const Value.absent(),
                Value<int?> completedAtUtcMs = const Value.absent(),
                Value<int> durationSeconds = const Value.absent(),
                Value<bool> usedStudyMode = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExamAttemptsCompanion(
                createdAt: createdAt,
                updatedAt: updatedAt,
                attemptId: attemptId,
                examId: examId,
                packId: packId,
                skill: skill,
                status: status,
                remoteJobId: remoteJobId,
                submissionJson: submissionJson,
                evaluationJson: evaluationJson,
                overallBand: overallBand,
                errorCode: errorCode,
                startedAtUtcMs: startedAtUtcMs,
                completedAtUtcMs: completedAtUtcMs,
                durationSeconds: durationSeconds,
                usedStudyMode: usedStudyMode,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required DateTime createdAt,
                required DateTime updatedAt,
                required String attemptId,
                Value<String> examId = const Value.absent(),
                required String packId,
                required String skill,
                required String status,
                Value<String?> remoteJobId = const Value.absent(),
                required String submissionJson,
                Value<String?> evaluationJson = const Value.absent(),
                Value<double?> overallBand = const Value.absent(),
                Value<String?> errorCode = const Value.absent(),
                Value<int?> startedAtUtcMs = const Value.absent(),
                Value<int?> completedAtUtcMs = const Value.absent(),
                Value<int> durationSeconds = const Value.absent(),
                Value<bool> usedStudyMode = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ExamAttemptsCompanion.insert(
                createdAt: createdAt,
                updatedAt: updatedAt,
                attemptId: attemptId,
                examId: examId,
                packId: packId,
                skill: skill,
                status: status,
                remoteJobId: remoteJobId,
                submissionJson: submissionJson,
                evaluationJson: evaluationJson,
                overallBand: overallBand,
                errorCode: errorCode,
                startedAtUtcMs: startedAtUtcMs,
                completedAtUtcMs: completedAtUtcMs,
                durationSeconds: durationSeconds,
                usedStudyMode: usedStudyMode,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$ExamAttemptsTable, ExamAttemptRow>(table),
                  $$ExamAttemptsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({audioRecordingsRefs = false, writingDraftsRefs = false}) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [
                    if (audioRecordingsRefs) db.audioRecordings,
                    if (writingDraftsRefs) db.writingDrafts,
                  ],
                  addJoins: null,
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (audioRecordingsRefs)
                        await $_getPrefetchedDataByColumns<
                          ExamAttemptRow,
                          $ExamAttemptsTable,
                          AudioRecordingRow,
                          $AudioRecordingsTable
                        >(
                          currentTable: table,
                          referencedTable: $$ExamAttemptsTableReferences
                              ._audioRecordingsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$ExamAttemptsTableReferences(
                                db,
                                table,
                                p0,
                              ).audioRecordingsRefs,
                          currentColumn: 'attempt_id',
                          referencedColumn: 'attempt_id',
                          typedResults: items,
                        ),
                      if (writingDraftsRefs)
                        await $_getPrefetchedDataByColumns<
                          ExamAttemptRow,
                          $ExamAttemptsTable,
                          WritingDraftRow,
                          $WritingDraftsTable
                        >(
                          currentTable: table,
                          referencedTable: $$ExamAttemptsTableReferences
                              ._writingDraftsRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$ExamAttemptsTableReferences(
                                db,
                                table,
                                p0,
                              ).writingDraftsRefs,
                          currentColumn: 'attempt_id',
                          referencedColumn: 'attempt_id',
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$ExamAttemptsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ExamAttemptsTable,
      ExamAttemptRow,
      $$ExamAttemptsTableFilterComposer,
      $$ExamAttemptsTableOrderingComposer,
      $$ExamAttemptsTableAnnotationComposer,
      $$ExamAttemptsTableCreateCompanionBuilder,
      $$ExamAttemptsTableUpdateCompanionBuilder,
      (ExamAttemptRow, $$ExamAttemptsTableReferences),
      ExamAttemptRow,
      PrefetchHooks Function({bool audioRecordingsRefs, bool writingDraftsRefs})
    >;
typedef $$AudioRecordingsTableCreateCompanionBuilder =
    AudioRecordingsCompanion Function({
      required DateTime createdAt,
      required DateTime updatedAt,
      required String recordingId,
      required String attemptId,
      required int partIndex,
      required String localFilePath,
      required int durationMs,
      Value<String?> remoteObjectKey,
      Value<int> rowid,
    });
typedef $$AudioRecordingsTableUpdateCompanionBuilder =
    AudioRecordingsCompanion Function({
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<String> recordingId,
      Value<String> attemptId,
      Value<int> partIndex,
      Value<String> localFilePath,
      Value<int> durationMs,
      Value<String?> remoteObjectKey,
      Value<int> rowid,
    });

final class $$AudioRecordingsTableReferences
    extends
        BaseReferences<
          _$AppDatabase,
          $AudioRecordingsTable,
          AudioRecordingRow
        > {
  $$AudioRecordingsTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $ExamAttemptsTable _attemptIdTable(_$AppDatabase db) => db.examAttempts
      .createAlias('audio_recordings__attempt_id__exam_attempts__attempt_id');

  $$ExamAttemptsTableProcessedTableManager get attemptId {
    final $_column = $_itemColumn<String>('attempt_id')!;

    final manager = $$ExamAttemptsTableTableManager(
      $_db,
      $_db.examAttempts,
    ).filter((f) => f.attemptId.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_attemptIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$AudioRecordingsTableFilterComposer
    extends Composer<_$AppDatabase, $AudioRecordingsTable> {
  $$AudioRecordingsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get recordingId => $composableBuilder(
    column: $table.recordingId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get partIndex => $composableBuilder(
    column: $table.partIndex,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localFilePath => $composableBuilder(
    column: $table.localFilePath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get durationMs => $composableBuilder(
    column: $table.durationMs,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get remoteObjectKey => $composableBuilder(
    column: $table.remoteObjectKey,
    builder: (column) => ColumnFilters(column),
  );

  $$ExamAttemptsTableFilterComposer get attemptId {
    final $$ExamAttemptsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.attemptId,
      referencedTable: $db.examAttempts,
      getReferencedColumn: (t) => t.attemptId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ExamAttemptsTableFilterComposer(
            $db: $db,
            $table: $db.examAttempts,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$AudioRecordingsTableOrderingComposer
    extends Composer<_$AppDatabase, $AudioRecordingsTable> {
  $$AudioRecordingsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get recordingId => $composableBuilder(
    column: $table.recordingId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get partIndex => $composableBuilder(
    column: $table.partIndex,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localFilePath => $composableBuilder(
    column: $table.localFilePath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get durationMs => $composableBuilder(
    column: $table.durationMs,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get remoteObjectKey => $composableBuilder(
    column: $table.remoteObjectKey,
    builder: (column) => ColumnOrderings(column),
  );

  $$ExamAttemptsTableOrderingComposer get attemptId {
    final $$ExamAttemptsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.attemptId,
      referencedTable: $db.examAttempts,
      getReferencedColumn: (t) => t.attemptId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ExamAttemptsTableOrderingComposer(
            $db: $db,
            $table: $db.examAttempts,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$AudioRecordingsTableAnnotationComposer
    extends Composer<_$AppDatabase, $AudioRecordingsTable> {
  $$AudioRecordingsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get recordingId => $composableBuilder(
    column: $table.recordingId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get partIndex =>
      $composableBuilder(column: $table.partIndex, builder: (column) => column);

  GeneratedColumn<String> get localFilePath => $composableBuilder(
    column: $table.localFilePath,
    builder: (column) => column,
  );

  GeneratedColumn<int> get durationMs => $composableBuilder(
    column: $table.durationMs,
    builder: (column) => column,
  );

  GeneratedColumn<String> get remoteObjectKey => $composableBuilder(
    column: $table.remoteObjectKey,
    builder: (column) => column,
  );

  $$ExamAttemptsTableAnnotationComposer get attemptId {
    final $$ExamAttemptsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.attemptId,
      referencedTable: $db.examAttempts,
      getReferencedColumn: (t) => t.attemptId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ExamAttemptsTableAnnotationComposer(
            $db: $db,
            $table: $db.examAttempts,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$AudioRecordingsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $AudioRecordingsTable,
          AudioRecordingRow,
          $$AudioRecordingsTableFilterComposer,
          $$AudioRecordingsTableOrderingComposer,
          $$AudioRecordingsTableAnnotationComposer,
          $$AudioRecordingsTableCreateCompanionBuilder,
          $$AudioRecordingsTableUpdateCompanionBuilder,
          (AudioRecordingRow, $$AudioRecordingsTableReferences),
          AudioRecordingRow,
          PrefetchHooks Function({bool attemptId})
        > {
  $$AudioRecordingsTableTableManager(
    _$AppDatabase db,
    $AudioRecordingsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$AudioRecordingsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$AudioRecordingsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$AudioRecordingsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<String> recordingId = const Value.absent(),
                Value<String> attemptId = const Value.absent(),
                Value<int> partIndex = const Value.absent(),
                Value<String> localFilePath = const Value.absent(),
                Value<int> durationMs = const Value.absent(),
                Value<String?> remoteObjectKey = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => AudioRecordingsCompanion(
                createdAt: createdAt,
                updatedAt: updatedAt,
                recordingId: recordingId,
                attemptId: attemptId,
                partIndex: partIndex,
                localFilePath: localFilePath,
                durationMs: durationMs,
                remoteObjectKey: remoteObjectKey,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required DateTime createdAt,
                required DateTime updatedAt,
                required String recordingId,
                required String attemptId,
                required int partIndex,
                required String localFilePath,
                required int durationMs,
                Value<String?> remoteObjectKey = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => AudioRecordingsCompanion.insert(
                createdAt: createdAt,
                updatedAt: updatedAt,
                recordingId: recordingId,
                attemptId: attemptId,
                partIndex: partIndex,
                localFilePath: localFilePath,
                durationMs: durationMs,
                remoteObjectKey: remoteObjectKey,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$AudioRecordingsTable, AudioRecordingRow>(table),
                  $$AudioRecordingsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({attemptId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (attemptId) {
                      state = state.withJoin(
                        currentTable: table,
                        currentColumn: table.attemptId,
                        referencedTable: $$AudioRecordingsTableReferences
                            ._attemptIdTable(db),
                        referencedColumn: $$AudioRecordingsTableReferences
                            ._attemptIdTable(db)
                            .attemptId,
                      ) as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$AudioRecordingsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $AudioRecordingsTable,
      AudioRecordingRow,
      $$AudioRecordingsTableFilterComposer,
      $$AudioRecordingsTableOrderingComposer,
      $$AudioRecordingsTableAnnotationComposer,
      $$AudioRecordingsTableCreateCompanionBuilder,
      $$AudioRecordingsTableUpdateCompanionBuilder,
      (AudioRecordingRow, $$AudioRecordingsTableReferences),
      AudioRecordingRow,
      PrefetchHooks Function({bool attemptId})
    >;
typedef $$WritingDraftsTableCreateCompanionBuilder =
    WritingDraftsCompanion Function({
      required String attemptId,
      required String packId,
      required String taskType,
      required String draftText,
      Value<int> wordCount,
      Value<int> timerRemainingSec,
      required int updatedAtUtcMs,
      Value<int> rowid,
    });
typedef $$WritingDraftsTableUpdateCompanionBuilder =
    WritingDraftsCompanion Function({
      Value<String> attemptId,
      Value<String> packId,
      Value<String> taskType,
      Value<String> draftText,
      Value<int> wordCount,
      Value<int> timerRemainingSec,
      Value<int> updatedAtUtcMs,
      Value<int> rowid,
    });

final class $$WritingDraftsTableReferences
    extends
        BaseReferences<_$AppDatabase, $WritingDraftsTable, WritingDraftRow> {
  $$WritingDraftsTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $ExamAttemptsTable _attemptIdTable(_$AppDatabase db) => db.examAttempts
      .createAlias('writing_drafts__attempt_id__exam_attempts__attempt_id');

  $$ExamAttemptsTableProcessedTableManager get attemptId {
    final $_column = $_itemColumn<String>('attempt_id')!;

    final manager = $$ExamAttemptsTableTableManager(
      $_db,
      $_db.examAttempts,
    ).filter((f) => f.attemptId.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_attemptIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$WritingDraftsTableFilterComposer
    extends Composer<_$AppDatabase, $WritingDraftsTable> {
  $$WritingDraftsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get taskType => $composableBuilder(
    column: $table.taskType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get draftText => $composableBuilder(
    column: $table.draftText,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get wordCount => $composableBuilder(
    column: $table.wordCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get timerRemainingSec => $composableBuilder(
    column: $table.timerRemainingSec,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get updatedAtUtcMs => $composableBuilder(
    column: $table.updatedAtUtcMs,
    builder: (column) => ColumnFilters(column),
  );

  $$ExamAttemptsTableFilterComposer get attemptId {
    final $$ExamAttemptsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.attemptId,
      referencedTable: $db.examAttempts,
      getReferencedColumn: (t) => t.attemptId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ExamAttemptsTableFilterComposer(
            $db: $db,
            $table: $db.examAttempts,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$WritingDraftsTableOrderingComposer
    extends Composer<_$AppDatabase, $WritingDraftsTable> {
  $$WritingDraftsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get taskType => $composableBuilder(
    column: $table.taskType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get draftText => $composableBuilder(
    column: $table.draftText,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get wordCount => $composableBuilder(
    column: $table.wordCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get timerRemainingSec => $composableBuilder(
    column: $table.timerRemainingSec,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get updatedAtUtcMs => $composableBuilder(
    column: $table.updatedAtUtcMs,
    builder: (column) => ColumnOrderings(column),
  );

  $$ExamAttemptsTableOrderingComposer get attemptId {
    final $$ExamAttemptsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.attemptId,
      referencedTable: $db.examAttempts,
      getReferencedColumn: (t) => t.attemptId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ExamAttemptsTableOrderingComposer(
            $db: $db,
            $table: $db.examAttempts,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$WritingDraftsTableAnnotationComposer
    extends Composer<_$AppDatabase, $WritingDraftsTable> {
  $$WritingDraftsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get packId =>
      $composableBuilder(column: $table.packId, builder: (column) => column);

  GeneratedColumn<String> get taskType =>
      $composableBuilder(column: $table.taskType, builder: (column) => column);

  GeneratedColumn<String> get draftText =>
      $composableBuilder(column: $table.draftText, builder: (column) => column);

  GeneratedColumn<int> get wordCount =>
      $composableBuilder(column: $table.wordCount, builder: (column) => column);

  GeneratedColumn<int> get timerRemainingSec => $composableBuilder(
    column: $table.timerRemainingSec,
    builder: (column) => column,
  );

  GeneratedColumn<int> get updatedAtUtcMs => $composableBuilder(
    column: $table.updatedAtUtcMs,
    builder: (column) => column,
  );

  $$ExamAttemptsTableAnnotationComposer get attemptId {
    final $$ExamAttemptsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.attemptId,
      referencedTable: $db.examAttempts,
      getReferencedColumn: (t) => t.attemptId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$ExamAttemptsTableAnnotationComposer(
            $db: $db,
            $table: $db.examAttempts,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$WritingDraftsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $WritingDraftsTable,
          WritingDraftRow,
          $$WritingDraftsTableFilterComposer,
          $$WritingDraftsTableOrderingComposer,
          $$WritingDraftsTableAnnotationComposer,
          $$WritingDraftsTableCreateCompanionBuilder,
          $$WritingDraftsTableUpdateCompanionBuilder,
          (WritingDraftRow, $$WritingDraftsTableReferences),
          WritingDraftRow,
          PrefetchHooks Function({bool attemptId})
        > {
  $$WritingDraftsTableTableManager(_$AppDatabase db, $WritingDraftsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$WritingDraftsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$WritingDraftsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$WritingDraftsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> attemptId = const Value.absent(),
                Value<String> packId = const Value.absent(),
                Value<String> taskType = const Value.absent(),
                Value<String> draftText = const Value.absent(),
                Value<int> wordCount = const Value.absent(),
                Value<int> timerRemainingSec = const Value.absent(),
                Value<int> updatedAtUtcMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => WritingDraftsCompanion(
                attemptId: attemptId,
                packId: packId,
                taskType: taskType,
                draftText: draftText,
                wordCount: wordCount,
                timerRemainingSec: timerRemainingSec,
                updatedAtUtcMs: updatedAtUtcMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String attemptId,
                required String packId,
                required String taskType,
                required String draftText,
                Value<int> wordCount = const Value.absent(),
                Value<int> timerRemainingSec = const Value.absent(),
                required int updatedAtUtcMs,
                Value<int> rowid = const Value.absent(),
              }) => WritingDraftsCompanion.insert(
                attemptId: attemptId,
                packId: packId,
                taskType: taskType,
                draftText: draftText,
                wordCount: wordCount,
                timerRemainingSec: timerRemainingSec,
                updatedAtUtcMs: updatedAtUtcMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$WritingDraftsTable, WritingDraftRow>(table),
                  $$WritingDraftsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({attemptId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (attemptId) {
                      state = state.withJoin(
                        currentTable: table,
                        currentColumn: table.attemptId,
                        referencedTable: $$WritingDraftsTableReferences
                            ._attemptIdTable(db),
                        referencedColumn: $$WritingDraftsTableReferences
                            ._attemptIdTable(db)
                            .attemptId,
                      ) as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$WritingDraftsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $WritingDraftsTable,
      WritingDraftRow,
      $$WritingDraftsTableFilterComposer,
      $$WritingDraftsTableOrderingComposer,
      $$WritingDraftsTableAnnotationComposer,
      $$WritingDraftsTableCreateCompanionBuilder,
      $$WritingDraftsTableUpdateCompanionBuilder,
      (WritingDraftRow, $$WritingDraftsTableReferences),
      WritingDraftRow,
      PrefetchHooks Function({bool attemptId})
    >;
typedef $$ReadingAnnotationsTableCreateCompanionBuilder =
    ReadingAnnotationsCompanion Function({
      required DateTime createdAt,
      required DateTime updatedAt,
      required String annotationId,
      required String packId,
      Value<int> passageIndex,
      required int startOffset,
      required int endOffset,
      Value<String> colorCode,
      Value<String?> noteText,
      Value<bool> isDeleted,
      Value<int> rowid,
    });
typedef $$ReadingAnnotationsTableUpdateCompanionBuilder =
    ReadingAnnotationsCompanion Function({
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<String> annotationId,
      Value<String> packId,
      Value<int> passageIndex,
      Value<int> startOffset,
      Value<int> endOffset,
      Value<String> colorCode,
      Value<String?> noteText,
      Value<bool> isDeleted,
      Value<int> rowid,
    });

class $$ReadingAnnotationsTableFilterComposer
    extends Composer<_$AppDatabase, $ReadingAnnotationsTable> {
  $$ReadingAnnotationsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get annotationId => $composableBuilder(
    column: $table.annotationId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get passageIndex => $composableBuilder(
    column: $table.passageIndex,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get startOffset => $composableBuilder(
    column: $table.startOffset,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get endOffset => $composableBuilder(
    column: $table.endOffset,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get colorCode => $composableBuilder(
    column: $table.colorCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get noteText => $composableBuilder(
    column: $table.noteText,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get isDeleted => $composableBuilder(
    column: $table.isDeleted,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ReadingAnnotationsTableOrderingComposer
    extends Composer<_$AppDatabase, $ReadingAnnotationsTable> {
  $$ReadingAnnotationsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get annotationId => $composableBuilder(
    column: $table.annotationId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get packId => $composableBuilder(
    column: $table.packId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get passageIndex => $composableBuilder(
    column: $table.passageIndex,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get startOffset => $composableBuilder(
    column: $table.startOffset,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get endOffset => $composableBuilder(
    column: $table.endOffset,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get colorCode => $composableBuilder(
    column: $table.colorCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get noteText => $composableBuilder(
    column: $table.noteText,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get isDeleted => $composableBuilder(
    column: $table.isDeleted,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ReadingAnnotationsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ReadingAnnotationsTable> {
  $$ReadingAnnotationsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get annotationId => $composableBuilder(
    column: $table.annotationId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get packId =>
      $composableBuilder(column: $table.packId, builder: (column) => column);

  GeneratedColumn<int> get passageIndex => $composableBuilder(
    column: $table.passageIndex,
    builder: (column) => column,
  );

  GeneratedColumn<int> get startOffset => $composableBuilder(
    column: $table.startOffset,
    builder: (column) => column,
  );

  GeneratedColumn<int> get endOffset =>
      $composableBuilder(column: $table.endOffset, builder: (column) => column);

  GeneratedColumn<String> get colorCode =>
      $composableBuilder(column: $table.colorCode, builder: (column) => column);

  GeneratedColumn<String> get noteText =>
      $composableBuilder(column: $table.noteText, builder: (column) => column);

  GeneratedColumn<bool> get isDeleted =>
      $composableBuilder(column: $table.isDeleted, builder: (column) => column);
}

class $$ReadingAnnotationsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $ReadingAnnotationsTable,
          ReadingAnnotationRow,
          $$ReadingAnnotationsTableFilterComposer,
          $$ReadingAnnotationsTableOrderingComposer,
          $$ReadingAnnotationsTableAnnotationComposer,
          $$ReadingAnnotationsTableCreateCompanionBuilder,
          $$ReadingAnnotationsTableUpdateCompanionBuilder,
          (
            ReadingAnnotationRow,
            BaseReferences<
              _$AppDatabase,
              $ReadingAnnotationsTable,
              ReadingAnnotationRow
            >,
          ),
          ReadingAnnotationRow,
          PrefetchHooks Function()
        > {
  $$ReadingAnnotationsTableTableManager(
    _$AppDatabase db,
    $ReadingAnnotationsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ReadingAnnotationsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ReadingAnnotationsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ReadingAnnotationsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<String> annotationId = const Value.absent(),
                Value<String> packId = const Value.absent(),
                Value<int> passageIndex = const Value.absent(),
                Value<int> startOffset = const Value.absent(),
                Value<int> endOffset = const Value.absent(),
                Value<String> colorCode = const Value.absent(),
                Value<String?> noteText = const Value.absent(),
                Value<bool> isDeleted = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ReadingAnnotationsCompanion(
                createdAt: createdAt,
                updatedAt: updatedAt,
                annotationId: annotationId,
                packId: packId,
                passageIndex: passageIndex,
                startOffset: startOffset,
                endOffset: endOffset,
                colorCode: colorCode,
                noteText: noteText,
                isDeleted: isDeleted,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required DateTime createdAt,
                required DateTime updatedAt,
                required String annotationId,
                required String packId,
                Value<int> passageIndex = const Value.absent(),
                required int startOffset,
                required int endOffset,
                Value<String> colorCode = const Value.absent(),
                Value<String?> noteText = const Value.absent(),
                Value<bool> isDeleted = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ReadingAnnotationsCompanion.insert(
                createdAt: createdAt,
                updatedAt: updatedAt,
                annotationId: annotationId,
                packId: packId,
                passageIndex: passageIndex,
                startOffset: startOffset,
                endOffset: endOffset,
                colorCode: colorCode,
                noteText: noteText,
                isDeleted: isDeleted,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$ReadingAnnotationsTable, ReadingAnnotationRow>(
                    table,
                  ),
                  BaseReferences<
                    _$AppDatabase,
                    $ReadingAnnotationsTable,
                    ReadingAnnotationRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ReadingAnnotationsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $ReadingAnnotationsTable,
      ReadingAnnotationRow,
      $$ReadingAnnotationsTableFilterComposer,
      $$ReadingAnnotationsTableOrderingComposer,
      $$ReadingAnnotationsTableAnnotationComposer,
      $$ReadingAnnotationsTableCreateCompanionBuilder,
      $$ReadingAnnotationsTableUpdateCompanionBuilder,
      (
        ReadingAnnotationRow,
        BaseReferences<
          _$AppDatabase,
          $ReadingAnnotationsTable,
          ReadingAnnotationRow
        >,
      ),
      ReadingAnnotationRow,
      PrefetchHooks Function()
    >;
typedef $$VocabCardsTableCreateCompanionBuilder = VocabCardsCompanion Function({
  required DateTime createdAt,
  required DateTime updatedAt,
  required String cardId,
  required String headword,
  Value<String?> ipa,
  required String definition,
  required String topicTag,
  Value<int> repetitions,
  Value<int> intervalDays,
  Value<double> easeFactor,
  Value<int> easeFactorMilli,
  required int dueDay,
  Value<int> dueDaySerial,
  Value<String?> contextSentence,
  Value<String?> paraphraseHintsJson,
  Value<String?> usageNote,
  Value<String?> sourceSkill,
  Value<String?> sourceAttemptId,
  Value<String?> sourceRefLabel,
  Value<int> rowid,
});
typedef $$VocabCardsTableUpdateCompanionBuilder = VocabCardsCompanion Function({
  Value<DateTime> createdAt,
  Value<DateTime> updatedAt,
  Value<String> cardId,
  Value<String> headword,
  Value<String?> ipa,
  Value<String> definition,
  Value<String> topicTag,
  Value<int> repetitions,
  Value<int> intervalDays,
  Value<double> easeFactor,
  Value<int> easeFactorMilli,
  Value<int> dueDay,
  Value<int> dueDaySerial,
  Value<String?> contextSentence,
  Value<String?> paraphraseHintsJson,
  Value<String?> usageNote,
  Value<String?> sourceSkill,
  Value<String?> sourceAttemptId,
  Value<String?> sourceRefLabel,
  Value<int> rowid,
});

final class $$VocabCardsTableReferences
    extends BaseReferences<_$AppDatabase, $VocabCardsTable, VocabCardRow> {
  $$VocabCardsTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$VocabReviewLogsTable, List<VocabReviewLogRow>>
  _vocabReviewLogsRefsTable(_$AppDatabase db) => MultiTypedResultKey.fromTable(
    db.vocabReviewLogs,
    aliasName: 'vocab_cards__card_id__vocab_review_logs__card_id',
  );

  $$VocabReviewLogsTableProcessedTableManager get vocabReviewLogsRefs {
    final manager =
        $$VocabReviewLogsTableTableManager($_db, $_db.vocabReviewLogs).filter(
          (f) => f.cardId.cardId.sqlEquals($_itemColumn<String>('card_id')!),
        );

    final cache = $_typedResult.readTableOrNull(
      _vocabReviewLogsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$VocabCardsTableFilterComposer
    extends Composer<_$AppDatabase, $VocabCardsTable> {
  $$VocabCardsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get cardId => $composableBuilder(
    column: $table.cardId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get headword => $composableBuilder(
    column: $table.headword,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get ipa => $composableBuilder(
    column: $table.ipa,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get definition => $composableBuilder(
    column: $table.definition,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get topicTag => $composableBuilder(
    column: $table.topicTag,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get repetitions => $composableBuilder(
    column: $table.repetitions,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get intervalDays => $composableBuilder(
    column: $table.intervalDays,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get easeFactor => $composableBuilder(
    column: $table.easeFactor,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get easeFactorMilli => $composableBuilder(
    column: $table.easeFactorMilli,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get dueDay => $composableBuilder(
    column: $table.dueDay,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get dueDaySerial => $composableBuilder(
    column: $table.dueDaySerial,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get contextSentence => $composableBuilder(
    column: $table.contextSentence,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get paraphraseHintsJson => $composableBuilder(
    column: $table.paraphraseHintsJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get usageNote => $composableBuilder(
    column: $table.usageNote,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sourceSkill => $composableBuilder(
    column: $table.sourceSkill,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sourceAttemptId => $composableBuilder(
    column: $table.sourceAttemptId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sourceRefLabel => $composableBuilder(
    column: $table.sourceRefLabel,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> vocabReviewLogsRefs(
    Expression<bool> Function($$VocabReviewLogsTableFilterComposer f) f,
  ) {
    final $$VocabReviewLogsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.cardId,
      referencedTable: $db.vocabReviewLogs,
      getReferencedColumn: (t) => t.cardId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$VocabReviewLogsTableFilterComposer(
            $db: $db,
            $table: $db.vocabReviewLogs,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$VocabCardsTableOrderingComposer
    extends Composer<_$AppDatabase, $VocabCardsTable> {
  $$VocabCardsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get cardId => $composableBuilder(
    column: $table.cardId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get headword => $composableBuilder(
    column: $table.headword,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get ipa => $composableBuilder(
    column: $table.ipa,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get definition => $composableBuilder(
    column: $table.definition,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get topicTag => $composableBuilder(
    column: $table.topicTag,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get repetitions => $composableBuilder(
    column: $table.repetitions,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get intervalDays => $composableBuilder(
    column: $table.intervalDays,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get easeFactor => $composableBuilder(
    column: $table.easeFactor,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get easeFactorMilli => $composableBuilder(
    column: $table.easeFactorMilli,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get dueDay => $composableBuilder(
    column: $table.dueDay,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get dueDaySerial => $composableBuilder(
    column: $table.dueDaySerial,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get contextSentence => $composableBuilder(
    column: $table.contextSentence,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get paraphraseHintsJson => $composableBuilder(
    column: $table.paraphraseHintsJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get usageNote => $composableBuilder(
    column: $table.usageNote,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sourceSkill => $composableBuilder(
    column: $table.sourceSkill,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sourceAttemptId => $composableBuilder(
    column: $table.sourceAttemptId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sourceRefLabel => $composableBuilder(
    column: $table.sourceRefLabel,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$VocabCardsTableAnnotationComposer
    extends Composer<_$AppDatabase, $VocabCardsTable> {
  $$VocabCardsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<String> get cardId =>
      $composableBuilder(column: $table.cardId, builder: (column) => column);

  GeneratedColumn<String> get headword =>
      $composableBuilder(column: $table.headword, builder: (column) => column);

  GeneratedColumn<String> get ipa =>
      $composableBuilder(column: $table.ipa, builder: (column) => column);

  GeneratedColumn<String> get definition => $composableBuilder(
    column: $table.definition,
    builder: (column) => column,
  );

  GeneratedColumn<String> get topicTag =>
      $composableBuilder(column: $table.topicTag, builder: (column) => column);

  GeneratedColumn<int> get repetitions => $composableBuilder(
    column: $table.repetitions,
    builder: (column) => column,
  );

  GeneratedColumn<int> get intervalDays => $composableBuilder(
    column: $table.intervalDays,
    builder: (column) => column,
  );

  GeneratedColumn<double> get easeFactor => $composableBuilder(
    column: $table.easeFactor,
    builder: (column) => column,
  );

  GeneratedColumn<int> get easeFactorMilli => $composableBuilder(
    column: $table.easeFactorMilli,
    builder: (column) => column,
  );

  GeneratedColumn<int> get dueDay =>
      $composableBuilder(column: $table.dueDay, builder: (column) => column);

  GeneratedColumn<int> get dueDaySerial => $composableBuilder(
    column: $table.dueDaySerial,
    builder: (column) => column,
  );

  GeneratedColumn<String> get contextSentence => $composableBuilder(
    column: $table.contextSentence,
    builder: (column) => column,
  );

  GeneratedColumn<String> get paraphraseHintsJson => $composableBuilder(
    column: $table.paraphraseHintsJson,
    builder: (column) => column,
  );

  GeneratedColumn<String> get usageNote =>
      $composableBuilder(column: $table.usageNote, builder: (column) => column);

  GeneratedColumn<String> get sourceSkill => $composableBuilder(
    column: $table.sourceSkill,
    builder: (column) => column,
  );

  GeneratedColumn<String> get sourceAttemptId => $composableBuilder(
    column: $table.sourceAttemptId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get sourceRefLabel => $composableBuilder(
    column: $table.sourceRefLabel,
    builder: (column) => column,
  );

  Expression<T> vocabReviewLogsRefs<T extends Object>(
    Expression<T> Function($$VocabReviewLogsTableAnnotationComposer a) f,
  ) {
    final $$VocabReviewLogsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.cardId,
      referencedTable: $db.vocabReviewLogs,
      getReferencedColumn: (t) => t.cardId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$VocabReviewLogsTableAnnotationComposer(
            $db: $db,
            $table: $db.vocabReviewLogs,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$VocabCardsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $VocabCardsTable,
          VocabCardRow,
          $$VocabCardsTableFilterComposer,
          $$VocabCardsTableOrderingComposer,
          $$VocabCardsTableAnnotationComposer,
          $$VocabCardsTableCreateCompanionBuilder,
          $$VocabCardsTableUpdateCompanionBuilder,
          (VocabCardRow, $$VocabCardsTableReferences),
          VocabCardRow,
          PrefetchHooks Function({bool vocabReviewLogsRefs})
        > {
  $$VocabCardsTableTableManager(_$AppDatabase db, $VocabCardsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$VocabCardsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$VocabCardsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$VocabCardsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<String> cardId = const Value.absent(),
                Value<String> headword = const Value.absent(),
                Value<String?> ipa = const Value.absent(),
                Value<String> definition = const Value.absent(),
                Value<String> topicTag = const Value.absent(),
                Value<int> repetitions = const Value.absent(),
                Value<int> intervalDays = const Value.absent(),
                Value<double> easeFactor = const Value.absent(),
                Value<int> easeFactorMilli = const Value.absent(),
                Value<int> dueDay = const Value.absent(),
                Value<int> dueDaySerial = const Value.absent(),
                Value<String?> contextSentence = const Value.absent(),
                Value<String?> paraphraseHintsJson = const Value.absent(),
                Value<String?> usageNote = const Value.absent(),
                Value<String?> sourceSkill = const Value.absent(),
                Value<String?> sourceAttemptId = const Value.absent(),
                Value<String?> sourceRefLabel = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => VocabCardsCompanion(
                createdAt: createdAt,
                updatedAt: updatedAt,
                cardId: cardId,
                headword: headword,
                ipa: ipa,
                definition: definition,
                topicTag: topicTag,
                repetitions: repetitions,
                intervalDays: intervalDays,
                easeFactor: easeFactor,
                easeFactorMilli: easeFactorMilli,
                dueDay: dueDay,
                dueDaySerial: dueDaySerial,
                contextSentence: contextSentence,
                paraphraseHintsJson: paraphraseHintsJson,
                usageNote: usageNote,
                sourceSkill: sourceSkill,
                sourceAttemptId: sourceAttemptId,
                sourceRefLabel: sourceRefLabel,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required DateTime createdAt,
                required DateTime updatedAt,
                required String cardId,
                required String headword,
                Value<String?> ipa = const Value.absent(),
                required String definition,
                required String topicTag,
                Value<int> repetitions = const Value.absent(),
                Value<int> intervalDays = const Value.absent(),
                Value<double> easeFactor = const Value.absent(),
                Value<int> easeFactorMilli = const Value.absent(),
                required int dueDay,
                Value<int> dueDaySerial = const Value.absent(),
                Value<String?> contextSentence = const Value.absent(),
                Value<String?> paraphraseHintsJson = const Value.absent(),
                Value<String?> usageNote = const Value.absent(),
                Value<String?> sourceSkill = const Value.absent(),
                Value<String?> sourceAttemptId = const Value.absent(),
                Value<String?> sourceRefLabel = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => VocabCardsCompanion.insert(
                createdAt: createdAt,
                updatedAt: updatedAt,
                cardId: cardId,
                headword: headword,
                ipa: ipa,
                definition: definition,
                topicTag: topicTag,
                repetitions: repetitions,
                intervalDays: intervalDays,
                easeFactor: easeFactor,
                easeFactorMilli: easeFactorMilli,
                dueDay: dueDay,
                dueDaySerial: dueDaySerial,
                contextSentence: contextSentence,
                paraphraseHintsJson: paraphraseHintsJson,
                usageNote: usageNote,
                sourceSkill: sourceSkill,
                sourceAttemptId: sourceAttemptId,
                sourceRefLabel: sourceRefLabel,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$VocabCardsTable, VocabCardRow>(table),
                  $$VocabCardsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({vocabReviewLogsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [
                if (vocabReviewLogsRefs) db.vocabReviewLogs,
              ],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (vocabReviewLogsRefs)
                    await $_getPrefetchedDataByColumns<
                      VocabCardRow,
                      $VocabCardsTable,
                      VocabReviewLogRow,
                      $VocabReviewLogsTable
                    >(
                      currentTable: table,
                      referencedTable: $$VocabCardsTableReferences
                          ._vocabReviewLogsRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$VocabCardsTableReferences(
                            db,
                            table,
                            p0,
                          ).vocabReviewLogsRefs,
                      currentColumn: 'card_id',
                      referencedColumn: 'card_id',
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$VocabCardsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $VocabCardsTable,
      VocabCardRow,
      $$VocabCardsTableFilterComposer,
      $$VocabCardsTableOrderingComposer,
      $$VocabCardsTableAnnotationComposer,
      $$VocabCardsTableCreateCompanionBuilder,
      $$VocabCardsTableUpdateCompanionBuilder,
      (VocabCardRow, $$VocabCardsTableReferences),
      VocabCardRow,
      PrefetchHooks Function({bool vocabReviewLogsRefs})
    >;
typedef $$VocabReviewLogsTableCreateCompanionBuilder =
    VocabReviewLogsCompanion Function({
      required String logId,
      required String cardId,
      required int rating,
      required int reviewedDaySerial,
      required int reviewedAtUtcMs,
      Value<int> rowid,
    });
typedef $$VocabReviewLogsTableUpdateCompanionBuilder =
    VocabReviewLogsCompanion Function({
      Value<String> logId,
      Value<String> cardId,
      Value<int> rating,
      Value<int> reviewedDaySerial,
      Value<int> reviewedAtUtcMs,
      Value<int> rowid,
    });

final class $$VocabReviewLogsTableReferences
    extends
        BaseReferences<
          _$AppDatabase,
          $VocabReviewLogsTable,
          VocabReviewLogRow
        > {
  $$VocabReviewLogsTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $VocabCardsTable _cardIdTable(_$AppDatabase db) => db.vocabCards
      .createAlias('vocab_review_logs__card_id__vocab_cards__card_id');

  $$VocabCardsTableProcessedTableManager get cardId {
    final $_column = $_itemColumn<String>('card_id')!;

    final manager = $$VocabCardsTableTableManager(
      $_db,
      $_db.vocabCards,
    ).filter((f) => f.cardId.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_cardIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$VocabReviewLogsTableFilterComposer
    extends Composer<_$AppDatabase, $VocabReviewLogsTable> {
  $$VocabReviewLogsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get logId => $composableBuilder(
    column: $table.logId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get reviewedDaySerial => $composableBuilder(
    column: $table.reviewedDaySerial,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get reviewedAtUtcMs => $composableBuilder(
    column: $table.reviewedAtUtcMs,
    builder: (column) => ColumnFilters(column),
  );

  $$VocabCardsTableFilterComposer get cardId {
    final $$VocabCardsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.cardId,
      referencedTable: $db.vocabCards,
      getReferencedColumn: (t) => t.cardId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$VocabCardsTableFilterComposer(
            $db: $db,
            $table: $db.vocabCards,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$VocabReviewLogsTableOrderingComposer
    extends Composer<_$AppDatabase, $VocabReviewLogsTable> {
  $$VocabReviewLogsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get logId => $composableBuilder(
    column: $table.logId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get rating => $composableBuilder(
    column: $table.rating,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get reviewedDaySerial => $composableBuilder(
    column: $table.reviewedDaySerial,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get reviewedAtUtcMs => $composableBuilder(
    column: $table.reviewedAtUtcMs,
    builder: (column) => ColumnOrderings(column),
  );

  $$VocabCardsTableOrderingComposer get cardId {
    final $$VocabCardsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.cardId,
      referencedTable: $db.vocabCards,
      getReferencedColumn: (t) => t.cardId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$VocabCardsTableOrderingComposer(
            $db: $db,
            $table: $db.vocabCards,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$VocabReviewLogsTableAnnotationComposer
    extends Composer<_$AppDatabase, $VocabReviewLogsTable> {
  $$VocabReviewLogsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get logId =>
      $composableBuilder(column: $table.logId, builder: (column) => column);

  GeneratedColumn<int> get rating =>
      $composableBuilder(column: $table.rating, builder: (column) => column);

  GeneratedColumn<int> get reviewedDaySerial => $composableBuilder(
    column: $table.reviewedDaySerial,
    builder: (column) => column,
  );

  GeneratedColumn<int> get reviewedAtUtcMs => $composableBuilder(
    column: $table.reviewedAtUtcMs,
    builder: (column) => column,
  );

  $$VocabCardsTableAnnotationComposer get cardId {
    final $$VocabCardsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.cardId,
      referencedTable: $db.vocabCards,
      getReferencedColumn: (t) => t.cardId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$VocabCardsTableAnnotationComposer(
            $db: $db,
            $table: $db.vocabCards,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$VocabReviewLogsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $VocabReviewLogsTable,
          VocabReviewLogRow,
          $$VocabReviewLogsTableFilterComposer,
          $$VocabReviewLogsTableOrderingComposer,
          $$VocabReviewLogsTableAnnotationComposer,
          $$VocabReviewLogsTableCreateCompanionBuilder,
          $$VocabReviewLogsTableUpdateCompanionBuilder,
          (VocabReviewLogRow, $$VocabReviewLogsTableReferences),
          VocabReviewLogRow,
          PrefetchHooks Function({bool cardId})
        > {
  $$VocabReviewLogsTableTableManager(
    _$AppDatabase db,
    $VocabReviewLogsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$VocabReviewLogsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$VocabReviewLogsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$VocabReviewLogsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> logId = const Value.absent(),
                Value<String> cardId = const Value.absent(),
                Value<int> rating = const Value.absent(),
                Value<int> reviewedDaySerial = const Value.absent(),
                Value<int> reviewedAtUtcMs = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => VocabReviewLogsCompanion(
                logId: logId,
                cardId: cardId,
                rating: rating,
                reviewedDaySerial: reviewedDaySerial,
                reviewedAtUtcMs: reviewedAtUtcMs,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String logId,
                required String cardId,
                required int rating,
                required int reviewedDaySerial,
                required int reviewedAtUtcMs,
                Value<int> rowid = const Value.absent(),
              }) => VocabReviewLogsCompanion.insert(
                logId: logId,
                cardId: cardId,
                rating: rating,
                reviewedDaySerial: reviewedDaySerial,
                reviewedAtUtcMs: reviewedAtUtcMs,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$VocabReviewLogsTable, VocabReviewLogRow>(table),
                  $$VocabReviewLogsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({cardId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (cardId) {
                      state = state.withJoin(
                        currentTable: table,
                        currentColumn: table.cardId,
                        referencedTable: $$VocabReviewLogsTableReferences
                            ._cardIdTable(db),
                        referencedColumn: $$VocabReviewLogsTableReferences
                            ._cardIdTable(db)
                            .cardId,
                      ) as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$VocabReviewLogsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $VocabReviewLogsTable,
      VocabReviewLogRow,
      $$VocabReviewLogsTableFilterComposer,
      $$VocabReviewLogsTableOrderingComposer,
      $$VocabReviewLogsTableAnnotationComposer,
      $$VocabReviewLogsTableCreateCompanionBuilder,
      $$VocabReviewLogsTableUpdateCompanionBuilder,
      (VocabReviewLogRow, $$VocabReviewLogsTableReferences),
      VocabReviewLogRow,
      PrefetchHooks Function({bool cardId})
    >;
typedef $$DailyStudyLogsTableCreateCompanionBuilder =
    DailyStudyLogsCompanion Function({
      required DateTime createdAt,
      required DateTime updatedAt,
      Value<int> serialDay,
      Value<int> studySeconds,
      Value<int> completedItems,
    });
typedef $$DailyStudyLogsTableUpdateCompanionBuilder =
    DailyStudyLogsCompanion Function({
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> serialDay,
      Value<int> studySeconds,
      Value<int> completedItems,
    });

class $$DailyStudyLogsTableFilterComposer
    extends Composer<_$AppDatabase, $DailyStudyLogsTable> {
  $$DailyStudyLogsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get serialDay => $composableBuilder(
    column: $table.serialDay,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get studySeconds => $composableBuilder(
    column: $table.studySeconds,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get completedItems => $composableBuilder(
    column: $table.completedItems,
    builder: (column) => ColumnFilters(column),
  );
}

class $$DailyStudyLogsTableOrderingComposer
    extends Composer<_$AppDatabase, $DailyStudyLogsTable> {
  $$DailyStudyLogsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get serialDay => $composableBuilder(
    column: $table.serialDay,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get studySeconds => $composableBuilder(
    column: $table.studySeconds,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get completedItems => $composableBuilder(
    column: $table.completedItems,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DailyStudyLogsTableAnnotationComposer
    extends Composer<_$AppDatabase, $DailyStudyLogsTable> {
  $$DailyStudyLogsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<int> get serialDay =>
      $composableBuilder(column: $table.serialDay, builder: (column) => column);

  GeneratedColumn<int> get studySeconds => $composableBuilder(
    column: $table.studySeconds,
    builder: (column) => column,
  );

  GeneratedColumn<int> get completedItems => $composableBuilder(
    column: $table.completedItems,
    builder: (column) => column,
  );
}

class $$DailyStudyLogsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $DailyStudyLogsTable,
          DailyStudyLogRow,
          $$DailyStudyLogsTableFilterComposer,
          $$DailyStudyLogsTableOrderingComposer,
          $$DailyStudyLogsTableAnnotationComposer,
          $$DailyStudyLogsTableCreateCompanionBuilder,
          $$DailyStudyLogsTableUpdateCompanionBuilder,
          (
            DailyStudyLogRow,
            BaseReferences<
              _$AppDatabase,
              $DailyStudyLogsTable,
              DailyStudyLogRow
            >,
          ),
          DailyStudyLogRow,
          PrefetchHooks Function()
        > {
  $$DailyStudyLogsTableTableManager(
    _$AppDatabase db,
    $DailyStudyLogsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DailyStudyLogsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DailyStudyLogsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DailyStudyLogsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> serialDay = const Value.absent(),
                Value<int> studySeconds = const Value.absent(),
                Value<int> completedItems = const Value.absent(),
              }) => DailyStudyLogsCompanion(
                createdAt: createdAt,
                updatedAt: updatedAt,
                serialDay: serialDay,
                studySeconds: studySeconds,
                completedItems: completedItems,
              ),
          createCompanionCallback:
              ({
                required DateTime createdAt,
                required DateTime updatedAt,
                Value<int> serialDay = const Value.absent(),
                Value<int> studySeconds = const Value.absent(),
                Value<int> completedItems = const Value.absent(),
              }) => DailyStudyLogsCompanion.insert(
                createdAt: createdAt,
                updatedAt: updatedAt,
                serialDay: serialDay,
                studySeconds: studySeconds,
                completedItems: completedItems,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$DailyStudyLogsTable, DailyStudyLogRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $DailyStudyLogsTable,
                    DailyStudyLogRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$DailyStudyLogsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $DailyStudyLogsTable,
      DailyStudyLogRow,
      $$DailyStudyLogsTableFilterComposer,
      $$DailyStudyLogsTableOrderingComposer,
      $$DailyStudyLogsTableAnnotationComposer,
      $$DailyStudyLogsTableCreateCompanionBuilder,
      $$DailyStudyLogsTableUpdateCompanionBuilder,
      (
        DailyStudyLogRow,
        BaseReferences<_$AppDatabase, $DailyStudyLogsTable, DailyStudyLogRow>,
      ),
      DailyStudyLogRow,
      PrefetchHooks Function()
    >;
typedef $$OutboxSyncQueueTableCreateCompanionBuilder =
    OutboxSyncQueueCompanion Function({
      required DateTime createdAt,
      required DateTime updatedAt,
      Value<int> id,
      required String actionType,
      required String payloadJson,
      Value<int> retryCount,
      required DateTime nextAttemptAt,
    });
typedef $$OutboxSyncQueueTableUpdateCompanionBuilder =
    OutboxSyncQueueCompanion Function({
      Value<DateTime> createdAt,
      Value<DateTime> updatedAt,
      Value<int> id,
      Value<String> actionType,
      Value<String> payloadJson,
      Value<int> retryCount,
      Value<DateTime> nextAttemptAt,
    });

class $$OutboxSyncQueueTableFilterComposer
    extends Composer<_$AppDatabase, $OutboxSyncQueueTable> {
  $$OutboxSyncQueueTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get actionType => $composableBuilder(
    column: $table.actionType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OutboxSyncQueueTableOrderingComposer
    extends Composer<_$AppDatabase, $OutboxSyncQueueTable> {
  $$OutboxSyncQueueTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get actionType => $composableBuilder(
    column: $table.actionType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OutboxSyncQueueTableAnnotationComposer
    extends Composer<_$AppDatabase, $OutboxSyncQueueTable> {
  $$OutboxSyncQueueTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);

  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get actionType => $composableBuilder(
    column: $table.actionType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get payloadJson => $composableBuilder(
    column: $table.payloadJson,
    builder: (column) => column,
  );

  GeneratedColumn<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => column,
  );
}

class $$OutboxSyncQueueTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $OutboxSyncQueueTable,
          OutboxSyncItemRow,
          $$OutboxSyncQueueTableFilterComposer,
          $$OutboxSyncQueueTableOrderingComposer,
          $$OutboxSyncQueueTableAnnotationComposer,
          $$OutboxSyncQueueTableCreateCompanionBuilder,
          $$OutboxSyncQueueTableUpdateCompanionBuilder,
          (
            OutboxSyncItemRow,
            BaseReferences<
              _$AppDatabase,
              $OutboxSyncQueueTable,
              OutboxSyncItemRow
            >,
          ),
          OutboxSyncItemRow,
          PrefetchHooks Function()
        > {
  $$OutboxSyncQueueTableTableManager(
    _$AppDatabase db,
    $OutboxSyncQueueTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OutboxSyncQueueTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OutboxSyncQueueTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OutboxSyncQueueTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<DateTime> createdAt = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> id = const Value.absent(),
                Value<String> actionType = const Value.absent(),
                Value<String> payloadJson = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<DateTime> nextAttemptAt = const Value.absent(),
              }) => OutboxSyncQueueCompanion(
                createdAt: createdAt,
                updatedAt: updatedAt,
                id: id,
                actionType: actionType,
                payloadJson: payloadJson,
                retryCount: retryCount,
                nextAttemptAt: nextAttemptAt,
              ),
          createCompanionCallback:
              ({
                required DateTime createdAt,
                required DateTime updatedAt,
                Value<int> id = const Value.absent(),
                required String actionType,
                required String payloadJson,
                Value<int> retryCount = const Value.absent(),
                required DateTime nextAttemptAt,
              }) => OutboxSyncQueueCompanion.insert(
                createdAt: createdAt,
                updatedAt: updatedAt,
                id: id,
                actionType: actionType,
                payloadJson: payloadJson,
                retryCount: retryCount,
                nextAttemptAt: nextAttemptAt,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$OutboxSyncQueueTable, OutboxSyncItemRow>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $OutboxSyncQueueTable,
                    OutboxSyncItemRow
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OutboxSyncQueueTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $OutboxSyncQueueTable,
      OutboxSyncItemRow,
      $$OutboxSyncQueueTableFilterComposer,
      $$OutboxSyncQueueTableOrderingComposer,
      $$OutboxSyncQueueTableAnnotationComposer,
      $$OutboxSyncQueueTableCreateCompanionBuilder,
      $$OutboxSyncQueueTableUpdateCompanionBuilder,
      (
        OutboxSyncItemRow,
        BaseReferences<_$AppDatabase, $OutboxSyncQueueTable, OutboxSyncItemRow>,
      ),
      OutboxSyncItemRow,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$UserProfilesTableTableManager get userProfiles =>
      $$UserProfilesTableTableManager(_db, _db.userProfiles);
  $$ExamPacksTableTableManager get examPacks =>
      $$ExamPacksTableTableManager(_db, _db.examPacks);
  $$ExamPayloadsTableTableManager get examPayloads =>
      $$ExamPayloadsTableTableManager(_db, _db.examPayloads);
  $$CachedDrillsTableTableManager get cachedDrills =>
      $$CachedDrillsTableTableManager(_db, _db.cachedDrills);
  $$ExamAttemptsTableTableManager get examAttempts =>
      $$ExamAttemptsTableTableManager(_db, _db.examAttempts);
  $$AudioRecordingsTableTableManager get audioRecordings =>
      $$AudioRecordingsTableTableManager(_db, _db.audioRecordings);
  $$WritingDraftsTableTableManager get writingDrafts =>
      $$WritingDraftsTableTableManager(_db, _db.writingDrafts);
  $$ReadingAnnotationsTableTableManager get readingAnnotations =>
      $$ReadingAnnotationsTableTableManager(_db, _db.readingAnnotations);
  $$VocabCardsTableTableManager get vocabCards =>
      $$VocabCardsTableTableManager(_db, _db.vocabCards);
  $$VocabReviewLogsTableTableManager get vocabReviewLogs =>
      $$VocabReviewLogsTableTableManager(_db, _db.vocabReviewLogs);
  $$DailyStudyLogsTableTableManager get dailyStudyLogs =>
      $$DailyStudyLogsTableTableManager(_db, _db.dailyStudyLogs);
  $$OutboxSyncQueueTableTableManager get outboxSyncQueue =>
      $$OutboxSyncQueueTableTableManager(_db, _db.outboxSyncQueue);
}
