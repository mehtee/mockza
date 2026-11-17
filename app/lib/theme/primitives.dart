import 'dart:ui';

/// Canonical raw design tokens from design.md Sec. 2 & 12 (strictly confined to `lib/theme/`).
abstract final class PalettePrimitives {
  // --- Canonical Dark Palette: Midnight Indigo (Primary Mode) ---
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

  // Midnight Indigo Gradient Stops (Dark)
  /// Primary CTA start (`#6B8CFF`).
  static const Color indigoBtnStart = Color(0xFF6B8CFF);

  /// Primary CTA end (`#8D70F7`).
  static const Color indigoBtnEnd = Color(0xFF8D70F7);

  /// Score fill start (`#6CCEFF`).
  static const Color indigoScoreStart = Color(0xFF6CCEFF);

  /// Score fill end (`#917AFB`).
  static const Color indigoScoreEnd = Color(0xFF917AFB);

  /// Hero card gradient stop 1 (`#222840`).
  static const Color indigoHero1 = Color(0xFF222840);

  /// Hero card gradient stop 2 (`#1C2036`).
  static const Color indigoHero2 = Color(0xFF1C2036);

  /// Hero card gradient stop 3 (`#28234C`).
  static const Color indigoHero3 = Color(0xFF28234C);

  /// Recommendation card start (`#252841`).
  static const Color indigoRecStart = Color(0xFF252841);

  /// Recommendation card end (`#211F38`).
  static const Color indigoRecEnd = Color(0xFF211F38);

  // --- Canonical Light Palette: Midnight Indigo ---
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

  /// Light tertiary hints and captions (`#64708D`, WCAG-AA legible).
  static const Color lightTextTertiary = Color(0xFF64708D);

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

  /// Light hero card middle stop (`#E8ECF7`).
  static const Color lightHeroMid = Color(0xFFE8ECF7);

  /// Light hero card end stop (`#E2E7F5`).
  static const Color lightHeroEnd = Color(0xFFE2E7F5);

  /// Pure white foreground on vibrant surfaces.
  static const Color white = Color(0xFFFFFFFF);

  // --- Preset 2: Nordic Emerald (Forest Obsidian & Calm Sage) ---
  /// Nordic Emerald dark canvas.
  static const Color emeraldDarkBg = Color(0xFF081210);

  /// Nordic Emerald dark raised surface.
  static const Color emeraldDarkRaised = Color(0xFF0E1B18);

  /// Nordic Emerald dark surface.
  static const Color emeraldDarkSurface = Color(0xFF142420);

  /// Nordic Emerald dark alt surface.
  static const Color emeraldDarkSurfaceAlt = Color(0xFF1C302B);

  /// Nordic Emerald dark hover surface.
  static const Color emeraldDarkSurfaceHover = Color(0xFF253E38);

  /// Nordic Emerald dark border.
  static const Color emeraldDarkBorder = Color(0xFF2A453E);

  /// Nordic Emerald dark strong border.
  static const Color emeraldDarkBorderStrong = Color(0xFF3E6158);

  /// Nordic Emerald dark primary accent.
  static const Color emeraldDarkAccent = Color(0xFF34D399);

  /// Nordic Emerald dark pressed accent.
  static const Color emeraldDarkAccentPressed = Color(0xFF10B981);

  /// Nordic Emerald dark on-primary contrast ink.
  static const Color emeraldDarkOnPrimary = Color(0xFF042219);

  /// Nordic Emerald dark secondary CTA start gradient.
  static const Color emeraldDarkBtnEnd = Color(0xFF14B8A6);

  /// Nordic Emerald dark hero end.
  static const Color emeraldDarkHeroEnd = Color(0xFF1A3A32);

  /// Nordic Emerald light canvas.
  static const Color emeraldLightBg = Color(0xFFF4F9F7);

  /// Nordic Emerald light surface alt.
  static const Color emeraldLightSurfaceAlt = Color(0xFFE8F3EE);

  /// Nordic Emerald light hover.
  static const Color emeraldLightSurfaceHover = Color(0xFFD7EAE2);

  /// Nordic Emerald light border.
  static const Color emeraldLightBorder = Color(0xFFC8DED5);

  /// Nordic Emerald light strong border.
  static const Color emeraldLightBorderStrong = Color(0xFF9EC4B6);

  /// Nordic Emerald light primary accent.
  static const Color emeraldLightAccent = Color(0xFF0F766E);

  /// Nordic Emerald light pressed accent.
  static const Color emeraldLightAccentPressed = Color(0xFF115E59);

  // --- Preset 3: Editorial Amber (Warm Charcoal & Paper Sand) ---
  /// Editorial Amber dark canvas.
  static const Color amberDarkBg = Color(0xFF11100E);

  /// Editorial Amber dark raised surface.
  static const Color amberDarkRaised = Color(0xFF181613);

