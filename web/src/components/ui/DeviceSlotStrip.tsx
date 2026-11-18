import { Monitor, Smartphone, Trash2 } from 'lucide-react';
import type { ActiveDeviceSlot } from '@/gateways/auth.gateway';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import type { EditionCode } from '@/edition/edition-config';
import { MzButton } from './MzButton';

export interface DeviceSlotStripProps {
  readonly mobileOccupied: boolean;
  readonly desktopWebOccupied: boolean;
  readonly mobileTitle: string;
  readonly desktopTitle: string;
  readonly activeLabel: string;
  readonly openLabel: string;
}

export function DeviceSlotStrip({
  mobileOccupied,
  desktopWebOccupied,
  mobileTitle,
  desktopTitle,
  activeLabel,
  openLabel,
}: DeviceSlotStripProps) {
  const slots = [
    {
      key: 'mobile',
      Icon: Smartphone,
      title: mobileTitle,
      occupied: mobileOccupied,
    },
    {
      key: 'desktop',
      Icon: Monitor,
      title: desktopTitle,
      occupied: desktopWebOccupied,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {slots.map(({ key, Icon, title, occupied }) => (
        <div
          key={key}
          className={[
            'flex items-center gap-3 rounded-[var(--mz-radius-control)] border p-3 text-start',
            occupied
              ? 'border-primary bg-surface-alt'
              : 'border-border-subtle bg-bg-raised',
          ].join(' ')}
        >
          <Icon
            className={['h-5 w-5 shrink-0', occupied ? 'text-primary' : 'text-text-tertiary'].join(' ')}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-text-primary">{title}</p>
            <p
              className={[
                'truncate text-xs font-medium',
                occupied ? 'text-primary' : 'text-text-secondary',
              ].join(' ')}
            >
              {occupied ? activeLabel : openLabel}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export interface DeviceSessionCardProps {
  readonly session: ActiveDeviceSlot;
  readonly edition: EditionCode;
  readonly currentBadgeLabel: string;
  readonly mobileLabel: string;
  readonly desktopLabel: string;
  readonly revokeLabel: string;
  readonly isRevoking?: boolean;
  readonly onRevoke?: (sessionId: string) => void;
}

export function DeviceSessionCard({
  session,
  edition,
  currentBadgeLabel,
  mobileLabel,
  desktopLabel,
  revokeLabel,
  isRevoking = false,
  onRevoke,
}: DeviceSessionCardProps) {
  const isDesktop = session.slotKind === 'desktop_web';
  const Icon = isDesktop ? Monitor : Smartphone;
  const lastSeenTimestamp = Date.parse(session.lastSeenAt);
  const formattedLastSeen = Number.isFinite(lastSeenTimestamp)
    ? formatDisplayDate(lastSeenTimestamp, edition)
    : session.lastSeenAt;

  return (
    <div
      data-testid={`device-session-${session.deviceId}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised p-3.5 text-start"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface-alt text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">
              {session.deviceName}
            </p>
            <span className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-text-secondary">
              {isDesktop ? desktopLabel : mobileLabel}
            </span>
            {session.isCurrentDevice && (
              <span className="rounded-[var(--mz-radius-pill)] bg-mint-bg px-2 py-0.5 text-[11px] font-semibold text-success">
                {currentBadgeLabel}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-text-secondary">
            {session.locationLabel} · <span className="font-mono-exam">{session.deviceIdShort}</span> · {formattedLastSeen}
          </p>
        </div>
      </div>

      {onRevoke && (
        <MzButton
          variant="ghost"
          size="sm"
          isLoading={isRevoking}
          leadingIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => onRevoke(session.sessionId)}
          aria-label={`${revokeLabel} ${session.deviceName}`}
        >
          {revokeLabel}
        </MzButton>
      )}
    </div>
  );
}
