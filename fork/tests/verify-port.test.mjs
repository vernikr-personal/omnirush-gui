import assert from "node:assert/strict";
import { test } from "node:test";
import { portChecks } from "../scripts/verify-port.mjs";

const REPO = "vernikr-personal/omnirush-gui";

/** A repository in which the port is intact; tests break one thing at a time. */
function portedRepo(overrides = {}) {
  const files = {
    ".github/workflows/release-desktop.yml": [
      "  build:",
      "    strategy:",
      "      matrix:",
      "        include:",
      "          - name: macOS Intel",
      "            runner: macos-15-intel",
      "            builder_args: --mac --x64",
      "            feed_asset: latest-mac-x64.yml",
      "      - name: Resolve macOS signing",
      "        if: matrix.platform == 'macos' && steps.signing.outputs.enabled == 'true'",
      "  merge-mac-feed:",
      "    run: node scripts/release/merge-mac-update-manifests.mjs",
    ].join("\n"),
    "scripts/release/merge-mac-update-manifests.mjs": "// merge\n",
    "scripts/release/merge-mac-update-manifests.test.mjs": "// tests\n",
    "apps/desktop/electron/main.mjs": `const U = "https://github.com/${REPO}/releases/latest/download";\n`,
    "apps/desktop/electron/updater.mjs": `export const FEED = "https://github.com/${REPO}/releases/latest/download";\n`,
    "apps/desktop/electron/recovery.mjs": `const baseUrl = \`https://github.com/${REPO}/releases/download/v\`;\n`,
    "apps/desktop/electron-builder.base.yml": "publish:\n  - provider: github\n    owner: vernikr-personal\n    repo: omnirush-gui\n",
    "apps/desktop/scripts/engine-release.json": '{"repo":"omnirush-ai/omnirush-gui"}\n',
    "README.md": "| macOS, Intel | `omnirush-mac-x64-<version>.dmg` |\n",
    "docs/updates.md": "| macOS Intel | `omnirush-mac-x64-<version>.zip` | `latest-mac.yml` |\n",
    "fork/README.md": "# port kit\n",
    ...overrides,
  };
  return {
    read: (path) => {
      const value = files[path];
      if (value === undefined) throw new Error(`missing ${path}`);
      return value;
    },
    exists: (path) => files[path] !== undefined,
  };
}

function problemsFor(overrides = {}, repo = REPO) {
  const io = portedRepo(overrides);
  return portChecks({ repo, read: io.read, exists: io.exists })
    .flatMap((check) => check.problems().map((problem) => `[${check.id}] ${problem}`));
}

test("a ported repository has no problems", () => {
  assert.deepEqual(problemsFor(), []);
});

test("catches an Intel leg that upstream replaced", () => {
  const problems = problemsFor({
    ".github/workflows/release-desktop.yml": "  build:\n    strategy:\n      matrix:\n        include:\n          - name: macOS Apple Silicon\n",
  });
  assert.ok(problems.some((problem) => problem.includes("macOS Intel matrix leg")));
  assert.ok(problems.some((problem) => problem.includes("--mac --x64")));
});

test("catches a feed that no longer merges both architectures", () => {
  const problems = problemsFor({ "scripts/release/merge-mac-update-manifests.mjs": undefined });
  assert.ok(problems.some((problem) => problem.includes("merge-mac-update-manifests.mjs is missing")));
});

test("catches an if: expression that reads the secrets context", () => {
  const problems = problemsFor({
    ".github/workflows/release-desktop.yml": [
      "          - name: macOS Intel",
      "            runner: macos-15-intel",
      "            builder_args: --mac --x64",
      "            feed_asset: latest-mac-x64.yml",
      "      - name: Prepare macOS signing",
      "        if: matrix.platform == 'macos' && secrets.MAC_CSC_LINK != ''",
      "  merge-mac-feed:",
      "    run: node scripts/release/merge-mac-update-manifests.mjs",
    ].join("\n"),
  });
  assert.ok(problems.some((problem) => problem.includes("secrets context")));
});

test("catches release coordinates that point back at upstream", () => {
  const problems = problemsFor({
    "apps/desktop/electron/updater.mjs": 'export const FEED = "https://github.com/omnirush-ai/omnirush-gui/releases/latest/download";\n',
  });
  assert.ok(problems.some((problem) => problem.includes("updater.mjs still points at another repository")));
});

test("insists the pinned engine stays on upstream", () => {
  const problems = problemsFor({
    "apps/desktop/scripts/engine-release.json": `{"repo":"${REPO}"}\n`,
  });
  assert.ok(problems.some((problem) => problem.includes("engine tarballs")));
});
