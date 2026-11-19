import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FakeAuthAdapter } from '@/adapters/fakes/fake-auth.adapter';
import { createTestDependencies } from '@/composition/bootstrap-test';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';

describe('W2.2 Desktop AuthScreen & 409 Slot Takeover', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('registers via GLB Email Sign-Up and opens Dev Sandbox Google OAuth persona modal', async () => {
    const deps = createTestDependencies({ edition: 'glb', allowDevAuth: true });
    const history = createMemoryHistory({ initialEntries: ['/app/auth/login'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-screen')).toBeTruthy();
      expect(screen.getByTestId('auth-google-btn')).toBeTruthy();
    });

    // Trigger Google Dev Sandbox persona picker modal -> select persona -> lands on /app/home
    fireEvent.click(screen.getByTestId('auth-google-btn'));
    await waitFor(() => {
      expect(screen.getByText('Aria Chen (band 7.5 learner)')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Aria Chen (band 7.5 learner)'));

    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeTruthy();
    });
    const session = await deps.auth.getSession();
    expect(session.ok && session.value?.isAuthenticated).toBe(true);
    expect(session.ok && session.value?.user?.linkedProviders).toContain('google');
  });

  it('shows 409 DEVICE_SLOT_OCCUPIED takeover dialog and replaces previous browser in 1 click', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const fakeAuth = deps.auth as FakeAuthAdapter;
    fakeAuth.seedOccupyingDesktopSession('learner@mockza.com', {
      deviceName: 'Safari on MacBook Pro',
      locationLabel: 'Berlin, DE',
    });

    const history = createMemoryHistory({ initialEntries: ['/app/auth/login'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-email-input')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'learner@mockza.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('auth-email-submit'));

    // Conflict modal appears with occupying browser details
    await waitFor(() => {
      expect(screen.getByTestId('auth-slot-replace-btn')).toBeTruthy();
      expect(screen.getAllByText(/Safari on MacBook Pro/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Berlin, DE/).length).toBeGreaterThanOrEqual(1);
    });

    // Click "Sign Out Previous Browser & Continue" -> replaces slot and navigates to /home
    fireEvent.click(screen.getByTestId('auth-slot-replace-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeTruthy();
    });
    const session = await deps.auth.getSession();
    expect(session.ok && session.value?.isAuthenticated).toBe(true);
  });

  it('displays 401 session revoked notice when ?reason=session_revoked is present', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const history = createMemoryHistory({
      initialEntries: ['/app/auth/login?reason=session_revoked'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Your desktop session was signed out from another device/),
      ).toBeTruthy();
    });
  });

  it('completes IRN +98 SMS OTP flow inside LtrExamBoundary', async () => {
    const deps = createTestDependencies({ edition: 'irn', allowDevAuth: true });
    const history = createMemoryHistory({ initialEntries: ['/app/auth/login'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-phone-input')).toBeTruthy();
    });

    // Verify phone input stays isolated in LTR inside IRN chrome
    const phoneInput = screen.getByTestId('auth-phone-input') as HTMLInputElement;
    expect(phoneInput.getAttribute('dir')).toBe('ltr');
    expect(phoneInput.closest('[dir="ltr"]')).toBeTruthy();

    fireEvent.change(phoneInput, { target: { value: '09123456789' } });
    fireEvent.click(screen.getByTestId('auth-otp-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-otp-input')).toBeTruthy();
    });

    const otpInput = screen.getByTestId('auth-otp-input') as HTMLInputElement;
    expect(otpInput.getAttribute('dir')).toBe('ltr');
    fireEvent.change(otpInput, { target: { value: '۱۲۳۴۵۶' } });
    fireEvent.click(screen.getByTestId('auth-otp-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeTruthy();
    });
    const session = await deps.auth.getSession();
    expect(session.ok && session.value?.user?.linkedProviders).toContain('sms_otp');
  });

  it('normalizes Persian digits in Iranian mobile input ۰۹۱۲... to +989... before OTP challenge', async () => {
    const deps = createTestDependencies({ edition: 'irn', allowDevAuth: true });
    const history = createMemoryHistory({ initialEntries: ['/app/auth/login'] });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-phone-input')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('auth-phone-input'), {
      target: { value: '۰۹۱۲۳۴۵۶۷۸۹' },
    });
    fireEvent.click(screen.getByTestId('auth-otp-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-otp-input')).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId('auth-otp-input'), { target: { value: '۱۲۳۴۵۶' } });
    fireEvent.click(screen.getByTestId('auth-otp-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('home-screen')).toBeTruthy();
    });
    const session = await deps.auth.getSession();
    expect(session.ok && session.value?.user?.phoneE164).toBe('+989123456789');
  });

  it('normalizes returnTo=/app/settings after login and redirects on session revocation', async () => {
    const deps = createTestDependencies({ edition: 'glb', allowDevAuth: true });
    const fakeAuth = deps.auth as FakeAuthAdapter;
    const history = createMemoryHistory({
      initialEntries: ['/app/auth/login?returnTo=%2Fapp%2Fsettings'],
    });
    const router = createAppRouter(history);

    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('auth-google-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('auth-google-btn'));
    await waitFor(() => {
      expect(screen.getByText('Aria Chen (band 7.5 learner)')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('Aria Chen (band 7.5 learner)'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-screen')).toBeTruthy();
    });

    // Simulate remote session revocation while signed in on Settings -> auto-redirects to /app/auth/login?reason=session_revoked
    fakeAuth.simulateRemoteSessionRevoked();

    await waitFor(() => {
      expect(screen.getByTestId('auth-screen')).toBeTruthy();
      expect(
        screen.getByText(/Your desktop session was signed out from another device/),
      ).toBeTruthy();
    });
  });
});
