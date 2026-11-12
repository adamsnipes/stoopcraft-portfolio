'use client';

import { useState, useTransition } from 'react';
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
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MenuCategory, MenuConfig, MenuDietaryTag, MenuItem } from '@dfy/db';
import { isAllowedPhotoUrl } from '@/lib/photos/url-whitelist';

// ============================================================================
// Shared menu editor — used by both /admin/clients/[id]/menu and /portal/menu.
//
// Stateless about *who* is editing: takes initialMenu + saveEndpoint and a
// resourceLabel (used for messaging). Both pages pass the same component a
// different endpoint; the auth check happens server-side at each route.
// ============================================================================

const DIETARY_TAGS: { id: MenuDietaryTag; label: string }[] = [
  { id: 'gf', label: 'GF' },
  { id: 'vg', label: 'VG' },
  { id: 'v', label: 'V' },
  { id: 'df', label: 'DF' },
  { id: 'spicy', label: 'Spicy' },
  { id: 'nf', label: 'NF' },
];

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tmp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function emptyItem(): MenuItem {
  return { id: newId(), name: '', description: '', price: '' };
}

function emptyCategory(): MenuCategory {
  return {
    id: newId(),
    title: 'New Category',
    items: [emptyItem()],
  };
}

export function MenuEditor({
  initialMenu,
  saveEndpoint,
}: {
  initialMenu: MenuConfig;
  saveEndpoint: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<null | 'ok' | 'error'>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [categories, setCategories] = useState<MenuCategory[]>(
    initialMenu.categories.length > 0 ? initialMenu.categories : [emptyCategory()],
  );
  // show_images defaults to true when omitted (older rows); when the customer
  // explicitly sets it to false, every menu composition skips images.
  const [showImages, setShowImages] = useState<boolean>(initialMenu.show_images !== false);

  // Categories collapse by default so the page is scannable for menus with
  // 10+ categories — the primary action at this zoom level is reordering, not
  // editing items. Expanding a single category surfaces its items for in-place
  // edits. Newly-added categories auto-expand because the user just clicked
  // "+ Add category" intending to fill it in.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandAll = () => setExpanded(new Set(categories.map((c) => c.id)));
  const collapseAll = () => setExpanded(new Set());

  // ── Import JSON state ─────────────────────────────────────────────────────
  // Lets an operator paste a full menu payload (e.g. from a scrape) and
  // replace the in-memory editor state. Save still goes through the existing
  // PUT, so server zod gets the final word on validation.
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // ── Category-level mutations ──────────────────────────────────────────────
  const updateCategory = (id: string, patch: Partial<MenuCategory>) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const removeCategory = (id: string) => {
    if (!confirm('Delete this category and all its items?')) return;
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };
  const addCategory = () => {
    const fresh = emptyCategory();
    setCategories((prev) => [...prev, fresh]);
    // Auto-expand: the user clicked "+ Add category" and is about to type
    // into the title + items. Forcing them to expand the new row first would
    // be friction.
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(fresh.id);
      return next;
    });
  };
  // Drag-to-reorder (categories and items both). PointerSensor's distance
  // gate avoids accidental drags when an admin clicks into a text input
  // adjacent to a drag handle.
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCategories((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };
  const handleItemDragEnd = (catId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c;
        const oldIndex = c.items.findIndex((it) => it.id === active.id);
        const newIndex = c.items.findIndex((it) => it.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return c;
        return { ...c, items: arrayMove(c.items, oldIndex, newIndex) };
      }),
    );
  };

  // ── Item-level mutations ──────────────────────────────────────────────────
  const updateItem = (catId: string, itemId: string, patch: Partial<MenuItem>) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id !== catId
          ? c
          : { ...c, items: c.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) },
      ),
    );
  };
  const toggleDietary = (catId: string, itemId: string, tag: MenuDietaryTag) => {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          items: c.items.map((it) => {
            if (it.id !== itemId) return it;
            const current = it.dietary ?? [];
            const next = current.includes(tag)
              ? current.filter((t) => t !== tag)
              : [...current, tag];
            return { ...it, dietary: next.length > 0 ? next : undefined };
          }),
        };
      }),
    );
  };
  const addItem = (catId: string) => {
    setCategories((prev) =>
      prev.map((c) => (c.id !== catId ? c : { ...c, items: [...c.items, emptyItem()] })),
    );
  };
  const removeItem = (catId: string, itemId: string) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.id !== catId ? c : { ...c, items: c.items.filter((it) => it.id !== itemId) },
      ),
    );
  };

  // ── Import JSON ───────────────────────────────────────────────────────────
  // Accepts either the full PUT body (`{ menu: { categories, show_images } }`)
  // or just the inner shape (`{ categories, show_images }`). Mints UUIDs for
  // any item/category missing one. Replaces — does not merge.
  const applyImport = () => {
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError('Invalid JSON — check for missing commas or quotes.');
      return;
    }
    const root =
      parsed && typeof parsed === 'object' && 'menu' in (parsed as object)
        ? (parsed as { menu: unknown }).menu
        : parsed;
    if (!root || typeof root !== 'object') {
      setImportError('Expected an object with a "categories" array.');
      return;
    }
    const rawCategories = (root as { categories?: unknown }).categories;
    if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
      setImportError('Missing or empty "categories" array.');
      return;
    }
    const importedCategories: MenuCategory[] = [];
    for (let ci = 0; ci < rawCategories.length; ci++) {
      const c = rawCategories[ci] as Record<string, unknown> | null;
      if (!c || typeof c !== 'object') {
        setImportError(`Category ${ci + 1} is not an object.`);
        return;
      }
      const title = typeof c['title'] === 'string' ? c['title'].trim() : '';
      if (!title) {
        setImportError(`Category ${ci + 1} is missing a "title".`);
        return;
      }
      const rawItems = c['items'];
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        setImportError(`Category "${title}" has no items.`);
        return;
      }
      const items: MenuItem[] = [];
      for (let ii = 0; ii < rawItems.length; ii++) {
        const i = rawItems[ii] as Record<string, unknown> | null;
        if (!i || typeof i !== 'object') {
          setImportError(`Item ${ii + 1} in "${title}" is not an object.`);
          return;
        }
        const name = typeof i['name'] === 'string' ? i['name'].trim() : '';
        if (!name) {
          setImportError(`Item ${ii + 1} in "${title}" is missing a "name".`);
          return;
        }
        const item: MenuItem = {
          id: typeof i['id'] === 'string' && i['id'].length > 0 ? (i['id'] as string) : newId(),
          name,
          description: typeof i['description'] === 'string' ? (i['description'] as string) : '',
          price: typeof i['price'] === 'string' ? (i['price'] as string) : '',
        };
        if (typeof i['photo_id'] === 'string') item.photo_id = i['photo_id'] as string;
        if (typeof i['photo_url'] === 'string' && (i['photo_url'] as string).trim()) {
          item.photo_url = (i['photo_url'] as string).trim();
        }
        if (typeof i['external_id'] === 'string') item.external_id = i['external_id'] as string;
        if (typeof i['is_synced'] === 'boolean') item.is_synced = i['is_synced'] as boolean;
        if (Array.isArray(i['dietary'])) {
          const valid: MenuDietaryTag[] = ['gf', 'vg', 'v', 'df', 'spicy', 'nf'];
          const tags = (i['dietary'] as unknown[]).filter(
            (d): d is MenuDietaryTag => typeof d === 'string' && (valid as string[]).includes(d),
          );
          if (tags.length > 0) item.dietary = tags;
        }
        items.push(item);
      }
      const cat: MenuCategory = {
        id: typeof c['id'] === 'string' && c['id'].length > 0 ? (c['id'] as string) : newId(),
        title,
        items,
      };
      if (typeof c['description'] === 'string' && (c['description'] as string).trim()) {
        cat.description = (c['description'] as string).trim();
      }
      if (typeof c['external_id'] === 'string') cat.external_id = c['external_id'] as string;
      importedCategories.push(cat);
    }

    const totalItems = importedCategories.reduce((n, c) => n + c.items.length, 0);
    if (
      !window.confirm(
        `Replace current menu with ${importedCategories.length} ${
          importedCategories.length === 1 ? 'category' : 'categories'
        } and ${totalItems} ${totalItems === 1 ? 'item' : 'items'}? You can still review and edit before saving.`,
      )
    ) {
      return;
    }

    setCategories(importedCategories);
    if (typeof (root as { show_images?: unknown }).show_images === 'boolean') {
      setShowImages((root as { show_images: boolean }).show_images);
    }
    setImportText('');
    setImportError(null);
    setImportOpen(false);
    // Surface a non-success "saved" state to nudge the user to hit Save.
    setSaved(null);
    setErrorMsg(null);
  };

  const handleImportFile = async (file: File) => {
    setImportError(null);
    try {
      const txt = await file.text();
      setImportText(txt);
    } catch {
      setImportError('Could not read file.');
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const onSave = () => {
    setSaved(null);
    setErrorMsg(null);

    // Light client-side validation — drop empty-name items, drop empty
    // categories. Server validates more strictly.
    const cleaned = categories
      .map((c) => ({
        ...c,
        items: c.items
          .filter((it) => it.name.trim().length > 0)
          .map((it): MenuItem => {
            // Drop empty/invalid photo_url before sending; server zod refines
            // against the whitelist and would reject a stray bad value.
            const trimmed = it.photo_url?.trim() ?? '';
            if (!trimmed) {
              const { photo_url: _drop, ...rest } = it;
              return rest;
            }
            return { ...it, photo_url: trimmed };
          }),
      }))
      .filter((c) => c.title.trim().length > 0 && c.items.length > 0);

    if (cleaned.length === 0) {
      setErrorMsg('Add at least one category with one item.');
      setSaved('error');
      return;
    }

    // Surface bad URLs early so the user fixes them before the round trip.
    const badUrl = cleaned
      .flatMap((c) => c.items)
      .find((it) => it.photo_url && !isAllowedPhotoUrl(it.photo_url));
    if (badUrl) {
      setErrorMsg(
        `"${badUrl.name}" image URL isn't from an allowed host. Supported: https://*.uber.com`,
      );
      setSaved('error');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(saveEndpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ menu: { categories: cleaned, show_images: showImages } }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMsg(data.error ?? `Save failed (${res.status})`);
          setSaved('error');
          return;
        }
        setSaved('ok');
        router.refresh();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Network error');
        setSaved('error');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 sticky top-0 bg-white py-3 z-10 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-500">
            {categories.length} {categories.length === 1 ? 'category' : 'categories'} ·{' '}
            {categories.reduce((n, c) => n + c.items.length, 0)} items
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showImages}
              onChange={(e) => setShowImages(e.target.checked)}
              className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            Show images on menu
          </label>
        </div>
        <div className="flex items-center gap-3">
          {saved === 'ok' && <span className="text-sm text-emerald-600">Saved</span>}
          {saved === 'error' && (
            <span className="text-sm text-red-600">{errorMsg ?? 'Save failed'}</span>
          )}
          <button
            type="button"
            onClick={expanded.size === categories.length ? collapseAll : expandAll}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-500 hover:text-gray-900"
          >
            {expanded.size === categories.length ? 'Collapse all' : 'Expand all'}
          </button>
          <button
            type="button"
            onClick={() => setImportOpen((v) => !v)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-500 hover:text-gray-900"
          >
            {importOpen ? 'Close importer' : 'Import JSON'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save menu'}
          </button>
        </div>
      </div>

      {importOpen && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Import menu JSON</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Paste a full menu payload to replace the current categories and items. Accepts either{' '}
                <code className="font-mono">{'{ menu: { categories: [...] } }'}</code> or just{' '}
                <code className="font-mono">{'{ categories: [...] }'}</code>. Missing IDs are filled in
                automatically. Final validation happens on save.
              </p>
            </div>
            <label className="shrink-0 cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-500 hover:text-gray-900">
              Upload .json
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{ "menu": { "show_images": true, "categories": [...] } }'
            rows={10}
            spellCheck={false}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-y bg-white"
          />
          {importError && (
            <p className="text-sm text-red-600">{importError}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                setImportText('');
                setImportError(null);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-gray-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyImport}
              disabled={importText.trim().length === 0}
              className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              Replace menu
            </button>
          </div>
        </div>
      )}

      <DndContext
        sensors={dragSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleCategoryDragEnd}
      >
        <SortableContext
          items={categories.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {categories.map((cat) => (
              <CategoryBlock
                key={cat.id}
                category={cat}
                isExpanded={expanded.has(cat.id)}
                onToggleExpand={() => toggleExpanded(cat.id)}
                onUpdate={(patch) => updateCategory(cat.id, patch)}
                onRemove={() => removeCategory(cat.id)}
                dragSensors={dragSensors}
                onItemDragEnd={handleItemDragEnd(cat.id)}
                onItemUpdate={(itemId, patch) => updateItem(cat.id, itemId, patch)}
                onItemRemove={(itemId) => removeItem(cat.id, itemId)}
                onItemAdd={() => addItem(cat.id)}
                onToggleDietary={(itemId, tag) => toggleDietary(cat.id, itemId, tag)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addCategory}
        className="w-full rounded-md border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
      >
        + Add category
      </button>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function CategoryBlock({
  category,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  dragSensors,
  onItemDragEnd,
  onItemUpdate,
  onItemRemove,
  onItemAdd,
  onToggleDietary,
}: {
  category: MenuCategory;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<MenuCategory>) => void;
  onRemove: () => void;
  dragSensors: ReturnType<typeof useSensors>;
  onItemDragEnd: (event: DragEndEvent) => void;
  onItemUpdate: (itemId: string, patch: Partial<MenuItem>) => void;
  onItemRemove: (itemId: string) => void;
  onItemAdd: () => void;
  onToggleDietary: (itemId: string, tag: MenuDietaryTag) => void;
}) {
  const itemCount = category.items.length;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-gray-200 bg-white ${
        isExpanded ? 'p-5 space-y-4' : 'p-3'
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder category"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 px-1 select-none"
        >
          ⋮⋮
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={isExpanded ? 'Collapse category' : 'Expand category'}
          aria-expanded={isExpanded}
          className="text-gray-500 hover:text-gray-900 px-1 select-none"
          style={{
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          ▶
        </button>
        <input
          type="text"
          value={category.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Category title (e.g. Antipasti)"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-base font-semibold focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        {!isExpanded && (
          <span className="text-xs text-gray-500 whitespace-nowrap px-2">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete category"
          className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
        >
          Delete
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="pl-10">
            <input
              type="text"
              value={category.description ?? ''}
              onChange={(e) => onUpdate({ description: e.target.value || undefined })}
              placeholder="Optional one-line description (italic)"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 italic focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div className="pl-10">
            <DndContext
              sensors={dragSensors}
              collisionDetection={closestCenter}
              onDragEnd={onItemDragEnd}
            >
              <SortableContext
                items={category.items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {category.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onUpdate={(patch) => onItemUpdate(item.id, patch)}
                      onRemove={() => onItemRemove(item.id)}
                      onToggleDietary={(tag) => onToggleDietary(item.id, tag)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button
              type="button"
              onClick={onItemAdd}
              className="mt-3 w-full rounded-md border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
            >
              + Add item
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ItemRow({
  item,
  onUpdate,
  onRemove,
  onToggleDietary,
}: {
  item: MenuItem;
  onUpdate: (patch: Partial<MenuItem>) => void;
  onRemove: () => void;
  onToggleDietary: (tag: MenuDietaryTag) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md border border-gray-100 bg-gray-50 p-3 space-y-2"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder item"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 px-1 pt-1 select-none"
        >
          ⋮⋮
        </button>
        <div className="flex-1 grid grid-cols-12 gap-2">
          <input
            type="text"
            value={item.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Item name"
            className="col-span-9 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <input
            type="text"
            value={item.price}
            onChange={(e) => onUpdate({ price: e.target.value })}
            placeholder="Price"
            className="col-span-3 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete item"
          className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
        >
          ✕
        </button>
      </div>
      <textarea
        value={item.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        placeholder="Description (optional)"
        rows={2}
        className="ml-7 w-[calc(100%-3.5rem)] rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none"
      />
      <ItemPhotoControl item={item} onUpdate={onUpdate} />
      <div className="ml-7 flex flex-wrap gap-1">
        {DIETARY_TAGS.map((tag) => {
          const active = item.dietary?.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggleDietary(tag.id)}
              className={
                active
                  ? 'rounded-full bg-gray-900 px-2 py-0.5 text-xs font-medium text-white'
                  : 'rounded-full border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-600 hover:border-gray-500'
              }
            >
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ItemPhotoControl({
  item,
  onUpdate,
}: {
  item: MenuItem;
  onUpdate: (patch: Partial<MenuItem>) => void;
}) {
  const url = item.photo_url ?? '';
  const trimmed = url.trim();
  const validHostPreview = trimmed.length > 0 && isAllowedPhotoUrl(trimmed);
  const invalidHost = trimmed.length > 0 && !validHostPreview;
  return (
    <div className="ml-7 flex items-start gap-3">
      {validHostPreview && (
        <img
          src={trimmed}
          alt=""
          className="w-12 h-12 rounded-md object-cover border border-gray-200 flex-shrink-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
          }}
        />
      )}
      <div className="flex-1">
        <input
          type="url"
          value={url}
          onChange={(e) => onUpdate({ photo_url: e.target.value })}
          placeholder="Image URL (https://*.uber.com)"
          className={`w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 ${
            invalidHost
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'
          }`}
        />
        {invalidHost && (
          <p className="mt-1 text-xs text-red-600">
            Host not allowed. Supported: https://*.uber.com
          </p>
        )}
      </div>
    </div>
  );
}
