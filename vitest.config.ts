import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    // .claude/worktrees holds git worktrees with their own copies of test files
    // that resolve "@/..." against the wrong root — never scan them.
    exclude: [...configDefaults.exclude, ".claude/**", ".dmux/**"],
  },
});
