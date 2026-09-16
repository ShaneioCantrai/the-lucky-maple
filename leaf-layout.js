export const CANOPY_ZONES = Object.freeze([
  Object.freeze({ cx: 836, cy: 230, rx: 410, ry: 205, count: 270 }),
  Object.freeze({ cx: 590, cy: 350, rx: 270, ry: 165, count: 165 }),
  Object.freeze({ cx: 1080, cy: 345, rx: 290, ry: 175, count: 170 }),
  Object.freeze({ cx: 745, cy: 440, rx: 330, ry: 170, count: 185 }),
  Object.freeze({ cx: 960, cy: 455, rx: 310, ry: 165, count: 175 })
]);

export const STARTER_FOLIAGE_RATE = 0.18;
export const STARTER_FOLIAGE_SEED = 20260917;
export const PURCHASE_ORDER_SEED = 20260918;

export function seeded(seed) {
  let value = seed >>> 0;
  return () => ((value = Math.imul(1664525, value) + 1013904223 >>> 0) / 4294967296);
}

function shuffled(values, random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
let nextSlot = 1;
export const ZONE_LEAF_SLOTS = Object.freeze(CANOPY_ZONES.map(zone => {
  const slots = Array.from({ length: zone.count }, (_, index) => nextSlot + index);
  nextSlot += zone.count;
  return Object.freeze(slots);
}));
export const TOTAL_LEAF_SLOTS = nextSlot - 1;

function buildStarterLeafSlots() {
  const random = seeded(STARTER_FOLIAGE_SEED);
  const selected = [];
  for (const slots of ZONE_LEAF_SLOTS) {
    const starterCount = Math.round(slots.length * STARTER_FOLIAGE_RATE);
    selected.push(...shuffled(slots, random).slice(0, starterCount));
  }
  return selected.sort((a, b) => a - b);
}

export const STARTER_LEAF_SLOTS = Object.freeze(buildStarterLeafSlots());
const starterLeafSlotSet = new Set(STARTER_LEAF_SLOTS);

export function isStarterLeafSlot(slot) {
  return starterLeafSlotSet.has(Number(slot));
}
function interleave(zoneLists) {
  const result = [];
  const maxLength = Math.max(...zoneLists.map(list => list.length));
  for (let index = 0; index < maxLength; index += 1) {
    for (const list of zoneLists) {
      if (index < list.length) result.push(list[index]);
    }
  }
  return result;
}

function buildPurchaseLeafSlotOrder() {
  const random = seeded(PURCHASE_ORDER_SEED);
  const regular = ZONE_LEAF_SLOTS.map(slots => shuffled(slots.filter(slot => !isStarterLeafSlot(slot)), random));
  const starter = ZONE_LEAF_SLOTS.map(slots => shuffled(slots.filter(isStarterLeafSlot), random));
  return [...interleave(regular), ...interleave(starter)];
}

export const PURCHASE_LEAF_SLOT_ORDER = Object.freeze(buildPurchaseLeafSlotOrder());

export function nextAvailableLeafSlot(occupiedSlots = []) {
  const occupied = occupiedSlots instanceof Set ? occupiedSlots : new Set([...occupiedSlots].map(Number));
  return PURCHASE_LEAF_SLOT_ORDER.find(slot => !occupied.has(slot)) ?? null;
}
