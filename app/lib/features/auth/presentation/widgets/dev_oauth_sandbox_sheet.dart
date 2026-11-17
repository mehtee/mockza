import 'package:flutter/material.dart';
import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_form_field.dart';
import 'package:mockza/theme/primitives.dart';

/// Opens a development-only persona picker for Google / Apple Sign-In when OAuth
/// client IDs are not yet supplied (blocked cleanly in production by backend).
Future<DevSocialPersona?> showDevOAuthSandboxSheet(
  BuildContext context, {
  required AuthProviderType provider,
}) {
  return showMzBottomSheet<DevSocialPersona>(
    context: context,
    title: 'Dev Mode: ${provider.displayLabel} Sign-In',
    child: _DevOAuthSandboxContent(provider: provider),
  );
}

class _DevOAuthSandboxContent extends StatefulWidget {
  const new({required this.provider});

  final AuthProviderType provider;

  @override
  State<_DevOAuthSandboxContent> createState() =>
      _DevOAuthSandboxContentState();
}

class _DevOAuthSandboxContentState extends State<_DevOAuthSandboxContent> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _emailController.text = '${widget.provider.wireValue}.dev@mockza.test';
    _nameController.text = '${widget.provider.displayLabel} Test User';
  }

  @override
  void dispose() {
    _emailController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final presets = <DevSocialPersona>[
      DevSocialPersona(
        sub: 'dev-${widget.provider.wireValue}-alex',
        email: 'alex.${widget.provider.wireValue}@mockza.test',
        displayName: 'Alex (${widget.provider.displayLabel})',
      ),
      DevSocialPersona(
        sub: 'dev-${widget.provider.wireValue}-sara',
        email: 'sara.${widget.provider.wireValue}@mockza.test',
        displayName: 'Sara (${widget.provider.displayLabel})',
      ),
    ];

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'Development sandbox mode is active because real ${widget.provider.displayLabel} client tokens are not configured yet. Choose a quick test persona or customize below:',
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),
          ...presets.map(
            (persona) => Padding(
              padding: const EdgeInsetsDirectional.only(
                bottom: SpacingTokens.sm,
              ),
              child: MzCard(
                onTap: () => Navigator.of(context).pop(persona),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            persona.displayName,
                            style: typography.body.copyWith(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            persona.email,
                            style: typography.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      'Use ->',
                      style: typography.caption.copyWith(
                        color: colors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const Divider(height: SpacingTokens.xl),
          MzFormField(
            label: 'Custom Sandbox Email',
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: SpacingTokens.md),
          MzFormField(
            label: 'Display Name',
            controller: _nameController,
          ),
          const SizedBox(height: SpacingTokens.lg),
          PrimaryButton(
            label: 'Continue with ${widget.provider.displayLabel} (Dev)',
            onPressed: () {
              final email = _emailController.text.trim().toLowerCase();
              final safeEmail = email.contains('@')
                  ? email
                  : '${widget.provider.wireValue}.dev@mockza.test';
              final name = _nameController.text.trim().isNotEmpty
                  ? _nameController.text.trim()
                  : 'Mockza Dev';
              Navigator.of(context).pop(
                DevSocialPersona(
                  sub: 'dev-${widget.provider.wireValue}-${safeEmail.hashCode}',
                  email: safeEmail,
                  displayName: name,
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
