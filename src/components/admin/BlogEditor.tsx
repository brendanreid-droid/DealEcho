import React, { useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parsePost } from "../../blog/frontmatter.mjs";
import Icon from "../Icon";

/**
 * Admin blog editor.
 *
 * Publishing commits `content/blog/[slug].md` to the repo through
 * adminPublishBlogPost, not to Firestore. Posts have to exist
 * as files at build time or the prerendered bot snapshots (and with them the
 * SEO and LinkedIn cards this blog exists for) can't be generated. The
 * tradeoff is latency: a post is live once Vercel finishes deploying the
 * commit, roughly two minutes.
 */

const REGION = "australia-southeast1";
/** Google truncates search snippets around here. Soft limit, not enforced. */
const META_LIMIT = 155;

interface FormState {
  slug: string;
  title: string;
  metaDescription: string;
  publishDate: string;
  pillar: string;
  keywords: string;
  ogImage: string;
  body: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY: FormState = {
  slug: "",
  title: "",
  metaDescription: "",
  publishDate: today(),
  pillar: "",
  keywords: "",
  ogImage: "",
  body: "",
};

/** Title -> URL slug. Mirrors the server's SLUG_RE: lowercase kebab only. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const labelClass = "block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5";
const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500";

const BlogEditor: React.FC = () => {
  const functions = useMemo(() => getFunctions(undefined, REGION), []);
  const [form, setForm] = useState<FormState>(EMPTY);
  // Set once a title has been typed by hand, so we stop overwriting a slug the
  // author edited themselves.
  const [slugTouched, setSlugTouched] = useState(false);
  const [posts, setPosts] = useState<{ slug: string }[]>([]);
  const [editingExisting, setEditingExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ commitUrl: string; updated: boolean } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const loadPosts = async () => {
    try {
      const fn = httpsCallable<object, { posts: { slug: string }[] }>(
        functions,
        "adminListBlogPosts",
      );
      const res = await fn({});
      setPosts(res.data.posts ?? []);
    } catch {
      // A failed listing must not block writing a new post.
      setPosts([]);
    }
  };

  useEffect(() => {
    void loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTitleChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: slugTouched || editingExisting ? prev.slug : slugify(value),
    }));
  };

  const loadPost = async (slug: string) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fn = httpsCallable<{ slug: string }, { slug: string; markdown: string }>(
        functions,
        "adminGetBlogPost",
      );
      const res = await fn({ slug });
      const post = parsePost(res.data.markdown, `content/blog/${slug}.md`);
      setForm({
        slug: post.slug,
        title: post.title,
        metaDescription: post.metaDescription,
        publishDate: post.publishDate,
        pillar: post.pillar ? String(post.pillar) : "",
        keywords: post.keywords ?? "",
        ogImage: post.ogImage ?? "",
        body: post.body.trim(),
      });
      setEditingExisting(true);
      setSlugTouched(true);
    } catch (err: any) {
      setError(err?.message ?? "Could not load that post.");
    } finally {
      setBusy(false);
    }
  };

  const startNew = () => {
    setForm({ ...EMPTY, publishDate: today() });
    setEditingExisting(false);
    setSlugTouched(false);
    setError(null);
    setResult(null);
  };

  const canPublish =
    !busy &&
    form.slug.trim() !== "" &&
    form.title.trim() !== "" &&
    form.metaDescription.trim() !== "" &&
    form.publishDate.trim() !== "" &&
    form.body.trim() !== "";

  const publish = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fn = httpsCallable<
        Record<string, unknown>,
        { updated: boolean; path: string; commitUrl: string }
      >(functions, "adminPublishBlogPost");
      const res = await fn({
        slug: form.slug.trim(),
        title: form.title.trim(),
        metaDescription: form.metaDescription.trim(),
        publishDate: form.publishDate,
        body: form.body.trim(),
        ...(form.pillar ? { pillar: Number(form.pillar) } : {}),
        ...(form.keywords ? { keywords: form.keywords.trim() } : {}),
        ...(form.ogImage ? { ogImage: form.ogImage.trim() } : {}),
      });
      setResult(res.data);
      setEditingExisting(true);
      void loadPosts();
    } catch (err: any) {
      setError(err?.message ?? "Publishing failed.");
    } finally {
      setBusy(false);
    }
  };

  const metaOver = form.metaDescription.length > META_LIMIT;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
      {/* Published posts */}
      <aside className="bg-white/5 border border-white/10 rounded-2xl p-4 h-fit">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Posts
          </h3>
          <button
            onClick={startNew}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-black"
          >
            + New
          </button>
        </div>
        {posts.length === 0 ? (
          <p className="text-slate-500 text-xs">Nothing published yet.</p>
        ) : (
          <ul className="space-y-1">
            {posts.map((post) => (
              <li key={post.slug}>
                <button
                  onClick={() => loadPost(post.slug)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded-lg break-words ${
                    form.slug === post.slug
                      ? "bg-indigo-600/20 text-indigo-300"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {post.slug}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Editor */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">
            {editingExisting ? "Edit post" : "New post"}
          </h3>
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="text-xs font-black text-slate-400 hover:text-white"
          >
            <Icon name={showPreview ? "fa-edit" : "fa-eye"} size={12} className="mr-1.5 inline-block" />
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="blog-title">Title</label>
            <input
              id="blog-title"
              className={inputClass}
              value={form.title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="There's a G2 for Vendors. Why Isn't There One for Buyers?"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="blog-slug">Slug</label>
            <input
              id="blog-slug"
              className={inputClass}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value);
              }}
              placeholder="g2-for-vendors-no-glassdoor"
            />
            <p className="text-2xs text-slate-500 mt-1">/blog/{form.slug || "…"}</p>
          </div>

          <div>
            <label className={labelClass} htmlFor="blog-date">Publish date</label>
            <input
              id="blog-date"
              type="date"
              className={inputClass}
              value={form.publishDate}
              onChange={(e) => set("publishDate", e.target.value)}
            />
            <p className="text-2xs text-slate-500 mt-1">
              A future date stays hidden until a deploy on or after it.
            </p>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-baseline justify-between">
              <label className={labelClass} htmlFor="blog-meta">Meta description</label>
              <span
                className={`text-2xs font-mono ${metaOver ? "text-rose-400" : "text-slate-500"}`}
              >
                {form.metaDescription.length} / {META_LIMIT}
              </span>
            </div>
            <textarea
              id="blog-meta"
              rows={2}
              className={inputClass}
              value={form.metaDescription}
              onChange={(e) => set("metaDescription", e.target.value)}
              placeholder="Shown in search results and link previews."
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="blog-pillar">Pillar</label>
            <select
              id="blog-pillar"
              className={inputClass}
              value={form.pillar}
              onChange={(e) => set("pillar", e.target.value)}
            >
              <option value="">None</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="blog-keywords">Keywords</label>
            <input
              id="blog-keywords"
              className={inputClass}
              value={form.keywords}
              onChange={(e) => set("keywords", e.target.value)}
              placeholder="buying team accountability, review buying teams"
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="blog-ogimage">Social card image</label>
            <input
              id="blog-ogimage"
              className={inputClass}
              value={form.ogImage}
              onChange={(e) => set("ogImage", e.target.value)}
              placeholder="/blog/cards/my-post.png - leave blank for the site card"
            />
          </div>
        </div>

        {showPreview ? (
          <div className="bg-white rounded-xl p-6 max-h-[32rem] overflow-y-auto">
            <h1 className="font-extrabold text-2xl text-slate-900 mb-4">
              {form.title || "Untitled"}
            </h1>
            <div className="text-slate-600 text-sm leading-relaxed [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:text-lg [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_a]:text-indigo-600 [&_strong]:text-slate-900">
              <Markdown remarkPlugins={[remarkGfm]}>{form.body}</Markdown>
            </div>
          </div>
        ) : (
          <div>
            <label className={labelClass} htmlFor="blog-body">Body</label>
            <textarea
              id="blog-body"
              rows={18}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder={"Paste the approved markdown here.\n\nNo H1 needed - the page renders the title.\n\n## Sources\n\n- Source, year"}
            />
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-emerald-300 text-sm">
            <p className="font-black">
              {result.updated ? "Updated" : "Published"} - live in about 2 minutes, once
              Vercel finishes deploying.
            </p>
            <a
              href={result.commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              View commit
            </a>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={publish}
            disabled={!canPublish}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl px-6 py-2.5"
          >
            {busy ? "Working…" : editingExisting ? "Publish update" : "Publish"}
          </button>
          <p className="text-2xs text-slate-500">
            Commits content/blog/{form.slug || "[slug]"}.md to main.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BlogEditor;
