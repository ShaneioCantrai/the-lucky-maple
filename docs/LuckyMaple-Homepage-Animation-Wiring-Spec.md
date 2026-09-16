# MapleWish â€” Homepage Animation & Wiring Spec

Status: implementation spec for approved homepage concept #3.

Visual reference:
`docs/concepts/lucky-maple-homepage-concept-03.png`

Related art manifest:
`docs/LuckyMaple-Homepage-Asset-List.md`

## Goal

Rebuild concept #3 as a responsive, layered, interactive homepage that feels gently alive while remaining trustworthy and readable.

The motion language is `soft environmental life`, not game HUD, casino animation, or constant attention-grabbing movement.

Primary user actions must remain obvious at all times:
1. `Plant a leaf Â· $1`
2. `Enter free`
3. inspect owned/available leaves;
4. understand how much direct help has been funded.

## Non-negotiable data rule

Funds raised, help delivered, leaves planted, weekly prize, contest dates and other changing values come from the backend. Never bake production values into image assets.
## Scene composition

Use a layered scene behind ordinary HTML UI.

Recommended stack, back to front:

1. `scene-sky`
2. `scene-clouds`
3. `scene-mountains`
4. `scene-cityline` optional
5. `scene-lake`
6. `scene-treeline`
7. `scene-ground`
8. `scene-fence`
9. `tree-trunk`
10. `tree-canopy-back`
11. `tree-canopy-mid`
12. interactive leaf layer
13. `tree-canopy-front`
14. bird / hanging sign / small props
15. ambient falling-leaf canvas
16. foreground foliage
17. HTML UI panels and controls

Use `position:absolute` inside a clipped hero scene. UI cards stay as semantic DOM elements above the art.

## Z-index bands

Suggested bands:
- 0â€“9: scenic background;
- 10â€“19: tree and ground props;
- 20â€“29: owned/available leaf interaction;
- 30â€“39: ambient FX and wildlife;
- 40â€“49: foreground decorative masks;
- 100+: functional UI, dialogs and accessibility focus states.
## Ambient animation controller

Implement one lightweight controller that owns environmental animation state. Avoid independent timers scattered through components.

Recommended responsibilities:
- falling leaf particle pool;
- random wind-gust scheduling;
- canopy sway state;
- background parallax;
- bird idle state;
- visibility pause/resume;
- `prefers-reduced-motion` handling.

Pause requestAnimationFrame work when `document.hidden === true` and when the hero is fully outside the viewport.

## Falling leaves

Default desktop behaviour:
- 6â€“10 leaves visible at once during calm periods;
- display size roughly 16â€“48 CSS px;
- fall duration 12â€“22 seconds;
- horizontal drift 40â€“160 px over the full descent;
- gentle sinusoidal side movement;
- continuous slow rotation with randomized direction;
- varied opacity around 0.7â€“1.0;
- randomized depth using size, blur and speed.

Mobile:
- 3â€“5 leaves normally visible;
- use fewer large foreground leaves;
- never obscure the CTA buttons or legal text.

Use a single `<canvas>` for ambient falling leaves unless DOM sprites prove equally cheap in profiling.
## Wind gusts

A gust is an occasional event, not a loop.

Recommended cadence:
- randomized every 12â€“28 seconds;
- never schedule two gusts back-to-back;
- suspend while a modal is open;
- skip if `prefers-reduced-motion: reduce`.

A gust may:
- add 3â€“6 temporary falling leaves;
- push existing particles sideways for 1.5â€“2.5 seconds;
- show one faint wind-swirl sprite;
- increase canopy movement by a few pixels;
- give the hanging sign one slightly larger sway.

Do not add screen shake, sound, or rapid movement.

## Canopy sway

Use three canopy layers with slightly different timing.

Suggested transform envelopes:
- back canopy: translateX Â±2 px, rotate Â±0.15Â° over 10â€“14 s;
- mid canopy: translateX Â±3 px, rotate Â±0.22Â° over 8â€“12 s;
- front canopy: translateX Â±4 px, rotate Â±0.3Â° over 7â€“10 s.

