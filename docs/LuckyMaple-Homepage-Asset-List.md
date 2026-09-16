# MapleWish â€” Homepage Asset List

Status: production art plan for approved homepage concept #3.

Authoritative visual reference:
`docs/concepts/lucky-maple-homepage-concept-03.png`

## Art direction

The production page should preserve the concept's warm, illustrated autumn look: soft cream UI, bright Canadian fall colours, a large friendly maple tree, distant lake/mountains, and minimal playful wildlife.

The page should feel alive, not busy. Motion is environmental and slow. The tree remains the visual focus.

Important production rule: dynamic or legal text must remain HTML/CSS, not baked into artwork. This includes prize value, funds raised, leaf count, buttons, giveaway terms, navigation, and impact statistics.

## Export conventions

- Master/source art: lossless PNG or layered source file retained outside runtime bundle.
- Large scenic layers: WebP/AVIF runtime export with PNG master.
- Transparent sprites: PNG/WebP with alpha.
- Simple icons: SVG where practical.
- Decorative panel frames may be 9-slice PNG/WebP or CSS.
- Runtime filenames use lowercase kebab-case.
- Export at 2x display resolution where practical; downsample in browser.
- Do not include fake counters or prize amounts in raster artwork.
## A. Scenic background layers

| Asset ID | Description | Runtime form | Motion |
|---|---|---|---|
| `lm-bg-sky` | Clean pale-blue sky gradient | WebP/AVIF | Static |
| `lm-bg-clouds-far` | Soft distant cloud bank | Alpha WebP | Very slow drift |
| `lm-bg-mountains` | Blue-grey mountain range | Alpha WebP | Tiny parallax |
| `lm-bg-cityline` | Optional subtle Canadian skyline/CN Tower silhouette | Alpha WebP | Tiny parallax |
| `lm-bg-lake` | Lake/water plate | WebP/AVIF | Static base |
| `lm-bg-lake-shimmer` | Very soft horizontal highlight/shimmer mask | Alpha WebP | Slow opacity/translate |
| `lm-bg-treeline-far` | Distant conifer/autumn treeline | Alpha WebP | Small parallax |
| `lm-bg-ground` | Autumn grass/soil under tree | WebP/AVIF | Static |
| `lm-bg-fence` | Rustic fence behind tree | Alpha WebP | Mid parallax |
| `lm-bg-foreground-left` | Bottom-left foliage frame | Alpha WebP | Foreground parallax |
| `lm-bg-foreground-right` | Bottom-right foliage frame | Alpha WebP | Foreground parallax |

Recommended scenic master canvas: 2560Ã—1440 or larger, composed so a safe centre crop works at 16:9, 16:10 and tablet widths.

## B. Main MapleWish tree

| Asset ID | Description | Runtime form | Motion |
|---|---|---|---|
| `lm-tree-trunk` | Main trunk, roots, major branches | Alpha WebP/PNG | Static |
| `lm-tree-canopy-back` | Rear foliage mass | Alpha WebP | Slow sway A |
| `lm-tree-canopy-mid` | Main foliage mass | Alpha WebP | Slow sway B |
| `lm-tree-canopy-front` | Foreground leaf clusters | Alpha WebP | Slow sway C |
| `lm-tree-face` | Optional subtle face overlay from concept | Alpha PNG | Static / blink optional |
| `lm-tree-hanging-sign` | â€œA Kinder Brighter Canadaâ€ wooden sign shell | Alpha PNG | Tiny pendulum sway |
| `lm-tree-root-shadow` | Soft ground-contact shadow | Alpha WebP | Static |
## C. Interactive tree leaves

The interactive leaf system should sit above the painted canopy. The painted canopy provides visual density; interactive leaves provide ownership and clicking.

