import 'dart:ui';

import 'package:mockza/theme/generated_tokens.dart';

/// Canonical raw design tokens from design.md Sec. 2 & 12 (strictly confined to `lib/theme/`).
abstract final class PalettePrimitives {
  // --- Canonical Dark Palette: Midnight Indigo (Primary Mode) ---
  /// Main app canvas background (`#0C0F19`).
  static const Color darkBg = GeneratedPaletteTokens.darkBg;

  /// Sheets and lifted containers (`#111522`).
  static const Color darkBgRaised = GeneratedPaletteTokens.darkBgRaised;

  /// Default card, input, toolbar surface (`#191D2D`).
  static const Color darkSurface = GeneratedPaletteTokens.darkSurface;

  /// Nested accents, pills, icon background wells (`#20243A`).
  static const Color darkSurfaceAlt = GeneratedPaletteTokens.darkSurfaceAlt;

  /// Press/hover feedback surface (`#292E47`).
  static const Color darkSurfaceHover = GeneratedPaletteTokens.darkSurfaceHover;

  /// Subtle 1px borders and hairline dividers (`#353B52`).
  static const Color darkBorder = GeneratedPaletteTokens.darkBorder;

  /// Hover and selected outlines (`#4B5270`).
  static const Color darkBorderStrong = GeneratedPaletteTokens.darkBorderStrong;

  /// Primary readable text ink (`#F6F8FC`).
  static const Color darkText = GeneratedPaletteTokens.darkText;

  /// Descriptions and secondary metadata (`#B6BDCD`).
  static const Color darkTextSecondary =
      GeneratedPaletteTokens.darkTextSecondary;

  /// Tertiary hints and non-critical captions (`#949DB2`).
  static const Color darkTextTertiary =
      GeneratedPaletteTokens.darkTextTertiary;

  /// Primary brand accent (`#9580FF`).
  static const Color darkAccent = GeneratedPaletteTokens.darkAccent;

  /// Pressed brand accent (`#7A65DF`).
  static const Color darkAccentPressed =
      GeneratedPaletteTokens.darkAccentPressed;

  /// High contrast ink on primary accent (`#090B14`).
  static const Color darkAccentContrast =
      GeneratedPaletteTokens.darkAccentContrast;

  /// Keyboard accessibility and focus outline (`#A8CFFF`).
  static const Color darkFocus = GeneratedPaletteTokens.darkFocus;

  /// Speaking module & Listening accent (`#70BEFF`).
  static const Color blue = GeneratedPaletteTokens.blue;

  /// Writing module accent (`#AC91FF`).
  static const Color violet = GeneratedPaletteTokens.violet;

  /// Reading module accent (`#66DBB5`).
  static const Color mint = GeneratedPaletteTokens.mint;

  /// Vocabulary SRS & attention accent (`#F2C16B`).
  static const Color amber = GeneratedPaletteTokens.amber;

  /// Confirmed success highlight (`#6EE2BA`).
  static const Color success = GeneratedPaletteTokens.success;

  /// Recoverable warning highlight (`#F2C16B`).
  static const Color warning = GeneratedPaletteTokens.warning;

  /// Destructive/failed error highlight (`#FF949C`).
  static const Color danger = GeneratedPaletteTokens.danger;

  /// Empty progress & slider track (`#34394E`).
  static const Color track = GeneratedPaletteTokens.track;

  /// Mint tinted container fill for dark mode (`#15362F`).
  static const Color mintBg = GeneratedPaletteTokens.mintBg;

  /// Amber tinted container fill for dark mode (`#3C301B`).
  static const Color amberBg = GeneratedPaletteTokens.amberBg;

  /// Danger tinted container fill for dark mode (`#3B2029`).
  static const Color dangerBg = GeneratedPaletteTokens.dangerBg;

  /// Blue tinted container fill for dark mode (`#172B45`).
  static const Color blueBg = GeneratedPaletteTokens.blueBg;

  /// Violet tinted container fill for dark mode (`#2A2147`).
  static const Color violetBg = GeneratedPaletteTokens.violetBg;

