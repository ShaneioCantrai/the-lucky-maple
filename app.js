const NS = "http://www.w3.org/2000/svg";
const leafLayer = document.getElementById("leafLayer");
const leafDialog = document.getElementById("leafDialog");
const plantDialog = document.getElementById("plantDialog");
const freeEntryDialog = document.getElementById("freeEntryDialog");
const dialogBody = document.getElementById("leafDialogBody");
const ambientLeaves = document.getElementById("ambientLeaves");

const sampleOwners = ["Big Dave", "Sarah M.", "NorthernNerd", "MapleMom", "Jofeesh", "A Very Lucky Goose", "Chris from Barrie", "LeafMeAlone"];
const sampleMessages = [
  "I can't believe I bought this.", "For the grandkids 🍁", "This seemed important at 2AM.",
  "Greetings from Ontario.", "My permanent corner of the internet.", "Worth every penny. All 100 of them."
];

const plantNamePlaceholders = [
  "Big Dave", "Definitely Not A Moose", "Maple McMapleface", "Leaf Erikson",
  "Captain Syrup", "Your Favourite Cousin", "Just Some Canadian", "Not A Bot, Promise",
  "NorthernNerd", "Sorry Eh", "Professional Leaf Owner", "Person With Excellent Priorities"
];
const plantMessagePlaceholders = [
  "I can't believe I bought this.", "This felt financially responsible.", "Cheaper than naming a star.",
  "Please tell my accountant this was necessary.", "I came. I saw. I planted.", "Future historians: you're welcome.",
  "One dollar. Zero regrets.", "Apparently I own internet foliage now.", "Put this on my permanent record.",
  "Mom, look! I own a leaf.", "I was told there'd be maple syrup.", "This seemed important at 2AM."
];
let lastPlantNamePlaceholder = null;
let lastPlantMessagePlaceholder = null;

function randomDifferent(options, previous) {
  if (options.length < 2) return options[0] || "";
  let choice;
  do choice = options[Math.floor(Math.random() * options.length)]; while (choice === previous);
  return choice;
}
function refreshPlantPlaceholders() {
  const nameInput = document.getElementById("plantName");
  const messageInput = document.getElementById("plantMessage");
  const emailInput = document.getElementById("plantEmail");
  lastPlantNamePlaceholder = randomDifferent(plantNamePlaceholders, lastPlantNamePlaceholder);
  lastPlantMessagePlaceholder = randomDifferent(plantMessagePlaceholders, lastPlantMessagePlaceholder);
  if (nameInput) nameInput.placeholder = lastPlantNamePlaceholder;
  if (messageInput) messageInput.placeholder = lastPlantMessagePlaceholder;
  if (emailInput) emailInput.placeholder = "you@example.com";
}
function openPlantDialog() {
  refreshPlantPlaceholders();
  plantDialog.showModal();
}

