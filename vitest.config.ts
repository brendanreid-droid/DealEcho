import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // .claude/worktrees holds full stale checkouts of this repo. Without this
    // exclude they contribute ~2/3 of the suite, so a deleted component's test
    // keeps passing from an old copy and the run reports a false green.
    exclude: ["**/node_modules/**", "functions/**", "dist/**", ".claude/worktrees/**"],
  },
});