  // Midnight Indigo Gradient Stops (Dark)
  /// Primary CTA start (`#6B8CFF`).
  static const Color indigoBtnStart = GeneratedPaletteTokens.indigoBtnStart;

  /// Primary CTA end (`#8D70F7`).
  static const Color indigoBtnEnd = GeneratedPaletteTokens.indigoBtnEnd;

  /// Score fill start (`#6CCEFF`).
  static const Color indigoScoreStart = GeneratedPaletteTokens.indigoScoreStart;

  /// Score fill end (`#917AFB`).
  static const Color indigoScoreEnd = GeneratedPaletteTokens.indigoScoreEnd;

  /// Hero card gradient stop 1 (`#222840`).
  static const Color indigoHero1 = GeneratedPaletteTokens.indigoHero1;

  /// Hero card gradient stop 2 (`#1C2036`).
  static const Color indigoHero2 = GeneratedPaletteTokens.indigoHero2;

  /// Hero card gradient stop 3 (`#28234C`).
  static const Color indigoHero3 = GeneratedPaletteTokens.indigoHero3;

  /// Recommendation card start (`#252841`).
  static const Color indigoRecStart = GeneratedPaletteTokens.indigoRecStart;

  /// Recommendation card end (`#211F38`).
  static const Color indigoRecEnd = GeneratedPaletteTokens.indigoRecEnd;

  // --- Canonical Light Palette: Midnight Indigo ---
  /// Light canvas background (`#F7F8FC`).
  static const Color lightBg = GeneratedPaletteTokens.lightBg;

  /// Light raised surface (`#FFFFFF`).
  static const Color lightBgRaised = GeneratedPaletteTokens.lightBgRaised;

  /// Light default card surface (`#FFFFFF`).
  static const Color lightSurface = GeneratedPaletteTokens.lightSurface;

  /// Light nested accent/pill surface (`#F0F2FA`).
  static const Color lightSurfaceAlt = GeneratedPaletteTokens.lightSurfaceAlt;

  /// Light hover/press feedback surface (`#E5E8F5`).
  static const Color lightSurfaceHover =
      GeneratedPaletteTokens.lightSurfaceHover;

  /// Light hairline divider (`#D5D9E8`).
  static const Color lightBorder = GeneratedPaletteTokens.lightBorder;

  /// Light hover/selected stroke (`#B8BFD6`).
  static const Color lightBorderStrong =
      GeneratedPaletteTokens.lightBorderStrong;

  /// Light primary body ink (`#0F1424`).
  static const Color lightText = GeneratedPaletteTokens.lightText;

  /// Light descriptions and metadata (`#525B75`).
  static const Color lightTextSecondary =
      GeneratedPaletteTokens.lightTextSecondary;

  /// Light tertiary hints and captions (`#64708D`, WCAG-AA legible).
  static const Color lightTextTertiary =
      GeneratedPaletteTokens.lightTextTertiary;

  /// Light primary brand accent (`#5E4CCF`).
  static const Color lightAccent = GeneratedPaletteTokens.lightAccent;

  /// Light pressed brand accent (`#4E3EAF`).
  static const Color lightAccentPressed =
      GeneratedPaletteTokens.lightAccentPressed;

  /// Light high contrast ink on accent (`#FFFFFF`).
  static const Color lightAccentContrast =
      GeneratedPaletteTokens.lightAccentContrast;

  /// Light focus ring (`#5E4CCF`).
  static const Color lightFocus = GeneratedPaletteTokens.lightFocus;

  /// Light speaking & listening accent (`#1968BD`).
  static const Color lightBlue = GeneratedPaletteTokens.lightBlue;

  /// Light writing accent (`#6049BA`).
  static const Color lightViolet = GeneratedPaletteTokens.lightViolet;

  /// Light reading accent (`#147E62`).
  static const Color lightMint = GeneratedPaletteTokens.lightMint;

  /// Light vocabulary/warning accent (`#956116`).
  static const Color lightAmber = GeneratedPaletteTokens.lightAmber;

  /// Light confirmed success (`#147E62`).
  static const Color lightSuccess = GeneratedPaletteTokens.lightSuccess;