function seeded(seed) {
  let value = seed >>> 0;
  return () => ((value = Math.imul(1664525, value) + 1013904223 >>> 0) / 4294967296);
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
function money(cents) { return `$${(Number(cents || 0) / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD`; }
function leafTierForAmount(cents) {
  const dollars = Number(cents || 0) / 100;
  if (dollars >= 25) return 25;
  if (dollars >= 10) return 10;
  if (dollars >= 5) return 5;
  return 1;
}
function leafScaleForAmount(cents) {
  return ({ 1: 1, 5: 1.25, 10: 1.5, 25: 1.85 })[leafTierForAmount(cents)];
}
function tierName(cents) {
  return ({ 1: 'Leaf', 5: 'Bigger leaf', 10: 'Large leaf', 25: 'Largest leaf' })[leafTierForAmount(cents)];
}
const random = seeded(8675309);
const tierRandom = seeded(20260916);
const leaves = [];
const canopyZones = [
  [836, 230, 410, 205, 270],
  [590, 350, 270, 165, 165],
  [1080, 345, 290, 175, 170],
  [745, 440, 330, 170, 185],
  [960, 455, 310, 165, 175]
];

function makeLeafElement(leaf) {
  const use = document.createElementNS(NS, "image");
  use.setAttribute("preserveAspectRatio", "xMidYMid meet");
  use.setAttribute("x", leaf.x - leaf.size / 2);
  use.setAttribute("y", leaf.y - leaf.size / 2);
  use.setAttribute("width", leaf.size);
  use.setAttribute("height", leaf.size);
  use.setAttribute("transform", `rotate(${leaf.rotation} ${leaf.x} ${leaf.y})`);
  use.dataset.leafId = String(leaf.id);
  use.setAttribute("tabindex", "0");
  leaf.element = use;
  leafLayer.appendChild(use);
  refreshLeafElement(leaf);
}
function refreshLeafElement(leaf) {
  if (!leaf.element) return;
  const variant = leaf.claimed ? `claimed-${["a", "b", "c"][leaf.id % 3]}` : "available";
  const spriteIndex = leaf.spriteVariant || (leaf.claimed ? ((leaf.id * 7) % 12) + 1 : 6);
  leaf.element.setAttribute("x", leaf.x - leaf.size / 2);
  leaf.element.setAttribute("y", leaf.y - leaf.size / 2);
  leaf.element.setAttribute("width", leaf.size);
  leaf.element.setAttribute("height", leaf.size);
  leaf.element.setAttribute("transform", `rotate(${leaf.rotation} ${leaf.x} ${leaf.y})`);
  leaf.element.setAttribute("href", `img/web/leaves/leaf-${String(spriteIndex).padStart(2, "0")}.webp`);
  leaf.element.setAttribute("class", `leaf ${variant} leaf-tier-${leafTierForAmount(leaf.amountCents)}`);
  leaf.element.setAttribute("aria-label", leaf.claimed ? `Claimed ${tierName(leaf.amountCents)} ${leaf.id}` : `Available leaf ${leaf.id}`);
}

let nextId = 1;
for (const [cx, cy, rx, ry, count] of canopyZones) {
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const baseSize = 22 + random() * 16;
    const leaf = {
      id: nextId++, x: cx + Math.cos(angle) * rx * radius, y: cy + Math.sin(angle) * ry * radius,
      baseSize, size: baseSize, rotation: Math.round(random() * 80 - 40), claimed: random() < .22,
      amountCents: 0, spriteVariant: null, owner: null, message: null, element: null
    };
    if (leaf.claimed) {
      const tierRoll = tierRandom();
      leaf.amountCents = tierRoll < .60 ? 100 : tierRoll < .82 ? 500 : tierRoll < .94 ? 1000 : [2500, 5000, 10000][Math.floor(tierRandom() * 3)];
      leaf.size = leaf.baseSize * leafScaleForAmount(leaf.amountCents);
      leaf.owner = sampleOwners[leaf.id % sampleOwners.length];
      leaf.message = sampleMessages[leaf.id % sampleMessages.length];
    }
    leaves.push(leaf);
    makeLeafElement(leaf);
  }
}
function updateLeafCount(value = leaves.filter(leaf => leaf.claimed).length) {
  document.getElementById("leafCount").textContent = Number(value).toLocaleString("en-CA");
  document.getElementById("impactLeaves").textContent = Number(value).toLocaleString("en-CA");
}
updateLeafCount();

function openLeaf(id) {
  const leaf = leaves.find(item => item.id === id);
  if (!leaf) return;
  const number = String(id).padStart(6, "0");
  if (leaf.claimed) {
    const contributionAmount = money(leaf.amountCents || 100).replace(".00 CAD", "");
    dialogBody.innerHTML = `<span class="leaf-card-number">LEAF #${number}</span>
      <h2>${escapeHtml(leaf.owner || "Lucky Maple Friend")}</h2>
      <div class="leaf-contribution">🍁 ${contributionAmount} · ${tierName(leaf.amountCents || 100)}</div>
      <div class="leaf-card-message">“${escapeHtml(leaf.message || "Planted on The Lucky Maple.")}”</div>
      <button class="button ghost full" id="copyLeafLink">Copy leaf link</button>`;
    dialogBody.querySelector("#copyLeafLink").addEventListener("click", () => navigator.clipboard?.writeText(`${location.origin}${location.pathname}#leaf-${id}`));
  } else {
    dialogBody.innerHTML = `<span class="leaf-card-number">LEAF #${number}</span>
      <h2>This leaf is available.</h2><p>Plant it for $1, or choose $5, $10, or $25+ to grow a bigger leaf.</p>
      <button class="button primary full" id="claimThisLeaf">Choose your leaf size</button>`;
    dialogBody.querySelector("#claimThisLeaf").addEventListener("click", () => { leafDialog.close(); openPlantDialog(); });
  }
  leafDialog.showModal();
}
leafLayer.addEventListener("click", event => {
  const target = event.target.closest?.(".leaf");
  if (target) openLeaf(Number(target.dataset.leafId));
});
leafLayer.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches?.(".leaf")) {
    event.preventDefault(); openLeaf(Number(event.target.dataset.leafId));
  }
});

document.querySelectorAll("[data-open]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    if (button.dataset.open === "plant") openPlantDialog();
    else freeEntryDialog.showModal();
  });
});
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
});

