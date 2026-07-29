import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getPosts = vi.fn();

vi.mock("../src/blog/posts", async () => {
  const actual = await vi.importActual<typeof import("../src/blog/posts")>(
    "../src/blog/posts",
  );
  return { ...actual, getPosts: () => getPosts() };
});

import Blog from "./Blog";

const post = (over: Partial<Record<string, unknown>> = {}) => ({
  slug: "a-post",
  title: "A Post",
  metaDescription: "What the post is about.",
  publishDate: "2026-08-04",
  schema: "BlogPosting",
  body: "Body.",
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <Blog />
    </MemoryRouter>,
  );

describe("Blog index", () => {
  beforeEach(() => getPosts.mockReset());

  it("lists posts newest first with title, description and date", () => {
    getPosts.mockReturnValue([
      post({ slug: "newer", title: "Newer Post", publishDate: "2026-08-04" }),
      post({ slug: "older", title: "Older Post", publishDate: "2026-01-09" }),
    ]);
    renderPage();

    const links = screen.getAllByRole("link", { name: /Post/ });
    expect(links[0]).toHaveAttribute("href", "/blog/newer");
    expect(links[1]).toHaveAttribute("href", "/blog/older");
    expect(screen.getAllByText("What the post is about.")).toHaveLength(2);
    expect(screen.getByText("4 August 2026")).toBeInTheDocument();
  });

  it("shows an empty state when there are no published posts", () => {
    getPosts.mockReturnValue([]);
    renderPage();
    expect(screen.getByText(/nothing published yet/i)).toBeInTheDocument();
  });
});
