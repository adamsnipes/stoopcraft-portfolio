'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import ImageExtension from '@tiptap/extension-image';
import type { PostRow } from '@dfy/db';

type Status = 'draft' | 'in_review' | 'published';

function ToolBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`min-w-[34px] px-2.5 py-1.5 rounded text-sm leading-none transition-colors ${
        active ? 'bg-ink-900 text-cream-50' : 'hover:bg-ink-900/5 text-ink-800'
      }`}
    >
      {children}
    </button>
  );
}

function ToolDivider() {
  return <span className="w-px self-stretch bg-ink-900/10 mx-1" />;
}

function Toolbar({ editor, onImageFile }: { editor: Editor | null; onImageFile: (f: File) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (!editor) return null;

  const setLink = () => {
    const prev = (editor.getAttributes('link').href as string | undefined) ?? 'https://';
    const url = window.prompt('Link URL (leave blank to remove)', prev);
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border border-ink-900/10 rounded-lg p-1.5 bg-white sticky top-14 z-10">
      <ToolBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></ToolBtn>
      <ToolBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></ToolBtn>
      <ToolDivider />
      <ToolBtn title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
      <ToolBtn title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolBtn>
      <ToolDivider />
      <ToolBtn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>&bull; List</ToolBtn>
      <ToolBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</ToolBtn>
      <ToolBtn title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>&ldquo; &rdquo;</ToolBtn>
      <ToolBtn title="Link" active={editor.isActive('link')} onClick={setLink}>Link</ToolBtn>
      <ToolBtn title="Insert image" onClick={() => fileRef.current?.click()}>Image</ToolBtn>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImageFile(f);
          e.target.value = '';
        }}
      />
      <ToolDivider />
      <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>&#8634;</ToolBtn>
      <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>&#8635;</ToolBtn>
    </div>
  );
}