let selectedLeafAmount = 1;
function selectedContributionAmount() {
  if (selectedLeafAmount !== 25) return selectedLeafAmount;
  const custom = Math.max(25, Number(document.getElementById("plantAmount")?.value || 25));
  return Math.round(custom * 100) / 100;
}
function refreshContributionPicker() {
  document.querySelectorAll("[data-leaf-amount]").forEach(button => {
    button.classList.toggle("selected", Number(button.dataset.leafAmount) === selectedLeafAmount);
  });
  document.getElementById("customAmountLabel")?.classList.toggle("hidden", selectedLeafAmount !== 25);
  const amount = selectedContributionAmount();
  document.getElementById("mockCheckout").textContent = `Continue · $${amount.toLocaleString("en-CA", { maximumFractionDigits: 2 })} CAD`;
}
document.querySelectorAll("[data-leaf-amount]").forEach(button => {
  button.addEventListener("click", () => {
    selectedLeafAmount = Number(button.dataset.leafAmount);
    refreshContributionPicker();
  });
});
document.getElementById("plantAmount")?.addEventListener("input", refreshContributionPicker);
refreshContributionPicker();
document.getElementById("mockCheckout").addEventListener("click", event => {
  const amount = selectedContributionAmount();
  event.currentTarget.textContent = `Payment wiring comes next · $${amount.toLocaleString("en-CA", { maximumFractionDigits: 2 })}`;
  setTimeout(refreshContributionPicker, 1600);
});

const SHARE_ID_KEY = "luckyMapleShareId";
const SHARE_COUNT_KEY = "luckyMapleShareStarts";
function getShareId() {
  let value = localStorage.getItem(SHARE_ID_KEY);
  if (!value) {
    value = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase();
    localStorage.setItem(SHARE_ID_KEY, value);
  }
  return value;
}
function shareUrl(channel) {
  const url = new URL(location.href);
  url.hash = "";
  url.searchParams.delete("via");
  url.searchParams.delete("share");
  url.searchParams.set("via", getShareId());
  url.searchParams.set("share", channel);
  return url.toString();
}
function recordShareEvent(eventType, channel, shareId = getShareId()) {
  fetch('/api/share-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, shareId, channel })
  }).catch(() => {});
}

function createAmbientLeaves() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const count = innerWidth < 760 ? 4 : 9;
  const colours = ["#d94832", "#e9742d", "#e1ad32", "#7c8f4e"];
  for (let i = 0; i < count; i++) {
    const holder = document.createElement("span");
    holder.className = "falling-leaf";
    holder.style.setProperty("--left", `${8 + Math.random() * 84}%`);
    holder.style.setProperty("--size", `${14 + Math.random() * 18}px`);
    holder.style.setProperty("--opacity", `${.45 + Math.random() * .42}`);
    holder.style.setProperty("--duration", `${10 + Math.random() * 9}s`);
    holder.style.setProperty("--delay", `${-Math.random() * 14}s`);
    holder.style.setProperty("--drift", `${-85 + Math.random() * 170}px`);
    holder.style.setProperty("--start-rot", `${Math.round(Math.random() * 180)}deg`);
    holder.style.setProperty("--leaf-colour", colours[i % colours.length]);
    holder.innerHTML = `<svg viewBox="-18 -20 36 42" aria-hidden="true"><use href="#mapleLeaf"></use></svg>`;
    ambientLeaves.appendChild(holder);
  }
}
createAmbientLeaves();

document.addEventListener("visibilitychange", () => document.body.classList.toggle("motion-paused", document.hidden));