| Asset ID | Description | Runtime form |
|---|---|---|
| `lm-leaf-available-green-a` | Available leaf variant A | SVG symbol / alpha PNG |
| `lm-leaf-available-green-b` | Available leaf variant B | SVG symbol / alpha PNG |
| `lm-leaf-claimed-red-a` | Claimed red leaf | SVG symbol / alpha PNG |
| `lm-leaf-claimed-orange-a` | Claimed orange leaf | SVG symbol / alpha PNG |
| `lm-leaf-claimed-yellow-a` | Claimed yellow leaf | SVG symbol / alpha PNG |
| `lm-leaf-claimed-olive-a` | Claimed olive/green leaf | SVG symbol / alpha PNG |
| `lm-leaf-hover-ring` | Soft hover/keyboard-focus highlight | SVG/CSS |
| `lm-leaf-selected-glow` | Selected-leaf glow | SVG/CSS |

Create 2â€“3 silhouette variations and rotate/scale them algorithmically. Do not create thousands of unique image files.

A leaf's tree position must be stable over time. Use `leaf_id` plus a versioned deterministic layout seed, or persist coordinates if the art layout later requires exact authored slots.

## D. Header / navigation

| Asset ID | Description | Runtime form |
|---|---|---|
| `lm-logo-leaf` | Primary red maple-leaf mark | SVG |
| `lm-logo-wordmark` | Optional illustrated wordmark reference | SVG/PNG; text fallback required |
| `lm-nav-shell` | Cream rounded navigation shell | CSS preferred |
| `lm-icon-home` | Home icon | SVG |
| `lm-icon-about` | About/info icon | SVG |
| `lm-icon-how` | How-it-works leaf icon | SVG |
| `lm-icon-impact` | Heart icon | SVG |
| `lm-icon-winners` | Trophy icon | SVG |
| `lm-icon-gift` | Free-entry gift icon | SVG |
## E. Impact / funds-raised panel

| Asset ID | Description | Runtime form |
|---|---|---|
| `lm-panel-impact-frame` | Cream/gold funds-raised card frame | CSS or 9-slice WebP |
| `lm-icon-impact-leaf` | Header maple leaf | SVG |
| `lm-icon-impact-heart` | Leaves-planted stat icon | SVG |
| `lm-icon-impact-people` | People/help stat icon | SVG |
| `lm-icon-impact-community` | Community-powered icon | SVG |
| `lm-icon-info-small` | Small info/help mark | SVG |
| `lm-impact-ribbon` | â€œReal people. Real supportâ€¦â€ decorative ribbon | CSS/frame only; text HTML |

All numbers in this panel are live API data. The panel background may be art; the amounts and labels are DOM text.

## F. Weekly giveaway panel

| Asset ID | Description | Runtime form |
|---|---|---|
| `lm-panel-giveaway-frame` | Left-side cream giveaway card | CSS or 9-slice WebP |
| `lm-icon-giveaway-gift` | Orange/red gift icon | SVG |
| `lm-giveaway-accent-burst` | Small decorative accent strokes | SVG/PNG |
| `lm-button-enter-free-shell` | Optional illustrated CTA shell | CSS preferred |

Prize amount, eligibility line and no-purchase language remain HTML.

## G. Bottom three-step strip

| Asset ID | Description | Runtime form |
|---|---|---|
| `lm-panel-steps-shell` | Wide cream panel behind all three steps | CSS / 9-slice |
| `lm-icon-step-plant` | Red maple leaf | SVG |
| `lm-icon-step-impact` | Red heart | SVG |
| `lm-icon-step-lucky` | Gold trophy | SVG |
| `lm-step-divider` | Thin warm-gold separator | CSS preferred |
## H. Ambient leaf and wind FX

Create these as small transparent sprites with generous alpha padding so rotation does not clip.

| Asset ID | Description |
|---|---|
| `lm-fx-leaf-red-01` / `02` | Two red falling-leaf silhouettes |
| `lm-fx-leaf-orange-01` / `02` | Two orange variants |
| `lm-fx-leaf-yellow-01` / `02` | Two yellow variants |
| `lm-fx-leaf-green-01` / `02` | Two green/olive variants |
| `lm-fx-leaf-small-01` / `02` | Tiny distant leaf variants |
| `lm-fx-wind-swirl-01` / `02` | Very pale curved gust strokes |
| `lm-fx-light-mote` | Soft atmospheric speck/glow |

