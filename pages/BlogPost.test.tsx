import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const getPost = vi.fn();

vi.mock("../src/blog/posts", async () => {
  const actual = await vi.importActual<typeof import("../src/blog/posts")>(
    "../src/blog/posts",
  );
  return { ...actual, getPost: (slug: string) => getPost(slug) };
});

import BlogPost from "./BlogPost";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/blog/:slug" element={<BlogPost />} />
      </Routes>
    </MemoryRouter>,
  );

const POST = {
  slug: "a-post",
  title: "A Post",
  metaDescription: "What the post is about.",
  publishDate: "2026-08-04",
  keywords: "buying team accountability",
  schema: "BlogPosting",
  body: "Lead paragraph.\n\n## Sources\n\n- SBI Growth, 2024\n",
};

describe("BlogPost", () => {
  beforeEach(() => {
    getPost.mockReset();
    document.head.querySelectorAll("script[type='application/ld+json']").forEach((n) => n.remove());
  });

  it("renders the post title, date and markdown body", () => {
    getPost.mockReturnValue(POST);
    renderAt("/blog/a-post");

    expect(screen.getByRole("heading", { level: 1, name: "A Post" })).toBeInTheDocument();
    expect(screen.getByText("4 August 2026")).toBeInTheDocument();
    expect(screen.getByText("Lead paragraph.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Sources" })).toBeInTheDocument();
    expect(screen.getByText("SBI Growth, 2024")).toBeInTheDocument();
  });

  it("sets the document title and injects BlogPosting JSON-LD", () => {
    getPost.mockReturnValue(POST);
    renderAt("/blog/a-post");

    expect(document.title).toBe("A Post - Dealecho");
    const ld = document.head.querySelector("script[type='application/ld+json']");
    const schema = JSON.parse(ld?.textContent ?? "{}");
    expect(schema["@type"]).toBe("BlogPosting");
    expect(schema.headline).toBe("A Post");
    expect(schema.datePublished).toBe("2026-08-04");
    expect(schema.mainEntityOfPage).toBe("https://dealecho.io/blog/a-post");
  });

  it("renders the 404 page for an unknown slug", () => {
    getPost.mockReturnValue(undefined);
    renderAt("/blog/nope");

    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });
});