  /// Editorial Amber dark card surface.
  static const Color amberDarkSurface = Color(0xFF201D18);

  /// Editorial Amber dark alt surface.
  static const Color amberDarkSurfaceAlt = Color(0xFF2A261F);

  /// Editorial Amber dark hover surface.
  static const Color amberDarkSurfaceHover = Color(0xFF363128);

  /// Editorial Amber dark border.
  static const Color amberDarkBorder = Color(0xFF3D372E);

  /// Editorial Amber dark strong border.
  static const Color amberDarkBorderStrong = Color(0xFF5A5143);

  /// Editorial Amber dark primary accent.
  static const Color amberDarkAccent = Color(0xFFF5B749);

  /// Editorial Amber dark pressed accent.
  static const Color amberDarkAccentPressed = Color(0xFFD99B2B);

  /// Editorial Amber dark secondary gradient end.
  static const Color amberDarkBtnEnd = Color(0xFFE07A5F);

  /// Editorial Amber dark on-primary contrast ink.
  static const Color amberDarkOnPrimary = Color(0xFF1A1407);

  /// Editorial Amber dark hero end.
  static const Color amberDarkHeroEnd = Color(0xFF342A1B);

  /// Editorial Amber light canvas.
  static const Color amberLightBg = Color(0xFFFAF8F4);

  /// Editorial Amber light surface alt.
  static const Color amberLightSurfaceAlt = Color(0xFFF2ECE1);

  /// Editorial Amber light hover.
  static const Color amberLightSurfaceHover = Color(0xFFE8DFCE);

  /// Editorial Amber light border.
  static const Color amberLightBorder = Color(0xFFDFD5C3);

  /// Editorial Amber light strong border.
  static const Color amberLightBorderStrong = Color(0xFFC4B69F);

  /// Editorial Amber light primary accent (WCAG AA compliant vs white).
  static const Color amberLightAccent = Color(0xFF9A5B13);

  /// Editorial Amber light pressed accent.
  static const Color amberLightAccentPressed = Color(0xFF7D480C);

  // --- Preset 4: Oceanic Cobalt (Deep Marine Slate & Ice Mist) ---
  /// Oceanic Cobalt dark canvas.
  static const Color cobaltDarkBg = Color(0xFF07111C);

  /// Oceanic Cobalt dark raised surface.
  static const Color cobaltDarkRaised = Color(0xFF0D1A29);

  /// Oceanic Cobalt dark card surface.
  static const Color cobaltDarkSurface = Color(0xFF132438);

  /// Oceanic Cobalt dark alt surface.
  static const Color cobaltDarkSurfaceAlt = Color(0xFF1B3048);

  /// Oceanic Cobalt dark hover surface.
  static const Color cobaltDarkSurfaceHover = Color(0xFF243D5A);

  /// Oceanic Cobalt dark border.
  static const Color cobaltDarkBorder = Color(0xFF2C4868);

  /// Oceanic Cobalt dark strong border.
  static const Color cobaltDarkBorderStrong = Color(0xFF42658F);

  /// Oceanic Cobalt dark primary accent.
  static const Color cobaltDarkAccent = Color(0xFF56CCF2);

  /// Oceanic Cobalt dark pressed accent.
  static const Color cobaltDarkAccentPressed = Color(0xFF2FAAD4);

  /// Oceanic Cobalt dark gradient end.
  static const Color cobaltDarkBtnEnd = Color(0xFF4F8DFD);

  /// Oceanic Cobalt dark on-primary contrast ink.
  static const Color cobaltDarkOnPrimary = Color(0xFF041826);

  /// Oceanic Cobalt dark hero end.
  static const Color cobaltDarkHeroEnd = Color(0xFF1B3654);

  /// Oceanic Cobalt light canvas.
  static const Color cobaltLightBg = Color(0xFFF4F8FC);

  /// Oceanic Cobalt light surface alt.
  static const Color cobaltLightSurfaceAlt = Color(0xFFE7F0FA);

  /// Oceanic Cobalt light hover.
  static const Color cobaltLightSurfaceHover = Color(0xFFD6E6F7);

  /// Oceanic Cobalt light border.
  static const Color cobaltLightBorder = Color(0xFFC7DAF0);

  /// Oceanic Cobalt light strong border.
  static const Color cobaltLightBorderStrong = Color(0xFF9DBFE6);

  /// Oceanic Cobalt light primary accent.
  static const Color cobaltLightAccent = Color(0xFF0B69A3);

  /// Oceanic Cobalt light pressed accent.
  static const Color cobaltLightAccentPressed = Color(0xFF085382);
}

/// Canonical spacing tokens from design.md Sec. 2.3.
abstract final class SpacingTokens {
  /// 4dp micro gap.
  static const double xs = 4;

  /// 8dp small gap.
  static const double sm = 8;

  /// 12dp card gap.
  static const double md = 12;

  /// 16dp compact card & small-screen page inset.
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
