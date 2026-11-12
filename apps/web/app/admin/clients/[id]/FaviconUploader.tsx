'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function FaviconUploader({ clientId, currentUrl }: { clientId: string; currentUrl: string | null }) {
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
    form.append('favicon', file);

    const res = await fetch(`/api/admin/clients/${clientId}/favicon`, {
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
    if (!confirm('Remove this favicon?')) return;
    setRemoving(true);

    await fetch(`/api/admin/clients/${clientId}/favicon`, { method: 'DELETE' });

    setPreview(null);
    setRemoving(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className="w-16 h-16 border-2 border-dashed border-gray-200 rounded flex items-center justify-center bg-gray-50 cursor-pointer hover:border-gray-400 transition-colors shrink-0"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="favicon" className="w-12 h-12 object-contain" />
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
          {uploading ? 'Uploading…' : preview ? 'Replace' : 'Upload favicon'}
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
        <p className="text-xs text-gray-400">PNG, JPG, or WebP · shown at 64×64px</p>
      </div>
    </div>
  );
}
