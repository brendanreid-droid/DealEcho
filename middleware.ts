// middleware.ts
//
// Vercel Edge Middleware for a plain Vite/React app (no Next.js). Uses
// `@vercel/edge`, Vercel's framework-agnostic middleware helper, which wraps
// the standard Web Request/Response APIs. Serves prerendered, bot-specific
// SEO snapshots for the homepage without affecting real user traffic.
//
// Why this exists (and isn't handled by vercel.json rewrites alone):
// vercel.json rewrites for /pricing, /terms, /privacy work fine because those
// paths have no physical file in the build output — Vercel falls through to
// the rewrite. But "/" maps to a real dist/index.html on disk, and Vercel's
// static-file resolution takes priority over declarative rewrites for paths
// that have a matching file. Edge Middleware runs *before* that static
// resolution step, so it's the correct mechanism for the homepage case.
// (Verified in production: /pricing, /terms, /privacy correctly serve their
// bot snapshot; "/" did not, until this middleware.)
//
// Scope: homepage only. /pricing, /terms, /privacy continue to be handled by
// the vercel.json rewrites (already verified working in production).
//
// See scripts/prerender-seo.mjs for how dist/seo/home.html is generated, and
// research/seo/ in the DealEcho GTM repo for the underlying audit.

import { rewrite, next, type RequestContext } from "@vercel/edge";

export const config = {
  matcher: "/",
};

const BOT_UA_PATTERN =
  /Googlebot|Google-Extended|Bingbot|GPTBot|ChatGPT-User|PerplexityBot|ClaudeBot|anthropic-ai|LinkedInBot|Slackbot|Twitterbot|facebookexternalhit|Applebot/i;

export default function middleware(request: Request, _ctx: RequestContext) {
  const ua = request.headers.get("user-agent") ?? "";
  if (BOT_UA_PATTERN.test(ua)) {
    const url = new URL(request.url);
    url.pathname = "/seo/home.html";
    return rewrite(url);
  }
  return next();
}
