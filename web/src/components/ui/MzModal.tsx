import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface MzModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly maxWidthClass?: string;
  readonly closeAriaLabel?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
}

export function MzModal({
  open,
  onOpenChange,
  title,
  description,
  maxWidthClass = 'max-w-lg',
  closeAriaLabel = 'Close dialog',
  children,
  footer,
}: MzModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--mz-scrim-barrier)] backdrop-blur-[2px]" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <Dialog.Content
            className={[
              'pointer-events-auto w-full max-h-[90dvh] overflow-y-auto',
              'rounded-[var(--mz-radius-card)] border border-border-strong bg-surface p-6 text-start',
              'focus:outline-none',
              maxWidthClass,
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
              <div>
                <Dialog.Title className="text-lg font-bold text-text-primary">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-1 text-sm text-text-secondary">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label={closeAriaLabel}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
            <div className="mt-4">{children}</div>
            {footer && (
              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-4">
                {footer}
              </div>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
