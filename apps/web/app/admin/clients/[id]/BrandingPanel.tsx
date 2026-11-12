'use client';

import { useState } from 'react';
import { LogoUploader } from './LogoUploader';

export function BrandingPanel({
  clientId,
  currentDisplayName,
  currentBlogTitle,
  fallbackName,
  currentLogoUrl,
}: {
  clientId: string;
  currentDisplayName: string | null;
  currentBlogTitle: string | null;
  fallbackName: string;
  currentLogoUrl: string | null;
}) {
  const [name, setName] = useState(currentDisplayName ?? '');
  const [saved, setSaved] = useState(currentDisplayName ?? '');
  const [blogTitle, setBlogTitle] = useState(currentBlogTitle ?? '');
  const [savedBlogTitle, setSavedBlogTitle] = useState(currentBlogTitle ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name.trim() !== (saved ?? '') || blogTitle.trim() !== (savedBlogTitle ?? '');

  async function handleSave() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/display-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_display_name: name.trim(), blog_title: blogTitle.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        business_display_name?: string | null;
        blog_title?: string | null;
      };
      if (!res.ok) {
        setError(data.error ?? 'failed');
        return;
      }
      setSaved(data.business_display_name ?? '');
      setName(data.business_display_name ?? '');
      setSavedBlogTitle(data.blog_title ?? '');
      setBlogTitle(data.blog_title ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-ink-900/10 p-6 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="font-display text-lg font-medium mb-1">Blog branding</h2>
      <p className="text-xs text-ink-700 mb-4">
        Controls how this client is shown on customer-facing surfaces like the blog masthead. The display
        name is separate from the internal business name (used by emails &amp; templates), so editing it here
        won&apos;t affect anything else.
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Display name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={fallbackName}
            className="mt-1 block w-full border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <span className="text-xs text-ink-700/60 mt-1 block">
            Leave blank to use the internal name (<strong>{fallbackName}</strong>).
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Blog title</span>
          <input
            type="text"
            value={blogTitle}
            onChange={(e) => setBlogTitle(e.target.value)}
            placeholder="The Blog"
            className="mt-1 block w-full border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <span className="text-xs text-ink-700/60 mt-1 block">
            Heading shown on the blog index (e.g. <strong>From The Tip Jar</strong>). Leave blank for the
            default (<strong>The Blog</strong>).
          </span>
        </label>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || !dirty}
            className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving…' : 'Save branding'}
          </button>
          {!dirty && (saved || savedBlogTitle) && (
            <span className="text-sm text-emerald-700">Saved</span>
          )}
          {error && <span className="text-sm text-red-700">Error: {error}</span>}
        </div>

        <div className="pt-2 border-t border-ink-900/10">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700 mb-2 block">Logo</span>
          <LogoUploader clientId={clientId} currentUrl={currentLogoUrl} />
        </div>
      </div>
    </div>
  );
}
