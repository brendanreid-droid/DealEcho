import React from "react";
import { Link } from "react-router-dom";
import { useSEO } from "../src/hooks/useSEO";
import { getPosts, formatPublishDate } from "../src/blog/posts";

const Blog: React.FC = () => {
  const posts = getPosts();

  useSEO({
    title: "Blog - Dealecho",
    description:
      "Field notes on buying teams, procurement, and what actually happens inside B2B deals.",
    keywords: "B2B sales blog, buying teams, procurement intelligence, Dealecho",
    openGraph: { url: "https://dealecho.io/blog", type: "website" },
  });

  return (
    <div className="bg-slate-50 min-h-screen py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12">
          <p className="font-mono text-2xs uppercase tracking-[0.16em] text-accent mb-3">
            Dealecho Blog
          </p>
          <h1 className="font-extrabold text-4xl md:text-5xl text-slate-900 tracking-tight mb-4">
            Field notes on how deals really close
          </h1>
          <p className="text-slate-500 text-base max-w-xl">
            What buying teams do, what procurement wants, and where sellers lose
            deals they thought they had won.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-slate-500 text-sm border border-dashed border-slate-300 rounded-card p-8 text-center">
            Nothing published yet. New posts land here as they go live.
          </p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  to={`/blog/${post.slug}`}
                  className="block bg-white border border-slate-200 rounded-card shadow-card p-6 md:p-8 transition-shadow hover:shadow-lift"
                >
                  <time
                    dateTime={post.publishDate}
                    className="font-mono text-2xs uppercase tracking-[0.16em] text-slate-400"
                  >
                    {formatPublishDate(post.publishDate)}
                  </time>
                  <h2 className="font-bold text-xl md:text-2xl text-slate-900 mt-2 mb-3 tracking-tight">
                    {post.title}
                  </h2>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {post.metaDescription}
                  </p>
                  <span className="inline-block mt-4 text-accent font-bold text-sm">
                    Read post
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Blog;
