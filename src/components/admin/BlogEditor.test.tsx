import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const callables: Record<string, ReturnType<typeof vi.fn>> = {
  adminListBlogPosts: vi.fn(),
  adminGetBlogPost: vi.fn(),
  adminPublishBlogPost: vi.fn(),
};

vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  httpsCallable: (_fns: unknown, name: string) => callables[name],
}));

import BlogEditor from "./BlogEditor";

const fill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/^title$/i), "A Good Post");
  await user.type(
    screen.getByLabelText(/meta description/i),
    "What the post is about.",
  );
  await user.type(screen.getByLabelText(/^body$/i), "Lead paragraph.");
};

describe("BlogEditor", () => {
  beforeEach(() => {
    Object.values(callables).forEach((fn) => fn.mockReset());
    callables.adminListBlogPosts.mockResolvedValue({ data: { posts: [] } });
    callables.adminPublishBlogPost.mockResolvedValue({
      data: { updated: false, path: "content/blog/a-good-post.md", commitUrl: "https://github.com/x/y/commit/abc" },
    });
  });

  it("derives a slug from the title", async () => {
    const user = userEvent.setup();
    render(<BlogEditor />);

    await user.type(screen.getByLabelText(/^title$/i), "There's a G2 for Vendors!");
    expect(screen.getByLabelText(/^slug$/i)).toHaveValue("theres-a-g2-for-vendors");
  });

  it("publishes the form values and surfaces the commit", async () => {
    const user = userEvent.setup();
    render(<BlogEditor />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => expect(callables.adminPublishBlogPost).toHaveBeenCalled());
    const payload = callables.adminPublishBlogPost.mock.calls[0][0];
    expect(payload).toMatchObject({
      slug: "a-good-post",
      title: "A Good Post",
      metaDescription: "What the post is about.",
      body: "Lead paragraph.",
    });
    expect(payload.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(await screen.findByText(/live in about 2 minutes/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view commit/i })).toHaveAttribute(
      "href",
      "https://github.com/x/y/commit/abc",
    );
  });

  it("blocks publishing until the required fields are filled", async () => {
    render(<BlogEditor />);
    expect(screen.getByRole("button", { name: /publish/i })).toBeDisabled();
  });

  it("warns when the meta description passes the search-snippet limit", async () => {
    const user = userEvent.setup();
    render(<BlogEditor />);

    await user.type(screen.getByLabelText(/meta description/i), "x".repeat(156));
    expect(screen.getByText(/156\s*\/\s*155/)).toHaveClass("text-rose-400");
  });

  it("shows the server's message when publishing fails", async () => {
    callables.adminPublishBlogPost.mockRejectedValue(
      new Error("GitHub rejected the commit (403)."),
    );
    const user = userEvent.setup();
    render(<BlogEditor />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: /publish/i }));

    expect(await screen.findByText(/GitHub rejected the commit/)).toBeInTheDocument();
  });

  it("loads an existing post into the form for editing", async () => {
    callables.adminListBlogPosts.mockResolvedValue({
      data: { posts: [{ slug: "existing-post" }] },
    });
    callables.adminGetBlogPost.mockResolvedValue({
      data: {
        slug: "existing-post",
        markdown: `---
slug: existing-post
title: "Existing Post"
metaDescription: "Already live."
publishDate: 2026-07-01
---

Existing body.
`,
      },
    });

    const user = userEvent.setup();
    render(<BlogEditor />);

    await user.click(await screen.findByRole("button", { name: /existing-post/ }));

    await waitFor(() =>
      expect(screen.getByLabelText(/^title$/i)).toHaveValue("Existing Post"),
    );
    expect(screen.getByLabelText(/^slug$/i)).toHaveValue("existing-post");
    expect(screen.getByLabelText(/^body$/i)).toHaveValue("Existing body.");
  });
});