Target source size per falling leaf: 96â€“160 px square at 2x. Runtime display size is usually 16â€“48 CSS px.

## I. Wildlife / life accents

Concept #3 uses a small perched bird. Keep wildlife restrained.

| Asset ID | Description | Motion |
|---|---|---|
| `lm-bird-idle` | Base perched chickadee-like bird | Static base |
| `lm-bird-blink` | Closed-eye overlay/frame | Occasional blink |
| `lm-bird-look-left` | Tiny head-turn variant | Rare state |
| `lm-bird-look-right` | Tiny head-turn variant | Rare state |
| `lm-bird-wing-twitch` | Optional small wing/tail movement | Rare state |

Do not add more animals to v1 unless they improve the composition after implementation.

## J. Decorative foreground props

| Asset ID | Description |
|---|---|
| `lm-sign-right-good-people` | â€œGood People Grow Hereâ€ sign shell; text can remain baked if purely decorative |
| `lm-rock-left` / `lm-rock-right` | Foreground rock clusters |
| `lm-grass-left` / `lm-grass-right` | Foreground grass/flowers |
| `lm-fallen-leaves-ground` | Ground leaf scatter overlay |
## K. Responsive / mobile art support

The desktop composition cannot simply be scaled down. Prepare safe crops/layers so the tree remains dominant and the core message stays readable.

Recommended responsive exports:
- `lm-bg-mobile`: simplified portrait scenic background, about 1440Ã—1920 source.
- `lm-tree-mobile`: tree composition tuned for 9:16 / tall mobile crops.
- `lm-foreground-mobile`: simplified bottom foliage with reduced obstruction.
- Optional compact panel-frame variants if 9-slice/CSS cannot preserve the concept cleanly.

On mobile, dynamic cards should stack as DOM UI around the tree rather than be rasterized into the scene.

## L. Cutout priority

### P0 â€” required to recreate concept #3
1. Scenic background plate or its major layers.
2. Tree trunk/root layer.
3. Rear, middle and front canopy layers.
4. Interactive maple-leaf silhouettes.
5. Impact panel decorative frame.
6. Giveaway panel decorative frame.
7. Bottom three-step panel frame/icons.
8. Logo maple leaf.
9. 8â€“10 falling-leaf variants.

### P1 â€” makes it feel alive
10. Far cloud layer.
11. Lake shimmer layer/mask.
12. Hanging tree sign.
13. Perched bird + blink/look variants.
14. Foreground foliage layers.
15. Wind-swirl FX.

### P2 â€” polish after desktop/mobile acceptance
16. Extra leaf silhouettes.
17. Additional atmospheric motes.
18. Optional skyline variant.
19. Seasonal palettes / future alternate skins.
## Runtime weight targets

Target budgets for the first visible desktop experience:
- critical background + tree: ideally â‰¤ 1.5 MB compressed total;
- UI/icon assets: â‰¤ 200 KB total;
- ambient FX sprites: â‰¤ 150 KB total;
- optional wildlife loaded after first paint;
- AVIF/WebP preferred for scenic layers with PNG retained as source/master.

Do not ship the full concept image as the production background once the layered version exists. Keep it in `docs/concepts/` as visual truth and comparison reference.

## Acceptance check

The layered recreation is accepted when a side-by-side comparison with concept #3 preserves:
- the same warm sky/autumn palette;
- large centred tree dominance;
- clear left giveaway panel;
- clear top-right impact/funds panel;
- obvious `Enter free` and `Plant a leaf Â· $1` actions;
- readable three-step story at the bottom;
- generous whitespace around key text;
- subtle motion that does not compete with purchasing, free entry, or impact information.
