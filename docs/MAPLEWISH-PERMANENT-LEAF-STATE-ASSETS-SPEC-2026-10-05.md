# MapleWish Permanent Leaf State Assets Spec

Date: 2026-10-05  
Status: Approved for implementation  
Repository: `ShaneioCantrai/the-lucky-maple`  
Working branch: `feature/maplewish-leaf-state-assets-20261005`

## 1. Purpose

Replace the generic/derived interactive leaf presentation with canonical MapleWish leaf image assets that have explicit visual states.

A purchased leaf is a permanent object on the tree. It must always render as a visible leaf. Highlighting, selection, and purchase-return effects are state changes applied to that leaf; they must never replace the leaf with a standalone ring or halo.

This spec keeps the current deterministic tree-slot model and payment/ownership data model intact.

## 2. Current problem

The production tree can identify a purchased leaf and draw a halo at its location, but the corresponding leaf may not be visually obvious or may appear absent beneath the halo.

Current behavior combines:
- one of twelve generic illustrated WebP sprites;
- CSS brightness/drop-shadow treatment;
- separate SVG circle halo elements;
- a CSS `just-planted` animation.

This makes the highlight layer independent from the actual purchased-leaf artwork. The result can look like a glowing empty location instead of a planted leaf.

## 3. Product rules

1. A paid leaf is permanent unless explicitly retired for an administrative reason.
2. The leaf's tree position stays stable between visits.
3. Turning purchased-leaf highlighting on or off never hides the underlying purchased leaf.
4. A newly planted leaf gets a temporary celebratory state, then settles into its permanent base state.
5. A selected leaf remains visibly selected until its public card/modal closes.
6. Decorative starter foliage and ambient falling leaves remain separate from purchased leaf ownership.
7. The tree must remain usable with reduced motion enabled.
8. A missing state asset must fall back to a visible base asset rather than producing an invisible leaf.

## 4. Canonical leaf states

The first implementation ships one complete red starter family:

- `leaf-red.webp` — permanent/base state.
- `leaf-red-glow.webp` — purchased-highlight state.
- `leaf-red-new.webp` — newly planted celebration state.

Future families may add orange, gold, yellow, green, teal, blue, purple, pink, brown, copper, and cream using the same contract.

Future interaction-state files may include:
- `leaf-{colour}-hover.webp`
- `leaf-{colour}-pressed.webp`
- `leaf-{colour}-selected.webp`

The renderer must not depend on those future assets being present.

## 5. Runtime asset location

Canonical state assets live under:

`img/web/leaves/states/`

Example:

```
img/web/leaves/states/
  leaf-red.webp
  leaf-red-glow.webp
  leaf-red-new.webp
```

The existing `img/web/leaves/leaf-01.webp` through `leaf-12.webp` remain available for starter/natural foliage during migration.

## 6. Leaf state model

Each interactive leaf already has stable layout properties. Extend the client model with presentation-only state:

```js
{
  id,
  x,
  y,
  baseSize,
  size,
  rotation,
  claimed,
  natural,
  amountCents,
  spriteVariant,
  owner,
  message,
  plantedAt,
  isNew,
  isSelected
}
```

No database migration is required for MVP. `paid_at` / `planted_at` is already sufficient to decide whether a returned purchase should briefly show the newly planted state.

## 7. Asset manifest

Introduce a single manifest in the frontend:

```js
const LEAF_ASSETS = Object.freeze({
  red: Object.freeze({
    base: "/img/web/leaves/states/leaf-red.webp",
    glow: "/img/web/leaves/states/leaf-red-glow.webp",
    new: "/img/web/leaves/states/leaf-red-new.webp"
  })
});
```

A resolver chooses one URL per purchased leaf.

Resolution order:

1. newly planted -> `new`
2. selected -> `glow` until a dedicated selected asset is added
3. purchased-highlight mode -> `glow`
4. normal purchased leaf -> `base`

Fallback order:

1. requested state
2. same-colour base
3. red base
4. existing numbered sprite

A state-asset load failure must never make a leaf disappear.

## 8. New-leaf lifecycle

After payment success:

1. refresh public leaf data;
2. locate the paid leaf by returned `leafSlot`;
3. mark that leaf `isNew = true`;
4. render `leaf-red-new.webp`;
5. scroll it into view;
6. keep the state for 7 seconds;
7. settle to the currently appropriate state:
   - glow when purchased-highlight mode is active;
   - glow when selected;
   - base otherwise.

The timer is presentation-only. Refreshing the page does not restart a long celebration unless the payment-return flow explicitly identifies the just-purchased slot.

## 9. Purchased-leaf highlight mode

The existing "Show purchased leaves" / "Hide leaf halos" control becomes an asset-state toggle.

When off:
- purchased leaves use base assets;
- decorative foliage remains at normal opacity.

When on:
- purchased leaves switch to glow assets;
- available/decorative leaf opacity may still be reduced to improve discoverability;
- no standalone visual circle is required for the primary highlight.

The transparent enlarged hit target may remain if needed for reliable clicking, but it must be visually invisible.

Existing visible SVG halo rings should be removed once the glow asset is active.

## 10. Selection behavior

