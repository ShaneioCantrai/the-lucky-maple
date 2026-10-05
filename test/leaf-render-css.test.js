import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("interactive SVG leaves rotate in viewBox coordinates", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const match = css.match(/\.leaf\s*\{([^}]*)\}/);
  assert.ok(match, "expected .leaf rule");
  assert.match(match[1], /transform-box:\s*view-box/);
  assert.match(match[1], /transform-origin:\s*0\s+0/);
  assert.doesNotMatch(match[1], /transform-box:\s*fill-box/);
});
