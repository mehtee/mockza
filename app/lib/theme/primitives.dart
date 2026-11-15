import 'dart:ui';

/// Canonical raw design tokens from design.md Sec. 2 & 12 (strictly confined to `lib/theme/`).
abstract final class PalettePrimitives {
  // --- Canonical Dark Palette (Primary Mode) ---
  /// Main app canvas background (`#0C0F19`).
  static const Color darkBg = Color(0xFF0C0F19);

  /// Sheets and lifted containers (`#111522`).
  static const Color darkBgRaised = Color(0xFF111522);

  /// Default card, input, toolbar surface (`#191D2D`).
  static const Color darkSurface = Color(0xFF191D2D);

  /// Nested accents, pills, icon background wells (`#20243A`).
  static const Color darkSurfaceAlt = Color(0xFF20243A);

  /// Press/hover feedback surface (`#292E47`).
  static const Color darkSurfaceHover = Color(0xFF292E47);

  /// Subtle 1px borders and hairline dividers (`#353B52`).
  static const Color darkBorder = Color(0xFF353B52);

  /// Hover and selected outlines (`#4B5270`).
  static const Color darkBorderStrong = Color(0xFF4B5270);

  /// Primary readable text ink (`#F6F8FC`).
  static const Color darkText = Color(0xFFF6F8FC);

  /// Descriptions and secondary metadata (`#B6BDCD`).
  static const Color darkTextSecondary = Color(0xFFB6BDCD);

  /// Tertiary hints and non-critical captions (`#949DB2`).
  static const Color darkTextTertiary = Color(0xFF949DB2);

  /// Primary brand accent (`#9580FF`).
  static const Color darkAccent = Color(0xFF9580FF);

  /// Pressed brand accent (`#7A65DF`).
  static const Color darkAccentPressed = Color(0xFF7A65DF);

  /// High contrast ink on primary accent (`#090B14`).
  static const Color darkAccentContrast = Color(0xFF090B14);

  /// Keyboard accessibility and focus outline (`#A8CFFF`).
  static const Color darkFocus = Color(0xFFA8CFFF);

  /// Speaking module & Listening accent (`#70BEFF`).
  static const Color blue = Color(0xFF70BEFF);

  /// Writing module accent (`#AC91FF`).
  static const Color violet = Color(0xFFAC91FF);

  /// Reading module accent (`#66DBB5`).
  static const Color mint = Color(0xFF66DBB5);

  /// Vocabulary SRS & attention accent (`#F2C16B`).
  static const Color amber = Color(0xFFF2C16B);

  /// Confirmed success highlight (`#6EE2BA`).
  static const Color success = Color(0xFF6EE2BA);

  /// Recoverable warning highlight (`#F2C16B`).
  static const Color warning = Color(0xFFF2C16B);

  /// Destructive/failed error highlight (`#FF949C`).
  static const Color danger = Color(0xFFFF949C);

  /// Empty progress & slider track (`#34394E`).
  static const Color track = Color(0xFF34394E);

  /// Mint tinted container fill for dark mode (`#15362F`).
  static const Color mintBg = Color(0xFF15362F);

  /// Amber tinted container fill for dark mode (`#3C301B`).
  static const Color amberBg = Color(0xFF3C301B);

  /// Danger tinted container fill for dark mode (`#3B2029`).
  static const Color dangerBg = Color(0xFF3B2029);

  /// Blue tinted container fill for dark mode (`#172B45`).
  static const Color blueBg = Color(0xFF172B45);

  /// Violet tinted container fill for dark mode (`#2A2147`).
  static const Color violetBg = Color(0xFF2A2147);

  // --- Canonical Light Palette ---
  /// Light canvas background (`#F7F8FC`).
  static const Color lightBg = Color(0xFFF7F8FC);

  /// Light raised surface (`#FFFFFF`).
  static const Color lightBgRaised = Color(0xFFFFFFFF);

  /// Light default card surface (`#FFFFFF`).
  static const Color lightSurface = Color(0xFFFFFFFF);

