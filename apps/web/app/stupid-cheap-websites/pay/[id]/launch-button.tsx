'use client';

import { useState } from 'react';
import styles from '../../page.module.css';

export function LaunchButton({ clientId, label }: { clientId: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launch() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/pay/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'scw' }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(
          data.error === 'already_active' ? 'This website is already live.'
            : data.error === 'rate_limited' ? 'Too many attempts. Please try again in a few minutes.'
              : 'Something went wrong. Please try again.',
        );
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return <div>
    <button type="button" className={styles.button} onClick={launch} disabled={loading}>
      {loading ? 'Opening secure checkout…' : label}<span aria-hidden="true">↗</span>
    </button>
    {error && <p className={styles.activateError} role="alert">{error}</p>}
  </div>;
}
