'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { btn, field } from '../ui';
import { CHEAP_BRAND } from '@/lib/marketing-brand';

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function NewStaticSiteForm() {
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [brand, setBrand] = useState<'stoopcraft' | typeof CHEAP_BRAND.id>('stoopcraft');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose an .html or .zip file.');
      return;
    }
    setSubmitting(true);

    const form = new FormData();
    form.append('business_name', businessName);
    form.append('slug', slug);
    form.append('brand', brand);
    form.append('file', file);

    const res = await fetch('/api/admin/static-sites', { method: 'POST', body: form });
    setSubmitting(false);

    if (res.ok) {
      const { id } = (await res.json()) as { id: string };
      router.push(`/admin/clients/${id}`);
    } else {
      const { error: code } = (await res.json().catch(() => ({}))) as { error?: string };
      setError(code ? code.replace(/_/g, ' ') : 'Upload failed.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-1">Business name</label>
        <input
          value={businessName}
          onChange={(e) => {
            setBusinessName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          required
          className={`${field} w-full`}
          placeholder="Ideal Smiles Dental"
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium mb-1">Brand</legend>
        <div className="flex gap-2">
          {([['stoopcraft', 'StoopCraft'], [CHEAP_BRAND.id, CHEAP_BRAND.name]] as const).map(([value, label]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${brand === value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-700/20'}`}
            >
              <input
                type="radio"
                name="brand"
                value={value}
                checked={brand === value}
                onChange={() => setBrand(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-700/50 mt-1">
          Sets the domain, claim bar, checkout and emails. Can be changed on the
          billing tab until the client pays.
        </p>
      </fieldset>

      <div>
        <label className="block text-sm font-medium mb-1">Slug (subdomain)</label>
        <input
          value={slug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(slugify(e.target.value));
          }}
          required
          className={`${field} w-full font-mono`}
          placeholder="ideal-smiles"
        />
        <p className="text-xs text-ink-700/50 mt-1">
          Served at <code>{slug || 'slug'}.{brand === CHEAP_BRAND.id ? CHEAP_BRAND.domain : '<platform-domain>'}</code>{' '}
          until a custom domain is attached.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">HTML file or .zip</label>
        <input
          ref={fileRef}
          type="file"
          accept=".html,.htm,.zip"
          required
          className="block w-full text-sm"
        />
        <p className="text-xs text-ink-700/50 mt-1">
          A single self-contained <code>.html</code>, or a <code>.zip</code>{' '}
          containing <code>index.html</code> + an <code>assets/</code> folder.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className={btn.primary}
      >
        {submitting ? 'Uploading…' : 'Create site'}
      </button>
    </form>
  );
}