  /// Light nested accent/pill surface (`#F0F2FA`).
  static const Color lightSurfaceAlt = Color(0xFFF0F2FA);

  /// Light hover/press feedback surface (`#E5E8F5`).
  static const Color lightSurfaceHover = Color(0xFFE5E8F5);

  /// Light hairline divider (`#D5D9E8`).
  static const Color lightBorder = Color(0xFFD5D9E8);

  /// Light hover/selected stroke (`#B8BFD6`).
  static const Color lightBorderStrong = Color(0xFFB8BFD6);

  /// Light primary body ink (`#0F1424`).
  static const Color lightText = Color(0xFF0F1424);

  /// Light descriptions and metadata (`#525B75`).
  static const Color lightTextSecondary = Color(0xFF525B75);

  /// Light tertiary hints and captions (`#7A849E`).
  static const Color lightTextTertiary = Color(0xFF7A849E);

  /// Light primary brand accent (`#5E4CCF`).
  static const Color lightAccent = Color(0xFF5E4CCF);

  /// Light pressed brand accent (`#4E3EAF`).
  static const Color lightAccentPressed = Color(0xFF4E3EAF);

  /// Light high contrast ink on accent (`#FFFFFF`).
  static const Color lightAccentContrast = Color(0xFFFFFFFF);

  /// Light focus ring (`#5E4CCF`).
  static const Color lightFocus = Color(0xFF5E4CCF);

  /// Light speaking & listening accent (`#1968BD`).
  static const Color lightBlue = Color(0xFF1968BD);

  /// Light writing accent (`#6049BA`).
  static const Color lightViolet = Color(0xFF6049BA);

  /// Light reading accent (`#147E62`).
  static const Color lightMint = Color(0xFF147E62);

  /// Light vocabulary/warning accent (`#956116`).
  static const Color lightAmber = Color(0xFF956116);

  /// Light confirmed success (`#147E62`).
  static const Color lightSuccess = Color(0xFF147E62);

  /// Light warning (`#956116`).
  static const Color lightWarning = Color(0xFF956116);

  /// Light danger/error (`#B22A44`).
  static const Color lightDanger = Color(0xFFB22A44);

  /// Light empty progress track (`#D5D9E8`).
  static const Color lightTrack = Color(0xFFD5D9E8);

  /// Mint tinted container fill for light mode (`#E6F7F2`).
  static const Color lightMintBg = Color(0xFFE6F7F2);

  /// Amber tinted container fill for light mode (`#FDF6EA`).
  static const Color lightAmberBg = Color(0xFFFDF6EA);

  /// Danger tinted container fill for light mode (`#FCEBEF`).
  static const Color lightDangerBg = Color(0xFFFCEBEF);

  /// Blue tinted container fill for light mode (`#E9F3FC`).
  static const Color lightBlueBg = Color(0xFFE9F3FC);

  /// Violet tinted container fill for light mode (`#F1EDFA`).
  static const Color lightVioletBg = Color(0xFFF1EDFA);

  /// Pure white foreground on vibrant surfaces.
  static const Color white = Color(0xFFFFFFFF);
}

/// Canonical spacing tokens from design.md Sec. 2.3.
abstract final class SpacingTokens {
  /// 4dp micro gap.
  static const double xs = 4;

  /// 8dp small gap.
  static const double sm = 8;

  /// 12dp card gap.
  static const double md = 12;

  /// 16dp compact card padding.
  static const double lg = 16;

  /// 20dp horizontal page inset & standard card padding.
  static const double pageInset = 20;

  /// 24dp section spacing.
  static const double xl = 24;

  /// 28dp top section separation.
  static const double sectionSep = 28;

  /// 32dp generous layout padding.
  static const double xxl = 32;

  /// 40dp hero separation.
  static const double heroSep = 40;

  /// 48dp preferred touch target size (44dp floor).
  static const double minTouchTarget = 48;

  /// 76dp bottom navigation bar height.
  static const double bottomNavHeight = 76;

  /// 680dp max content width on tablets and wide screens.
  static const double maxContentWidth = 680;
}