Set transform origin low in the canopy, near where foliage meets major branches. Use smooth `ease-in-out` keyframes. The trunk remains still.

During a wind gust, temporarily blend to roughly 1.5Ã— normal amplitude, then settle without snapping.
## Background parallax

Parallax should be almost subconscious.

Pointer-driven maximum offsets on desktop:
- mountains/clouds: 2â€“4 px;
- treeline/lake: 4â€“6 px;
- fence/ground props: 6â€“9 px;
- foreground foliage: 10â€“14 px.

Interpolate toward the target position instead of following the pointer directly. A smoothing factor around 0.04â€“0.08 per frame is sufficient.

Disable pointer parallax on coarse-pointer/touch devices. Mobile may use a tiny scroll-linked vertical offset if it profiles cleanly, otherwise remain static.

## Lake and clouds

Clouds:
- drift horizontally over 90â€“160 seconds;
- movement must be nearly imperceptible;
- loop with enough off-canvas padding that reset is invisible.

Lake shimmer:
- animate only a subtle highlight/mask;
- 8â€“16 second opacity/translate cycle;
- no obvious repeating wave texture.

## Hanging sign

The central wooden sign may sway around its top attachment point:
- calm amplitude: about Â±0.5Â°;
- duration: 6â€“10 seconds;
- wind gust: brief peak around Â±1.2Â°;
- settle gradually.
## Bird idle behaviour

The perched bird is an ambient reward for looking, not a mascot demanding attention.

State timings:
- blink every 5â€“12 seconds;
- look left/right every 15â€“30 seconds;
- optional tail/wing twitch every 20â€“45 seconds;
- return to idle after 0.4â€“1.2 seconds.

Do not animate all bird states at once. Randomize events and impose a minimum quiet period between them.

## Interactive owned/available leaves

Interactive leaves sit above the painted canopy and use the existing public leaf records.

Behaviour:
- available leaf: subdued green/olive;
- claimed leaf: autumn red/orange/yellow/olive;
- hover/focus: brighten slightly and show a soft ring;
- selected: persistent glow until leaf card/modal closes;
- keyboard focus must be visible;
- clicking a leaf opens its public card or plant flow.

Do not animate every interactive leaf continuously. Static leaves keep the tree calm and reduce CPU/GPU load.

### Stable placement

A permanent leaf should not visibly jump to another branch between visits.

Preferred v1 approach:
- derive placement deterministically from `tree_layout_version + leaf_id`;
- constrain generated positions to authored canopy zones/masks;
- persist `tree_layout_version` so future tree-art changes can preserve old layouts or migrate deliberately.
## Live data wiring

Use the existing backend as source of truth.

### `GET /api/stats`
Bind:
- `leavesPlanted` â†’ tree-base counter and impact card;
- `helpAllocatedCents` â†’ funds/direct-help allocation display;
- `helpDeliveredCents` â†’ delivered-impact display when shown;
- `helpBalanceCents` â†’ optional detail view, not necessarily hero UI.

### `GET /api/contest/current`
Bind:
- `prize_cents` â†’ weekly giveaway amount;
- `opens_at`, `closes_at`, `draw_at` â†’ timing/status UI;
- `sponsor_name` â†’ optional sponsor credit;
- `funding_source` â†’ admin/audit use, not necessarily public hero copy.

If either endpoint fails, keep the page usable and show neutral placeholders such as `â€”` rather than invented numbers.

## Counter motion

On first successful data load:
- animate monetary/leaf counters from the previous rendered value to the current value over 600â€“900 ms;
- use ease-out interpolation;
- do not animate from zero if it would imply funds are being raised live during page load;
- subsequent updates may use a tiny one-time scale/opacity pulse.

Respect reduced-motion preference by updating numbers instantly.
## Responsive behaviour

### Desktop â‰¥ 1100 px
- preserve concept #3 composition closely;
- giveaway card left, impact card upper-right;
- tree centred and dominant;
- nav/actions across top;
- three-step panel spans lower hero.