  /// Light warning (`#956116`).
  static const Color lightWarning = GeneratedPaletteTokens.lightWarning;

  /// Light danger/error (`#B22A44`).
  static const Color lightDanger = GeneratedPaletteTokens.lightDanger;

  /// Light empty progress track (`#D5D9E8`).
  static const Color lightTrack = GeneratedPaletteTokens.lightTrack;

  /// Mint tinted container fill for light mode (`#E6F7F2`).
  static const Color lightMintBg = GeneratedPaletteTokens.lightMintBg;

  /// Amber tinted container fill for light mode (`#FDF6EA`).
  static const Color lightAmberBg = GeneratedPaletteTokens.lightAmberBg;

  /// Danger tinted container fill for light mode (`#FCEBEF`).
  static const Color lightDangerBg = GeneratedPaletteTokens.lightDangerBg;

  /// Blue tinted container fill for light mode (`#E9F3FC`).
  static const Color lightBlueBg = GeneratedPaletteTokens.lightBlueBg;

  /// Violet tinted container fill for light mode (`#F1EDFA`).
  static const Color lightVioletBg = GeneratedPaletteTokens.lightVioletBg;

  /// Light hero card middle stop (`#E8ECF7`).
  static const Color lightHeroMid = GeneratedPaletteTokens.lightHeroMid;

  /// Light hero card end stop (`#E2E7F5`).
  static const Color lightHeroEnd = GeneratedPaletteTokens.lightHeroEnd;

  /// Pure white foreground on vibrant surfaces.
  static const Color white = GeneratedPaletteTokens.white;

  // --- Preset 2: Nordic Emerald (Forest Obsidian & Calm Sage) ---
  /// Nordic Emerald dark canvas.
  static const Color emeraldDarkBg = GeneratedPaletteTokens.emeraldDarkBg;

  /// Nordic Emerald dark raised surface.
  static const Color emeraldDarkRaised =
      GeneratedPaletteTokens.emeraldDarkRaised;

  /// Nordic Emerald dark surface.
  static const Color emeraldDarkSurface =
      GeneratedPaletteTokens.emeraldDarkSurface;

  /// Nordic Emerald dark alt surface.
  static const Color emeraldDarkSurfaceAlt =
      GeneratedPaletteTokens.emeraldDarkSurfaceAlt;

  /// Nordic Emerald dark hover surface.
  static const Color emeraldDarkSurfaceHover =
      GeneratedPaletteTokens.emeraldDarkSurfaceHover;

  /// Nordic Emerald dark border.
  static const Color emeraldDarkBorder =
      GeneratedPaletteTokens.emeraldDarkBorder;

  /// Nordic Emerald dark strong border.
  static const Color emeraldDarkBorderStrong =
      GeneratedPaletteTokens.emeraldDarkBorderStrong;

  /// Nordic Emerald dark primary accent.
  static const Color emeraldDarkAccent =
      GeneratedPaletteTokens.emeraldDarkAccent;

  /// Nordic Emerald dark pressed accent.
  static const Color emeraldDarkAccentPressed =
      GeneratedPaletteTokens.emeraldDarkAccentPressed;

  /// Nordic Emerald dark on-primary contrast ink.
  static const Color emeraldDarkOnPrimary =
      GeneratedPaletteTokens.emeraldDarkOnPrimary;

  /// Nordic Emerald dark secondary CTA start gradient.
  static const Color emeraldDarkBtnEnd =
      GeneratedPaletteTokens.emeraldDarkBtnEnd;

  /// Nordic Emerald dark hero end.
  static const Color emeraldDarkHeroEnd =
      GeneratedPaletteTokens.emeraldDarkHeroEnd;

  /// Nordic Emerald light canvas.
  static const Color emeraldLightBg = GeneratedPaletteTokens.emeraldLightBg;

  /// Nordic Emerald light surface alt.
  static const Color emeraldLightSurfaceAlt =
      GeneratedPaletteTokens.emeraldLightSurfaceAlt;

  /// Nordic Emerald light hover.
  static const Color emeraldLightSurfaceHover =
      GeneratedPaletteTokens.emeraldLightSurfaceHover;