const requestedLeaf = location.hash.match(/^#leaf-(\d+)$/);
if (requestedLeaf) setTimeout(() => openLeaf(Number(requestedLeaf[1])), 180);
function hydrateCampaignLeaves(rows = []) {
  leaves.forEach(leaf => {
    leaf.claimed = false;
    leaf.amountCents = 0;
    leaf.size = leaf.baseSize;
    leaf.owner = null;
    leaf.message = null;
    leaf.spriteVariant = null;
    refreshLeafElement(leaf);
  });
  let filled = 0;
  for (const row of rows) {
    const slot = Number(row.leaf_slot);
    const leaf = leaves[slot - 1];
    if (!leaf) continue;
    leaf.claimed = true;
    leaf.amountCents = Number(row.gross_cents || 100);
    leaf.size = leaf.baseSize * leafScaleForAmount(leaf.amountCents);
    leaf.owner = row.display_name || "Anonymous Canadian";
    leaf.message = row.message || "Planted on The Lucky Maple.";
    leaf.spriteVariant = Number(row.sprite_variant) || null;
    refreshLeafElement(leaf);
    filled += 1;
  }
  updateLeafCount(filled);
}

async function loadPublicData() {
  let activeCampaign = null;
  try {
    const campaignResponse = await fetch("/api/campaign/current", { headers: { Accept: "application/json" } });
    if (campaignResponse.ok) {
      const data = await campaignResponse.json();
      activeCampaign = data.campaign;
      if (activeCampaign) {
        document.getElementById("fundsRaised").textContent = money(activeCampaign.raised_cents);
        updateLeafCount(activeCampaign.leaves_filled);
        const leafResponse = await fetch("/api/campaign/leaves", { headers: { Accept: "application/json" } });
        if (leafResponse.ok) hydrateCampaignLeaves((await leafResponse.json()).leaves || []);
      }
    }
  } catch { /* static prototype fallback */ }

  if (!activeCampaign) {
    try {
      const statsResponse = await fetch("/api/stats", { headers: { Accept: "application/json" } });
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        updateLeafCount(stats.leavesPlanted);
        document.getElementById("fundsRaised").textContent = money(stats.helpAllocatedCents);
        document.getElementById("impactDelivered").textContent = money(stats.helpDeliveredCents).replace(" CAD", "");
        const legacyResponse = await fetch("/api/leaves", { headers: { Accept: "application/json" } });
        if (legacyResponse.ok) {
          const legacy = (await legacyResponse.json()).leaves || [];
          hydrateCampaignLeaves(legacy.map((leaf, index) => ({
            leaf_slot: index + 1, gross_cents: 100,
            display_name: leaf.display_name, message: leaf.message,
            sprite_variant: ((Number(leaf.id) * 7) % 12) + 1
          })));
        }
      }
    } catch { /* static prototype fallback */ }
  }

  try {
    const contestResponse = await fetch("/api/contest/current", { headers: { Accept: "application/json" } });
    if (contestResponse.ok) {
      const { contest } = await contestResponse.json();
      if (contest) {
        const amount = money(contest.prize_cents);
        const prizeNode = document.getElementById("prizeAmount");
        if (prizeNode) prizeNode.textContent = amount;
        const impactPrize = document.getElementById("impactPrize");
        if (impactPrize) impactPrize.textContent = amount.replace(".00 CAD", "");
      }
    }
  } catch { /* optional legacy contest data */ }
}
loadPublicData();
document.getElementById("submitEntry").addEventListener("click", async event => {
  const button = event.currentTarget;
  const status = document.getElementById("entryStatus");
  if (!document.getElementById("entryRules").checked) {
    status.textContent = "Please confirm that you are 18+ and accept the Official Rules.";
    return;
  }
  const payload = {
    name: document.getElementById("entryName").value.trim(),
    email: document.getElementById("entryEmail").value.trim(),
    province: document.getElementById("entryProvince").value,
    country: "CA", ageConfirmed: true, rulesAccepted: true,
    marketingConsent: document.getElementById("entryMarketing").checked,
    entryMethod: "free"
  };
  button.disabled = true; status.textContent = "Submitting…";
  try {
    const response = await fetch("/api/contest/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Entry could not be submitted.");
    status.textContent = data.alreadyEntered ? "You’re already entered for this week." : "You’re in. Good luck! 🍁";
  } catch (error) { status.textContent = error.message || "The entry service is not available yet."; }
  finally { button.disabled = false; }
});


function updateShareCount(increment = false) {
  let count = Number(localStorage.getItem(SHARE_COUNT_KEY) || 0);
  if (increment) {
    count += 1;
    localStorage.setItem(SHARE_COUNT_KEY, String(count));
  }
  const node = document.getElementById("shareClicks");
  if (node) node.textContent = count.toLocaleString("en-CA");
}
function showShareToast(message) {
  let toast = document.querySelector(".share-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "share-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showShareToast.timer);
  showShareToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}
async function copyShareLink(channel = "copy") {
  const url = shareUrl(channel);
  try {
    await navigator.clipboard.writeText(url);
    showShareToast("Trackable share link copied");
  } catch {
    window.prompt("Copy this link:", url);
  }
}

async function handleShare(channel) {
  updateShareCount(true);
  recordShareEvent('share_start', channel);
  const url = shareUrl(channel);
  const title = "The Lucky Maple";
  const text = "Small leaf. Big change. Help this maple tree reach one more Canadian.";
  if (channel === "native") {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; }
      catch (error) { if (error?.name === "AbortError") return; }
    }
    await copyShareLink("native");
    return;
  }
  if (channel === "facebook") window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer,width=680,height=520");
  else if (channel === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
  else if (channel === "x") window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer,width=680,height=520");
  else if (channel === "email") location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
  else if (channel === "copy") await copyShareLink("copy");
}

document.querySelectorAll("[data-share]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    handleShare(button.dataset.share || "native");
  });
});

const incomingShare = new URL(location.href);
if (incomingShare.searchParams.get("via")) {
  const via = incomingShare.searchParams.get("via");
  const channel = incomingShare.searchParams.get("share") || "unknown";
  sessionStorage.setItem("luckyMapleIncomingVia", via);
  sessionStorage.setItem("luckyMapleIncomingChannel", channel);
  const visitKey = `luckyMapleVisit:${via}:${channel}`;
  if (!sessionStorage.getItem(visitKey)) {
    sessionStorage.setItem(visitKey, '1');
    recordShareEvent('visit', channel, via);
  }
}
updateShareCount(false);
