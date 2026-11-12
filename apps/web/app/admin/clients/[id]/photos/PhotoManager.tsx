'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Photo = {
  id: string;
  r2_key: string;
  alt_text: string | null;
  source: string;
  position: number;
  bytes: number | null;
};

export function PhotoManager({
  clientId,
  initialPhotos,
  r2PublicUrl,
  // Defaults to the legacy beauty cap so existing callers stay byte-identical.
  // Pass 24 (or whatever the vertical needs) for restaurant clients.
  maxPhotos = 12,
}: {
  clientId: string;
  initialPhotos: Photo[];
  r2PublicUrl: string;
  maxPhotos?: number;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingOrder, startSaveOrder] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_PHOTOS = maxPhotos;
  const remaining = MAX_PHOTOS - photos.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(photos, oldIndex, newIndex);
    setPhotos(next);

    const order = next.map((p) => p.id);
    startSaveOrder(async () => {
      const res = await fetch(`/api/admin/clients/${clientId}/photos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) {
        // Roll back on failure so the UI doesn't lie about persisted state.
        setPhotos(photos);
        alert('Reorder failed.');
      } else {
        router.refresh();
      }
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    for (const f of Array.from(files)) form.append('photos', f);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/photos`, {
        method: 'POST',
        body: form,
      });
      const data = (await res.json()) as {
        stored?: number;
        skipped?: number;
        errors?: string[];
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setUploadError(data.message ?? data.error ?? 'Upload failed');
      } else if (data.errors && data.errors.length > 0) {
        setUploadError(`${data.stored ?? 0} uploaded · ${data.errors.join(' · ')}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDelete(photoId: string) {
    if (!confirm('Delete this photo?')) return;
    const before = photos;
    setPhotos((arr) => arr.filter((p) => p.id !== photoId));
    const res = await fetch(`/api/admin/clients/${clientId}/photos/${photoId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      setPhotos(before);
      alert('Delete failed.');
    } else {
      router.refresh();
    }
  }

  async function handleAltTextSave(photoId: string, altText: string) {
    const res = await fetch(`/api/admin/clients/${clientId}/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alt_text: altText }),
    });
    if (!res.ok) {
      alert('Save failed.');
      return false;
    }
    setPhotos((arr) =>
      arr.map((p) => (p.id === photoId ? { ...p, alt_text: altText || null } : p)),
    );
    router.refresh();
    return true;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-gray-600">
          {photos.length} / {MAX_PHOTOS} photos
          {savingOrder && <span className="ml-2 text-gray-400">· saving order…</span>}
          {photos.length > MAX_PHOTOS && (
            <span className="ml-2 text-orange-600">
              · only the first {MAX_PHOTOS} appear in the gallery
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || remaining <= 0}
            className="bg-gray-900 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {uploading
              ? 'Uploading…'
              : remaining <= 0
                ? 'Limit reached'
                : `Upload photos${remaining < MAX_PHOTOS ? ` (${remaining} slots left)` : ''}`}
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
          {uploadError}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-800">
          No photos yet. Upload some, or use &ldquo;Re-fetch Photos&rdquo; to pull from Google Places.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {photos.map((photo, i) => (
                <SortablePhoto
                  key={photo.id}
                  photo={photo}
                  index={i}
                  r2PublicUrl={r2PublicUrl}
                  onDelete={() => handleDelete(photo.id)}
                  onAltTextSave={(alt) => handleAltTextSave(photo.id, alt)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortablePhoto({
  photo,
  index,
  r2PublicUrl,
  onDelete,
  onAltTextSave,
}: {
  photo: Photo;
  index: number;
  r2PublicUrl: string;
  onDelete: () => void;
  onAltTextSave: (alt: string) => Promise<boolean>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });
  const [editingAlt, setEditingAlt] = useState(false);
  const [altDraft, setAltDraft] = useState(photo.alt_text ?? '');
  const [savingAlt, setSavingAlt] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded border overflow-hidden relative group ${
        isDragging ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      {/* Drag handle covers the image — easy to grab, but action buttons live
          on top with stopPropagation so they're still clickable. */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing relative"
        aria-label={`Reorder photo ${index + 1}`}
      >
        <img
          src={`${r2PublicUrl}/${photo.r2_key}`}
          alt={photo.alt_text ?? `Photo ${index + 1}`}
          className="w-full aspect-square object-cover select-none pointer-events-none"
          draggable={false}
        />
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-mono px-1.5 py-0.5 rounded">
          {index + 1}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 bg-red-600 text-white w-6 h-6 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-700"
          aria-label="Delete photo"
        >
          ×
        </button>
      </div>

      <div className="p-2 text-xs text-gray-500 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={photo.source === 'fallback' ? 'text-orange-600 font-medium' : ''}
          >
            {photo.source}
          </span>
          {photo.bytes !== null && <span>{Math.round(photo.bytes / 1024)}KB</span>}
        </div>
        {editingAlt ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={altDraft}
              onChange={(e) => setAltDraft(e.target.value)}
              maxLength={200}
              placeholder="Alt text…"
              className="flex-1 border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setEditingAlt(false);
                  setAltDraft(photo.alt_text ?? '');
                }
              }}
            />
            <button
              type="button"
              disabled={savingAlt}
              onClick={async () => {
                setSavingAlt(true);
                const ok = await onAltTextSave(altDraft.trim());
                setSavingAlt(false);
                if (ok) setEditingAlt(false);
              }}
              className="text-blue-600 hover:underline disabled:opacity-50"
            >
              {savingAlt ? '…' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingAlt(true)}
            className="block w-full text-left text-gray-500 hover:text-gray-900 truncate"
            title={photo.alt_text ?? 'Click to add alt text'}
          >
            {photo.alt_text ? `alt: ${photo.alt_text}` : '+ alt text'}
          </button>
        )}
      </div>
    </div>
  );
}
