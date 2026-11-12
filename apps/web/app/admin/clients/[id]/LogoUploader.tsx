'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function LogoUploader({ clientId, currentUrl }: { clientId: string; currentUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setUploading(true);

    const form = new FormData();
    form.append('logo', file);

    const res = await fetch(`/api/admin/clients/${clientId}/logo`, {
      method: 'POST',
      body: form,
    });

    setUploading(false);

    if (res.ok) {
      router.refresh();
    } else {
      setPreview(currentUrl);
      alert('Upload failed — check console for details.');
    }
  }

  async function handleRemove() {
    if (!confirm('Remove this logo?')) return;
    setRemoving(true);

    await fetch(`/api/admin/clients/${clientId}/logo`, { method: 'DELETE' });

    setPreview(null);
    setRemoving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className="h-16 min-w-[8rem] px-3 border-2 border-dashed border-gray-200 rounded flex items-center justify-center bg-gray-50 cursor-pointer hover:border-gray-400 transition-colors shrink-0"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="logo" className="max-h-12 w-auto object-contain" />
        ) : (
          <span className="text-2xl text-gray-300">+</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="border rounded px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : preview ? 'Replace' : 'Upload logo'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-red-500 hover:underline disabled:opacity-50 text-left"
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        )}
        <p className="text-xs text-gray-400">PNG, JPG, WebP, or SVG · capped at 40px height in nav</p>
      </div>
    </div>
  );
}
