'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { btn, field } from './ui';

/**
 * Per-row action menu for the clients list.
 *
 * Replaces the old always-visible "Pause · Delete" text links. A permanently
 * armed red Delete on every one of ~70 rows was both the loudest thing on the
 * page and one mis-click from a hard delete; it now lives behind a menu and a
 * type-the-name modal instead of a native window.prompt().
 *
 * The menu renders through a portal because the table sits in an
 * `overflow-x-auto` container, which would clip an absolutely-positioned
 * dropdown.
 */

const MENU_WIDTH = 200;
const MENU_MAX_HEIGHT = 260;

type Props = {
  clientId: string;
  businessName: string;
  status: string;
  claimedAt: string | null;
  previewHref: string;
};

export function ClientRowActions({ clientId, businessName, status, claimedAt, previewHref }: Props) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<null | 'pause' | 'delete'>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isPaused = status === 'paused';
  // Only live/claimed/paused sites are publicly serving and thus pausable.
  const pausable = isPaused || status === 'live' || status === 'claimed';
  // Resuming restores the pre-pause public state — 'claimed' if the site was
  // ever claimed (claimed_at set), otherwise 'live'.
  const nextStatus = isPaused ? (claimedAt ? 'claimed' : 'live') : 'paused';

  const closeMenu = useCallback(() => setCoords(null), []);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const flipUp = rect.bottom + MENU_MAX_HEIGHT > window.innerHeight;
    setCoords({
      top: flipUp ? Math.max(8, rect.top - MENU_MAX_HEIGHT - 6) : rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  // Any scroll or resize invalidates the captured rect, so just close.
  useEffect(() => {
    if (!coords) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [coords, closeMenu]);

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), ok ? 2500 : 4500);
  }

  async function handlePause() {
    closeMenu();
    setBusy('pause');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        flash(data.error ?? `Failed (${res.status})`, false);
        return;
      }
      flash(isPaused ? 'Site resumed' : 'Site paused', true);
      startTransition(() => router.refresh());
    } catch (err) {
      flash(err instanceof Error ? err.message : 'network_error', false);
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy('delete');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/hard-delete`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        flash(data.error ?? `Failed (${res.status})`, false);
        setBusy(null);
        return;
      }
      setConfirmOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      flash(err instanceof Error ? err.message : 'network_error', false);
      setBusy(null);
    }
  }

  const working = busy !== null || isPending;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${businessName}`}
        aria-haspopup="menu"
        aria-expanded={coords !== null}
        disabled={working}
        onClick={() => (coords ? closeMenu() : openMenu())}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-700/60 transition-colors hover:bg-ink-900/5 hover:text-ink-900 disabled:opacity-40 aria-expanded:bg-ink-900/5 aria-expanded:text-ink-900"
      >
        {working ? (
          <span className="block h-3 w-3 animate-spin rounded-full border-[1.5px] border-ink-900/20 border-t-ink-900" />
        ) : (
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
            <circle cx="10" cy="4.5" r="1.4" />
            <circle cx="10" cy="10" r="1.4" />
            <circle cx="10" cy="15.5" r="1.4" />
          </svg>
        )}
      </button>

      {coords &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={closeMenu} />
            <div
              role="menu"
              style={{ top: coords.top, right: coords.right, width: MENU_WIDTH }}
              className="fixed z-50 overflow-hidden rounded-xl border border-ink-900/10 bg-white py-1 shadow-lg shadow-ink-900/10"
            >
              <Link
                href={`/admin/clients/${clientId}`}
                role="menuitem"
                onClick={closeMenu}
                className="block px-3 py-2 text-sm text-ink-900 transition-colors hover:bg-cream-100"
              >
                Manage client
              </Link>
              <a
                href={previewHref}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={closeMenu}
                className="flex items-center justify-between px-3 py-2 text-sm text-ink-900 transition-colors hover:bg-cream-100"
              >
                View site
                <span aria-hidden className="text-ink-700/40">
                  ↗
                </span>
              </a>

              {pausable && (
                <>
                  <div className="my-1 h-px bg-ink-900/8" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handlePause}
                    className="block w-full px-3 py-2 text-left text-sm text-ink-900 transition-colors hover:bg-cream-100"
                  >
                    {isPaused ? 'Resume site' : 'Pause site'}
                  </button>
                </>
              )}

              <div className="my-1 h-px bg-ink-900/8" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  setConfirmOpen(true);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                Delete…
              </button>
            </div>
          </>,
          document.body,
        )}

      {confirmOpen &&
        createPortal(
          <DeleteDialog
            businessName={businessName}
            busy={busy === 'delete'}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={handleDelete}
          />,
          document.body,
        )}

      {toast &&
        createPortal(
          <div
            className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-lg px-3.5 py-2 text-sm font-medium text-white shadow-lg ${
              toast.ok ? 'bg-ink-900' : 'bg-red-600'
            }`}
          >
            {toast.msg}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Type-the-name confirmation. Hard delete wipes DB rows *and* R2 photos. */
function DeleteDialog({
  businessName,
  busy,
  onCancel,
  onConfirm,
}: {
  businessName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === businessName;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={busy ? undefined : onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-client-title"
        className="relative w-full max-w-md rounded-xl border border-ink-900/10 bg-white p-5 shadow-2xl"
      >
        <h2 id="delete-client-title" className="font-display text-lg font-semibold tracking-tight">
          Delete {businessName}?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-700/80">
          This permanently wipes every database row and all R2 photos for this client. It cannot be
          undone.
        </p>

        <label className="mt-4 block text-xs font-medium text-ink-700">
          Type <span className="font-mono text-ink-900">{businessName}</span> to confirm
        </label>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          className={`${field} mt-1.5 w-full font-mono`}
        />

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || busy}
            className={btn.danger}
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
