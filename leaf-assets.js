export const LEAF_ASSETS = Object.freeze({
  red: Object.freeze({
    base: "/img/web/leaves/states/leaf-red.webp",
    glow: "/img/web/leaves/states/leaf-red-glow.webp",
    new: "/img/web/leaves/states/leaf-red-new.webp",
  }),
});

export function legacyLeafAsset(leaf = {}) {
  const raw = Number(leaf.spriteVariant) || ((Number(leaf.id || 0) * 7) % 12) + 1;
  const index = Math.min(12, Math.max(1, raw));
  return `/img/web/leaves/leaf-${String(index).padStart(2, "0")}.webp`;
}

export function purchasedLeafState(leaf = {}, highlightMode = false) {
  if (!leaf.claimed) return null;
  if (leaf.isNew) return "new";
  if (leaf.isSelected || highlightMode) return "glow";
  return "base";
}

export function resolveLeafAsset(
  leaf = {},
  { highlightMode = false, availableStateAssets = null } = {},
) {
  if (!leaf.claimed) return legacyLeafAsset(leaf);

  const family = LEAF_ASSETS[leaf.assetFamily] || LEAF_ASSETS.red;
  const state = purchasedLeafState(leaf, highlightMode);
  const candidate = family[state] || family.base;

  if (!availableStateAssets || availableStateAssets.has(candidate)) return candidate;
  if (availableStateAssets.has(family.base)) return family.base;
  return legacyLeafAsset(leaf);
}

export function canonicalLeafAssetUrls() {
  return [...new Set(Object.values(LEAF_ASSETS).flatMap(family => Object.values(family)))];
}
