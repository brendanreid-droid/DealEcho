import React from "react";
import { Link, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSEO } from "../src/hooks/useSEO";
import { getPost, formatPublishDate } from "../src/blog/posts";
import {
  blogPostingSchema,
  postUrl,
  ogImageUrl,
  linkedInShareUrl,
} from "../src/blog/seo.mjs";
import Icon from "../src/components/Icon";
import NotFound from "./NotFound";

// Explicit element styling: this repo has no @tailwindcss/typography, and the
// post body is the only place raw markdown becomes DOM.
const markdownComponents = {
  h2: (props: any) => (
    <h2 className="font-bold text-2xl text-slate-900 tracking-tight mt-10 mb-3" {...props} />
  ),
  h3: (props: any) => (
    <h3 className="font-bold text-lg text-slate-900 mt-8 mb-2" {...props} />
  ),
  p: (props: any) => <p className="text-slate-600 leading-relaxed mb-5" {...props} />,
  ul: (props: any) => (
    <ul className="list-disc pl-6 space-y-2 text-slate-600 mb-5" {...props} />
  ),
  ol: (props: any) => (
    <ol className="list-decimal pl-6 space-y-2 text-slate-600 mb-5" {...props} />
  ),
  li: (props: any) => <li className="leading-relaxed" {...props} />,
  strong: (props: any) => <strong className="font-bold text-slate-900" {...props} />,
  a: (props: any) => (
    <a className="text-accent font-medium underline underline-offset-2" {...props} />
  ),
  blockquote: (props: any) => (
    <blockquote
      className="border-l-4 border-accent/30 pl-4 py-1 my-6 text-slate-500 italic"
      {...props}
    />
  ),
  code: (props: any) => (
    <code className="font-mono text-sm bg-slate-100 rounded px-1.5 py-0.5" {...props} />
  ),
  hr: (props: any) => <hr className="border-slate-200 my-10" {...props} />,
  table: (props: any) => (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-sm text-left border-collapse" {...props} />
    </div>
  ),
  th: (props: any) => (
    <th className="border-b border-slate-300 py-2 pr-4 font-bold text-slate-900" {...props} />
  ),
  td: (props: any) => (
    <td className="border-b border-slate-100 py-2 pr-4 text-slate-600" {...props} />
  ),
};

const BlogPost: React.FC = () => {
  const { slug = "" } = useParams();
  const post = getPost(slug);

  // Unknown or not-yet-published slug. Humans get the same soft 404 as the
  // rest of the SPA; crawlers get a real HTTP 404 because the vercel.json bot
  // rewrite targets a snapshot file that was never generated for this slug.
  if (!post) return <NotFound />;

  return <PostBody post={post} />;
};

const PostBody: React.FC<{ post: NonNullable<ReturnType<typeof getPost>> }> = ({ post }) => {
  useSEO({
    title: `${post.title} - Dealecho`,
    description: post.metaDescription,
    keywords: post.keywords,
    canonical: postUrl(post.slug),
    openGraph: {
      title: post.title,
      description: post.metaDescription,
      url: postUrl(post.slug),
      image: ogImageUrl(post),
      type: "article",
    },
    schema: blogPostingSchema(post),
  });

  return (
    <div className="bg-slate-50 min-h-screen py-16 px-6">
      <article className="max-w-3xl mx-auto">
        <Link
          to="/blog"
          className="font-mono text-2xs uppercase tracking-[0.16em] text-accent hover:text-accent-700"
        >
          ← All posts
        </Link>

        <header className="mt-8 mb-10 pb-8 border-b border-slate-200">
          <h1 className="font-extrabold text-3xl md:text-4xl text-slate-900 tracking-tight mb-4">
            {post.title}
          </h1>
          <time
            dateTime={post.publishDate}
            className="font-mono text-2xs uppercase tracking-[0.16em] text-slate-400"
          >
            {formatPublishDate(post.publishDate)}
          </time>
        </header>

        <div className="text-base">
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {post.body}
          </Markdown>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap items-center gap-4">
          <a
            href={linkedInShareUrl(post)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-navy text-white font-bold text-sm rounded-control px-5 py-2.5 transition-colors hover:bg-navy-800"
          >
            <Icon name="fa-linkedin-in" size={14} />
            <span>Share on LinkedIn</span>
          </a>
          <Link to="/blog" className="text-accent font-bold text-sm">
            Read more posts
          </Link>
        </footer>
      </article>
    </div>
  );
};

export default BlogPost;