  /// Nordic Emerald light border.
  static const Color emeraldLightBorder =
      GeneratedPaletteTokens.emeraldLightBorder;

  /// Nordic Emerald light strong border.
  static const Color emeraldLightBorderStrong =
      GeneratedPaletteTokens.emeraldLightBorderStrong;

  /// Nordic Emerald light primary accent.
  static const Color emeraldLightAccent =
      GeneratedPaletteTokens.emeraldLightAccent;

  /// Nordic Emerald light pressed accent.
  static const Color emeraldLightAccentPressed =
      GeneratedPaletteTokens.emeraldLightAccentPressed;

  // --- Preset 3: Editorial Amber (Warm Charcoal & Paper Sand) ---
  /// Editorial Amber dark canvas.
  static const Color amberDarkBg = GeneratedPaletteTokens.amberDarkBg;

  /// Editorial Amber dark raised surface.
  static const Color amberDarkRaised = GeneratedPaletteTokens.amberDarkRaised;

  /// Editorial Amber dark card surface.
  static const Color amberDarkSurface = GeneratedPaletteTokens.amberDarkSurface;

  /// Editorial Amber dark alt surface.
  static const Color amberDarkSurfaceAlt =
      GeneratedPaletteTokens.amberDarkSurfaceAlt;

  /// Editorial Amber dark hover surface.
  static const Color amberDarkSurfaceHover =
      GeneratedPaletteTokens.amberDarkSurfaceHover;

  /// Editorial Amber dark border.
  static const Color amberDarkBorder = GeneratedPaletteTokens.amberDarkBorder;

  /// Editorial Amber dark strong border.
  static const Color amberDarkBorderStrong =
      GeneratedPaletteTokens.amberDarkBorderStrong;

  /// Editorial Amber dark primary accent.
  static const Color amberDarkAccent = GeneratedPaletteTokens.amberDarkAccent;

  /// Editorial Amber dark pressed accent.
  static const Color amberDarkAccentPressed =
      GeneratedPaletteTokens.amberDarkAccentPressed;

  /// Editorial Amber dark secondary gradient end.
  static const Color amberDarkBtnEnd = GeneratedPaletteTokens.amberDarkBtnEnd;

  /// Editorial Amber dark on-primary contrast ink.
  static const Color amberDarkOnPrimary =
      GeneratedPaletteTokens.amberDarkOnPrimary;

  /// Editorial Amber dark hero end.
  static const Color amberDarkHeroEnd = GeneratedPaletteTokens.amberDarkHeroEnd;

  /// Editorial Amber light canvas.
  static const Color amberLightBg = GeneratedPaletteTokens.amberLightBg;

  /// Editorial Amber light surface alt.
  static const Color amberLightSurfaceAlt =
      GeneratedPaletteTokens.amberLightSurfaceAlt;

  /// Editorial Amber light hover.
  static const Color amberLightSurfaceHover =
      GeneratedPaletteTokens.amberLightSurfaceHover;

  /// Editorial Amber light border.
  static const Color amberLightBorder = GeneratedPaletteTokens.amberLightBorder;

  /// Editorial Amber light strong border.
  static const Color amberLightBorderStrong =
      GeneratedPaletteTokens.amberLightBorderStrong;

  /// Editorial Amber light primary accent (WCAG AA compliant vs white).
  static const Color amberLightAccent = GeneratedPaletteTokens.amberLightAccent;

  /// Editorial Amber light pressed accent.
  static const Color amberLightAccentPressed =
      GeneratedPaletteTokens.amberLightAccentPressed;

  // --- Preset 4: Oceanic Cobalt (Deep Marine Slate & Ice Mist) ---
  /// Oceanic Cobalt dark canvas.
  static const Color cobaltDarkBg = GeneratedPaletteTokens.cobaltDarkBg;

  /// Oceanic Cobalt dark raised surface.
  static const Color cobaltDarkRaised = GeneratedPaletteTokens.cobaltDarkRaised;

  /// Oceanic Cobalt dark card surface.
  static const Color cobaltDarkSurface =
      GeneratedPaletteTokens.cobaltDarkSurface;