Opening a purchased leaf card sets `isSelected = true` for that leaf and refreshes its visual state.

Closing the card clears selection and refreshes the leaf.

Until a dedicated selected asset exists, selected uses the glow asset.

Keyboard focus remains visible using CSS focus treatment around the interactive element; accessibility must not depend only on colour or glow.

## 11. Size and depth

The existing contribution-size tiers remain:

- $2 -> 1.00x
- $5 -> 1.25x
- $10 -> 1.50x
- $25+ -> 1.85x

The current deterministic per-slot `baseSize` continues to provide natural depth variation.

The state assets are rendered into the same leaf bounding box. Dedicated XL/L/M/S source images are not required for MVP.

## 12. Placement stability

Do not change `leaf-layout.js` slot generation in this work.

Purchased leaves continue to be attached to stable `leaf_slot` values.

The current authored canopy-zone / deterministic slot approach remains the source of truth.

## 13. Rendering implementation

Keep the current SVG scene layer for MVP.

Purchased leaves can continue to use SVG `<image>` elements. The renderer changes the `href` based on state.

This minimizes risk because:
- hit handling remains unchanged;
- positioning remains unchanged;
- responsive SVG scaling remains unchanged;
- no HTML-overlay coordinate translation is introduced.

A future Canvas/WebGL migration remains possible if simultaneous interactive leaf count grows beyond a few thousand.

## 14. Decorative leaf compatibility

Unclaimed and starter/natural foliage continue to use the existing numbered leaf sprites during phase 1.

Only claimed/purchased leaves are switched to canonical state assets.

This prevents a visual redesign of the entire canopy while solving purchased-leaf correctness first.

## 15. Asset preloading

Preload canonical state assets at startup.

The preload routine must:
- be non-blocking;
- cache success/failure;
- tolerate missing optional assets;
- avoid repeated network requests for a known-missing state.

## 16. Reduced motion

For `prefers-reduced-motion: reduce`:
- do not pulse purchased leaves continuously;
- do not animate newly planted leaf scale/rotation;
- the static `new` artwork may still be shown for the normal seven-second state window;
- scrolling should use `auto` rather than forced smooth motion where practical.

## 17. Accessibility

- Interactive leaf elements remain keyboard-focusable.
- Purchased leaf `aria-label` includes leaf number and contribution tier.
- The expanded hit target, if retained, must not create duplicate tab stops.
- Only the leaf image element should be the primary focus target.
- Focus-visible treatment remains explicit.
- State changes must not change the accessible identity of the leaf.

## 18. Error handling

If a canonical state asset fails:
- set the leaf to its base state asset;
- if base fails, use the prior numbered sprite;
- record the failure once in `console.warn`;
- do not retry on every render.

The page must remain interactive if every new state asset fails.

## 19. Backend / API impact

No backend schema change is required.

Current campaign leaf response already contains:
- `leaf_slot`
- `sprite_variant`
- `gross_cents`
- `paid_at`
- display content

Legacy leaf data continues to map into the slot model.

A future multi-colour system may add `leaf_colour` / `leaf_asset_family`, but that is explicitly out of scope for the first pass.

## 20. Tests

Add lightweight frontend tests that exercise pure state-resolution helpers where possible.

Required acceptance checks:

1. Claimed leaf renders a visible base state with highlight mode off.
2. Highlight toggle swaps claimed leaf to glow artwork.
3. Turning highlight mode off restores base artwork.
4. New state overrides highlight state for its seven-second window.
5. After the new-state window, the leaf resolves correctly.
6. Missing glow asset falls back to base.
7. Missing base asset falls back to numbered legacy sprite.
8. Decorative and unclaimed leaves are unaffected.
9. Purchased leaf remains in the same slot after reload.
10. Contribution size tiers remain unchanged.
11. Clicking/focusing purchased leaf opens the correct public leaf card.
12. English and French homepages continue to work.
13. Reduced-motion mode does not create continuous purchase pulse animation.

## 21. Rollout plan

Phase 1:
- add this spec;
- add the red base/glow/new asset family;
- introduce state manifest/resolver;
- wire purchased leaves to the new assets;
- remove visible SVG halo rings from highlight mode;
- keep invisible enlarged hit area if necessary;
- test locally.

Phase 2:
- add orange and gold families;
- deterministically assign purchased-leaf colour family;
- add hover/pressed/selected assets;
- add asset-validation tooling.

Phase 3:
- export all approved atlas colours;
- evaluate dedicated depth-size source files;
- profile mobile performance at large leaf counts;
- consider Canvas/WebGL only if profiling justifies it.

## 22. Non-goals

This work does not:
- change contribution pricing;
- change Stripe checkout;
- change direct-aid allocation;
- change leaf slot ordering;
- retire or age out old leaves;
- redesign the painted canopy;
- change campaign accounting;
- deploy to production automatically.

## 23. Acceptance definition

The work is accepted when a paid MapleWish leaf is always visually present at its stable tree location, its state transitions are driven by canonical MapleWish leaf artwork, the purchased-leaf highlight control shows a glowing version of the leaf rather than an empty halo, and payment return produces a short newly planted celebration before the leaf settles into its permanent state.
