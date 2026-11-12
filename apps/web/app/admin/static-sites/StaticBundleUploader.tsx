'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { btn } from '../ui';

// Replace the uploaded bundle for an existing static client.
export function StaticBundleUploader({ clientId }: { clientId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/admin/clients/${clientId}/static-bundle`, {
      method: 'POST',
      body: form,
    });

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    if (res.ok) {
      router.refresh();
    } else {
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      alert(`Replace failed: ${error ?? 'unknown error'}`);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".html,.htm,.zip"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={btn.secondarySm}
      >
        {uploading ? 'Uploading…' : 'Replace files'}
      </button>
    </>
  );
}