  /// Oceanic Cobalt dark alt surface.
  static const Color cobaltDarkSurfaceAlt =
      GeneratedPaletteTokens.cobaltDarkSurfaceAlt;

  /// Oceanic Cobalt dark hover surface.
  static const Color cobaltDarkSurfaceHover =
      GeneratedPaletteTokens.cobaltDarkSurfaceHover;

  /// Oceanic Cobalt dark border.
  static const Color cobaltDarkBorder = GeneratedPaletteTokens.cobaltDarkBorder;

  /// Oceanic Cobalt dark strong border.
  static const Color cobaltDarkBorderStrong =
      GeneratedPaletteTokens.cobaltDarkBorderStrong;

  /// Oceanic Cobalt dark primary accent.
  static const Color cobaltDarkAccent = GeneratedPaletteTokens.cobaltDarkAccent;

  /// Oceanic Cobalt dark pressed accent.
  static const Color cobaltDarkAccentPressed =
      GeneratedPaletteTokens.cobaltDarkAccentPressed;

  /// Oceanic Cobalt dark gradient end.
  static const Color cobaltDarkBtnEnd = GeneratedPaletteTokens.cobaltDarkBtnEnd;

  /// Oceanic Cobalt dark on-primary contrast ink.
  static const Color cobaltDarkOnPrimary =
      GeneratedPaletteTokens.cobaltDarkOnPrimary;

  /// Oceanic Cobalt dark hero end.
  static const Color cobaltDarkHeroEnd =
      GeneratedPaletteTokens.cobaltDarkHeroEnd;

  /// Oceanic Cobalt light canvas.
  static const Color cobaltLightBg = GeneratedPaletteTokens.cobaltLightBg;

  /// Oceanic Cobalt light surface alt.
  static const Color cobaltLightSurfaceAlt =
      GeneratedPaletteTokens.cobaltLightSurfaceAlt;

  /// Oceanic Cobalt light hover.
  static const Color cobaltLightSurfaceHover =
      GeneratedPaletteTokens.cobaltLightSurfaceHover;

  /// Oceanic Cobalt light border.
  static const Color cobaltLightBorder =
      GeneratedPaletteTokens.cobaltLightBorder;

  /// Oceanic Cobalt light strong border.
  static const Color cobaltLightBorderStrong =
      GeneratedPaletteTokens.cobaltLightBorderStrong;

  /// Oceanic Cobalt light primary accent.
  static const Color cobaltLightAccent =
      GeneratedPaletteTokens.cobaltLightAccent;

  /// Oceanic Cobalt light pressed accent.
  static const Color cobaltLightAccentPressed =
      GeneratedPaletteTokens.cobaltLightAccentPressed;
}

/// Canonical spacing tokens from design.md Sec. 2.3.
abstract final class SpacingTokens {
  /// 4dp micro gap.
  static const double xs = GeneratedSpacingTokens.xs;

  /// 8dp small gap.
  static const double sm = GeneratedSpacingTokens.sm;

  /// 12dp card gap.
  static const double md = GeneratedSpacingTokens.md;

  /// 16dp compact card & small-screen page inset.
  static const double lg = GeneratedSpacingTokens.lg;

  /// 20dp horizontal page inset & standard card padding.
  static const double pageInset = GeneratedSpacingTokens.pageInset;

  /// 24dp section spacing.
  static const double xl = GeneratedSpacingTokens.xl;

  /// 28dp top section separation.
  static const double sectionSep = GeneratedSpacingTokens.sectionSep;

  /// 32dp generous layout padding.
  static const double xxl = GeneratedSpacingTokens.xxl;

  /// 40dp hero separation.
  static const double heroSep = GeneratedSpacingTokens.heroSep;

  /// 48dp preferred touch target size (44dp floor).
  static const double minTouchTarget = GeneratedSpacingTokens.minTouchTarget;

  /// 76dp bottom navigation bar height.
  static const double bottomNavHeight = GeneratedSpacingTokens.bottomNavHeight;

  /// 680dp max content width on tablets and wide screens.
  static const double maxContentWidth = GeneratedSpacingTokens.maxContentWidth;
}