export function PostEditor({
  clientId,
  post,
  publicBase,
}: {
  clientId: string;
  post: PostRow;
  publicBase: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  const [excerpt, setExcerpt] = useState(post.excerpt ?? '');
  const [cover, setCover] = useState(post.cover_image_url ?? '');
  const [seoTitle, setSeoTitle] = useState(post.seo_title ?? '');
  const [seoDesc, setSeoDesc] = useState(post.seo_description ?? '');
  const [status, setStatus] = useState<Status>(post.status as Status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      ImageExtension.configure({ inline: false, HTMLAttributes: { loading: 'lazy' } }),
    ],
    content: post.body_html || '<p></p>',
    immediatelyRender: false,
  });

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(`/api/admin/clients/${clientId}/blog/image`, { method: 'POST', body: form });
      if (!res.ok) return null;
      const data = (await res.json()) as { url?: string };
      return data.url ?? null;
    },
    [clientId],
  );

  const save = useCallback(
    async (newStatus?: Status) => {
      if (!editor) return;
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch(`/api/admin/clients/${clientId}/blog/${post.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            slug,
            excerpt,
            cover_image_url: cover,
            body_html: editor.getHTML(),
            seo_title: seoTitle,
            seo_description: seoDesc,
            ...(newStatus ? { status: newStatus } : {}),
          }),
        });
        const data = (await res.json()) as { post?: PostRow; error?: string };
        if (res.ok && data.post) {
          setStatus(data.post.status as Status);
          setSlug(data.post.slug);
          setMsg(
            newStatus === 'published' ? 'Published ✓' : newStatus === 'draft' ? 'Moved to draft ✓' : 'Saved ✓',
          );
        } else {
          setMsg(`Error: ${data.error ?? 'save failed'}`);
        }
      } catch {
        setMsg('Network error');
      } finally {
        setBusy(false);
      }
    },
    [editor, title, slug, excerpt, cover, seoTitle, seoDesc, clientId, post.id],
  );

  const onImageFile = useCallback(
    async (file: File) => {
      setMsg('Uploading image…');
      const url = await uploadImage(file);
      if (url && editor) {
        editor.chain().focus().setImage({ src: url }).run();
        setMsg('Image added ✓');
      } else {
        setMsg('Image upload failed');
      }
    },
    [uploadImage, editor],
  );

  async function uploadCover(file: File) {
    setMsg('Uploading cover…');
    const url = await uploadImage(file);
    if (url) {
      setCover(url);
      setMsg('Cover uploaded — remember to Save');
    } else {
      setMsg('Cover upload failed');
    }
  }

  async function del() {
    if (!confirm('Delete this post permanently?')) return;
    await fetch(`/api/admin/clients/${clientId}/blog/${post.id}`, { method: 'DELETE' });
    router.push(`/admin/clients/${clientId}/blog`);
  }

  const isPublished = status === 'published';
  const btn = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50';

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <a href={`/admin/clients/${clientId}/blog`} className="text-sm text-ink-700/60 hover:text-ink-900">
          &larr; All posts
        </a>
        <div className="flex items-center gap-2 flex-wrap">
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          {isPublished && (
            <a href={`${publicBase}/blog/${slug}`} target="_blank" rel="noreferrer" className="text-sm text-ink-700/70 hover:text-ink-900 underline">
              View
            </a>
          )}
          <button type="button" onClick={() => save()} disabled={busy} className={`${btn} border border-ink-900/15 hover:bg-ink-900/5`}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {isPublished ? (
            <button type="button" onClick={() => save('draft')} disabled={busy} className={`${btn} border border-ink-900/15 hover:bg-ink-900/5`}>
              Unpublish
            </button>
          ) : (
            <button type="button" onClick={() => save('published')} disabled={busy} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}>
              Publish
            </button>
          )}
          <button type="button" onClick={del} className={`${btn} text-red-600 hover:bg-red-50`}>
            Delete
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title"
        className="w-full font-display text-3xl font-light tracking-tight bg-transparent border-0 outline-none placeholder:text-ink-900/25"
      />

      <Toolbar editor={editor} onImageFile={onImageFile} />
      <div className="border border-ink-900/10 rounded-xl bg-white overflow-hidden">
        <EditorContent editor={editor} />
      </div>

      <details className="rounded-xl border border-ink-900/10 bg-white">
        <summary className="px-5 py-3 text-sm font-medium cursor-pointer select-none">Post settings (slug, excerpt, cover, SEO)</summary>
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-ink-900/10">
          <Field label="URL slug" hint="The path: /blog/your-slug">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputCls} placeholder="my-post" />
          </Field>
          <Field label="Excerpt" hint="Short summary shown on the blog index & as the meta description fallback.">
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} className={inputCls} />
          </Field>
          <Field label="Cover image" hint="Shown on the index card & at the top of the post.">
            <div className="flex items-center gap-3 flex-wrap">
              {cover && <img src={cover} alt="" className="h-12 w-20 object-cover rounded border border-ink-900/10" />}
              <button type="button" onClick={() => coverRef.current?.click()} className="border border-ink-900/15 rounded-lg px-3 py-2 text-sm hover:bg-ink-900/5">
                {cover ? 'Replace' : 'Upload'}
              </button>
              {cover && (
                <button type="button" onClick={() => setCover('')} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              )}
              <input
                ref={coverRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCover(f);
                  e.target.value = '';
                }}
              />
            </div>
            <input value={cover} onChange={(e) => setCover(e.target.value)} className={`${inputCls} mt-2`} placeholder="…or paste an image URL" />
          </Field>
          <Field label="SEO title" hint="Overrides the page <title>. Leave blank to use the post title.">
            <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className={inputCls} />
          </Field>
          <Field label="SEO description" hint="Meta description. Leave blank to use the excerpt.">
            <textarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} rows={2} className={inputCls} />
          </Field>
        </div>
      </details>

      <style>{TIPTAP_CSS}</style>
    </div>
  );
}

const inputCls = 'block w-full border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="text-xs text-ink-700/55 mt-1 block">{hint}</span>}
    </label>
  );
}

const TIPTAP_CSS = `
  .ProseMirror{min-height:360px;padding:22px 26px;outline:none;font-size:1.04rem;line-height:1.7;color:#283047}
  .ProseMirror>*:first-child{margin-top:0}
  .ProseMirror p{margin:0 0 14px}
  .ProseMirror h2{font-size:1.55rem;font-weight:600;margin:26px 0 10px;color:#1a2236}
  .ProseMirror h3{font-size:1.22rem;font-weight:600;margin:20px 0 8px;color:#1a2236}
  .ProseMirror ul,.ProseMirror ol{margin:0 0 14px;padding-left:24px}
  .ProseMirror li{margin:0 0 6px}
  .ProseMirror li>p{margin:0}
  .ProseMirror img{max-width:100%;height:auto;border-radius:10px;margin:12px 0;display:block}
  .ProseMirror img.ProseMirror-selectednode{outline:2px solid #1c3461}
  .ProseMirror blockquote{border-left:3px solid #1c3461;margin:18px 0;padding:4px 18px;color:#586079;font-style:italic}
  .ProseMirror a{color:#1c3461;text-decoration:underline}
  .ProseMirror code{background:#f1efe9;padding:2px 5px;border-radius:4px;font-size:.9em}
  .ProseMirror pre{background:#1a2236;color:#e7e3da;padding:14px 16px;border-radius:10px;overflow:auto;margin:0 0 16px}
  .ProseMirror pre code{background:none;padding:0;color:inherit}
  .ProseMirror hr{border:none;border-top:1px solid #ece8e0;margin:24px 0}
`;