### Tablet 700â€“1099 px
- keep tree central;
- reduce decorative foreground;
- allow impact card to shrink or move below nav;
- keep both primary CTAs visible without overlap;
- reduce leaf-particle count.

### Mobile < 700 px
- use mobile scenic/tree crop;
- top area: logo + primary `Plant a leaf Â· $1` CTA;
- tree occupies the visual centre;
- giveaway and impact cards stack as normal document sections;
- free-entry CTA remains obvious without requiring purchase interaction;
- three-step strip becomes three stacked cards;
- no pointer parallax;
- ambient leaf count 3â€“5 maximum.

Do not scale desktop typography down until it becomes unreadable. Reflow instead.

## Reduced motion and accessibility

When `prefers-reduced-motion: reduce` is active:
- disable falling-leaf continuous animation;
- disable canopy sway, parallax, cloud drift and lake shimmer;
- show bird in idle state;
- update counters instantly;
- retain all functional hover/focus/selected states without motion.
Accessibility requirements:
- all actionable leaf targets receive keyboard focus and accessible names;
- decorative ambient leaves are `aria-hidden` and never focusable;
- UI text remains real DOM text with sufficient contrast;
- important information is never conveyed by colour alone;
- dialog focus is trapped/restored correctly;
- `Enter free` and `Plant a leaf` remain separate actions in both visual and accessibility trees.

## Performance guardrails

- target smooth 60 fps on modern desktop, stable 30â€“60 fps on mid-range mobile;
- use one requestAnimationFrame loop for environmental JS motion;
- prefer CSS transforms/opacity; avoid animating layout properties;
- cap device-pixel-ratio for the FX canvas if needed;
- pause animation when hero is offscreen or tab is hidden;
- lazy-load bird and noncritical foreground polish after core scene paint;
- never create one DOM node per falling particle every frame; reuse a pool;
- profile before increasing interactive leaf count.

### Interactive leaf scaling

The current SVG-style approach is acceptable for the early tree. Before substantially exceeding a few thousand simultaneously rendered interactive leaves, profile hit-testing, layout and memory on mobile.

If needed, move the interactive leaf layer to canvas/WebGL with an indexed hit map while preserving accessible keyboard/search alternatives outside the canvas.

## No motion over legal copy

Ambient particles must avoid or pass behind:
- no-purchase-required language;
- prize details;
- impact/funds values;
- form fields;
- modal content;
- primary CTA labels.
## Suggested frontend module split

When the static prototype is refactored, keep the pieces small:

- `scene.js` â€” scene layer initialization and responsive art selection;
- `ambient.js` â€” one animation loop, particles, gust scheduling and visibility pause;
- `parallax.js` â€” pointer/scroll parallax only;
- `tree-leaves.js` â€” deterministic owned/available leaf placement and hit interactions;
- `stats.js` â€” `/api/stats` binding and counter updates;
- `contest.js` â€” `/api/contest/current` binding and entry UI state;
- `dialogs.js` â€” leaf, purchase and free-entry modal behaviour;
- `motion-preferences.js` â€” reduced-motion/coarse-pointer capability state.

Do not introduce a large UI framework solely for these effects. The existing lightweight frontend can support the first production version.

## Cutout / implementation workflow

1. Keep the enlarged concept image unchanged in `docs/concepts/`.
2. Recreate or cut the scenic background into the P0 layers from the asset manifest.
3. Rebuild the tree as trunk + 3 canopy layers rather than a single baked sprite.
4. Create the reusable interactive-leaf symbols separately from the painted canopy.
5. Build the functional cards/buttons as HTML/CSS using the concept as visual reference.
6. Add calm canopy motion first and compare against the static concept.
7. Add falling leaves at minimum density.
8. Add gusts, parallax and bird only after desktop/mobile readability is accepted.
9. Profile before increasing effects.

## Visual acceptance

The implementation passes when, with animation paused, a screenshot is recognizably the approved concept #3 rather than a loose reinterpretation.

With motion enabled, a viewer should notice that the page feels alive within a few seconds, but no single ambient animation should demand attention away from the tree, impact numbers, giveaway, or CTAs.
