import test from "node:test";
import assert from "node:assert/strict";
import {
  LEAF_ASSETS,
  canonicalLeafAssetUrls,
  legacyLeafAsset,
  purchasedLeafState,
  resolveLeafAsset,
} from "../leaf-assets.js";

const all = new Set(canonicalLeafAssetUrls());

test("unclaimed leaves keep legacy numbered sprites", () => {
  assert.equal(resolveLeafAsset({ id: 1, claimed: false, spriteVariant: 4 }, { availableStateAssets: all }), "/img/web/leaves/leaf-04.webp");
});

test("claimed leaves use permanent base artwork by default", () => {
  assert.equal(resolveLeafAsset({ id: 1, claimed: true, assetFamily: "red" }, { availableStateAssets: all }), LEAF_ASSETS.red.base);
});

test("purchased highlight mode swaps claimed leaves to glow artwork", () => {
  assert.equal(resolveLeafAsset({ id: 1, claimed: true }, { highlightMode: true, availableStateAssets: all }), LEAF_ASSETS.red.glow);
});

test("newly planted artwork overrides purchased highlight mode", () => {
  const leaf = { id: 1, claimed: true, isNew: true };
  assert.equal(purchasedLeafState(leaf, true), "new");
  assert.equal(resolveLeafAsset(leaf, { highlightMode: true, availableStateAssets: all }), LEAF_ASSETS.red.new);
});

test("selected claimed leaves use glow artwork", () => {
  assert.equal(resolveLeafAsset({ id: 1, claimed: true, isSelected: true }, { availableStateAssets: all }), LEAF_ASSETS.red.glow);
});

test("missing glow artwork falls back to same-family base", () => {
  const baseOnly = new Set([LEAF_ASSETS.red.base]);
  assert.equal(resolveLeafAsset({ id: 8, claimed: true }, { highlightMode: true, availableStateAssets: baseOnly }), LEAF_ASSETS.red.base);
});

test("missing canonical artwork falls back to legacy sprite", () => {
  assert.equal(resolveLeafAsset({ id: 2, claimed: true, spriteVariant: 9 }, { highlightMode: true, availableStateAssets: new Set() }), "/img/web/leaves/leaf-09.webp");
});
