'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NewPostButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function create() {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/blog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t }),
      });
      const data = (await res.json()) as { post?: { id: string }; error?: string };
      if (res.ok && data.post?.id) {
        router.push(`/admin/clients/${clientId}/blog/${data.post.id}`);
        return;
      }
      alert(`Failed to create post: ${data.error ?? 'unknown'}`);
    } catch {
      alert('Failed to create post (network).');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 transition-colors"
      >
        + New post
      </button>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
        placeholder="Post title…"
        className="border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white w-64"
      />
      <button
        type="button"
        onClick={create}
        disabled={busy || !title.trim()}
        className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Creating…' : 'Create'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-ink-700/60 hover:text-ink-900 px-2"
      >
        Cancel
      </button>
    </div>
  );
}
