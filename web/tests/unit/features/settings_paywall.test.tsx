import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioRecorderAdapter } from '@/adapters/fakes';
import type { FakeAuthAdapter } from '@/adapters/fakes/fake-auth.adapter';
import type { FakeBillingAdapter } from '@/adapters/fakes/fake-billing.adapter';
import { createTestDependencies } from '@/composition/bootstrap-test';
import type { AppDependencies } from '@/composition/container';
import { AppDependenciesProvider } from '@/spa/deps';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { PaywallScreen } from '@/spa/features/paywall/PaywallScreen';
import { createAppRouter } from '@/spa/router';

function renderWithPaywallRouter(deps: AppDependencies, element: ReactNode) {
  const testRootRoute = createRootRoute({
    component: () => (
      <AppDependenciesProvider dependencies={deps}>{element}</AppDependenciesProvider>
    ),
  });
  const testIndex = createRoute({
    getParentRoute: () => testRootRoute,
    path: '/',
    component: () => null,
  });
  const router = createRouter({
    routeTree: testRootRoute.addChildren([testIndex]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return render(<RouterProvider router={router} />);
}

describe('W2.3 Settings Active Devices Manager & Paywall Checkout', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    window.localStorage.clear();
    delete document.documentElement.dataset['theme'];
    delete document.documentElement.dataset['mode'];
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('displays 1 Phone + 1 Desktop Web sessions in Settings and revokes remote mobile device', async () => {
    const deps = createTestDependencies({ edition: 'glb', allowDevAuth: true });
    const fakeAuth = deps.auth as FakeAuthAdapter;
    const mobileSlot = fakeAuth.seedOccupyingDesktopSession('pro@mockza.com', {
      sessionId: 'sess-mobile-1',
      deviceId: '22222222-2222-4222-8222-222222222222',
      slotKind: 'mobile',
      platform: 'ios',
      appSurface: 'flutter_app',
      deviceName: 'iPhone 16 Pro',
      locationLabel: 'Toronto, CA',
    });
    const signInRes = await deps.auth.signInWithEmail({
      email: 'pro@mockza.com',
      password: 'password123',
    });
    expect(signInRes.ok).toBe(true);

    const history = createMemoryHistory({ initialEntries: ['/app/settings'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-screen')).toBeTruthy();
      expect(screen.getByText('iPhone 16 Pro')).toBeTruthy();
      expect(screen.getByText('Fake Desktop Browser')).toBeTruthy();
      expect(screen.getByText('This Browser')).toBeTruthy();
    });

    // Both Mobile Phone and Desktop Web slot badges show 1 / 1 Active
    expect(screen.getAllByText('1 / 1 Active').length).toBe(2);

    // Revoke the remote mobile session -> frees mobile slot while keeping Desktop Web
    const revokeMobileBtn = screen.getByRole('button', {
      name: /Revoke Device iPhone 16 Pro/,
    });
    fireEvent.click(revokeMobileBtn);

    await waitFor(() => {
      expect(screen.queryByTestId(`device-session-${mobileSlot.deviceId}`)).toBeNull();
      expect(screen.getByText('Fake Desktop Browser')).toBeTruthy();
      expect(screen.getByText('0 / 1 Open')).toBeTruthy();
    });
  });

  it('switches exam track, updates theme preset, runs mic preflight, and erases account data', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const fakeMic = deps.audioRecorder as FakeAudioRecorderAdapter;
    fakeMic.setSimulatedPeakRms(0.42);
    await deps.auth.signUpWithEmail({
      email: 'wipe@mockza.com',
      password: 'password123',
    });

    const history = createMemoryHistory({ initialEntries: ['/app/settings'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-track-toefl_ibt')).toBeTruthy();
    });

    // Switch exam track -> TOEFL iBT 2026 shows legacy /120 concordance
    fireEvent.click(screen.getByTestId('settings-track-toefl_ibt'));
    await waitFor(() => {
      expect(screen.getByText(/legacy TOEFL scale/)).toBeTruthy();
      expect(screen.getByTestId('settings-target-value').textContent).toBe('5.0');
    });

    fireEvent.click(screen.getByTestId('settings-target-inc'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-target-value').textContent).toBe('5.5');
    });

    // Switch appearance mode & preset -> updates document.documentElement dataset + Dexie
    fireEvent.click(screen.getByRole('tab', { name: 'Light' }));
    fireEvent.click(screen.getByTestId('settings-preset-nordic_emerald'));
    await waitFor(() => {
      expect(document.documentElement.dataset['mode']).toBe('light');
      expect(document.documentElement.dataset['theme']).toBe('nordic_emerald');
    });

    // Run 2s mic check -> shows RMS percentage
    fireEvent.click(screen.getByTestId('settings-mic-check-btn'));
    await waitFor(() => {
      expect(screen.getByText('42%')).toBeTruthy();
    });

    // Trigger Danger Zone deletion -> shows erasure receipt banner and resets session
    fireEvent.click(screen.getByTestId('settings-delete-account-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-confirm-delete-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('settings-confirm-delete-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Account and local study data erased/)).toBeTruthy();
    });
    const postWipeSession = await deps.auth.getSession();
    expect(postWipeSession.ok && postWipeSession.value).toBeNull();
  });

  it('enforces 1+1 ToS consent on GLB Paywall, starts checkout, and verifies Stripe callback', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    await deps.auth.signUpWithEmail({
      email: 'checkout@mockza.com',
      password: 'password123',
    });

    const redirectSpy = vi.fn<(url: string) => void>();

    const { unmount } = renderWithPaywallRouter(
      deps,
      <PaywallScreen
        returnUrl="https://mockza.com/app/paywall"
        onExternalRedirect={redirectSpy}
      />,
    );

    const checkoutBtn = (await screen.findByTestId('paywall-checkout-btn')) as HTMLButtonElement;
    expect(checkoutBtn.disabled).toBe(true);
    expect(screen.getByText('$19.99')).toBeTruthy();

    // Check ToS box -> button enables & triggers checkout redirect
    fireEvent.click(screen.getByTestId('paywall-tos-checkbox'));
    expect(checkoutBtn.disabled).toBe(false);

    fireEvent.click(screen.getByTestId('paywall-plan-mockza_quarterly'));
    fireEvent.click(checkoutBtn);

    await waitFor(() => {
      expect(redirectSpy).toHaveBeenCalledWith(
        'https://mockza.com/app/paywall?session_id=fake-cs-001',
      );
    });

    // Verify 1+1 policy consent timestamp recorded on account
    const consentSession = await deps.auth.getSession();
    expect(consentSession.ok && Boolean(consentSession.value?.user?.acceptedDevicePolicyAt)).toBe(
      true,
    );

    // Simulate returning from Stripe callback -> verifies entitlement and shows Manage Subscription portal CTA
    unmount();
    renderWithPaywallRouter(
      deps,
      <PaywallScreen callbackSearch="?session_id=fake-cs-001" onExternalRedirect={redirectSpy} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Pro subscription activated/)).toBeTruthy();
      expect(screen.getByTestId('paywall-portal-btn')).toBeTruthy();
    });
  });

  it('renders IRN Rial/Toman plans on Paywall and handles Zarinpal OK + NOK callbacks', async () => {
    const deps = createTestDependencies({ edition: 'irn' });
    await deps.auth.requestSmsOtp?.({ phoneE164: '+989123456789' });
    const billing = deps.billing as FakeBillingAdapter;
    const startSpy = vi.spyOn(billing, 'startCheckout');

    const redirectSpy = vi.fn<(url: string) => void>();
    const { unmount } = renderWithPaywallRouter(
      deps,
      <PaywallScreen
        returnUrl="https://sanjia.ir/app/paywall"
        onExternalRedirect={redirectSpy}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('paywall-screen')).toBeTruthy();
      expect(screen.getAllByText(/تومان/).length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByTestId('paywall-tos-checkbox'));
    fireEvent.click(screen.getByTestId('paywall-checkout-btn'));

    await waitFor(() => {
      expect(startSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          acceptedSingleDevicePerSlotTos: true,
        }),
      );
      expect(redirectSpy).toHaveBeenCalledWith(
        'https://sanjia.ir/app/paywall?Authority=fake-auth-001&Status=OK',
      );
    });

    // Simulate cancelled Zarinpal callback first (?Status=NOK)
    unmount();
    renderWithPaywallRouter(
      deps,
      <PaywallScreen callbackSearch="?Authority=fake-auth-001&Status=NOK" />,
    );
    await waitFor(() => {
      expect(screen.getByText(/پیش از تکمیل لغو شد/)).toBeTruthy();
    });

    // Simulate successful Zarinpal callback (?Status=OK)
    cleanup();
    renderWithPaywallRouter(
      deps,
      <PaywallScreen callbackSearch="?Authority=fake-auth-001&Status=OK" />,
    );
    await waitFor(() => {
      expect(screen.getByText(/با موفقیت فعال شد/)).toBeTruthy();
    });
  });
});
