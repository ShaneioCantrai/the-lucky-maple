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

function seeded(seed) {
  let value = seed >>> 0;
  return () => ((value = Math.imul(1664525, value) + 1013904223 >>> 0) / 4294967296);
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
function money(cents) { return `$${(Number(cents || 0) / 100).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD`; }
const random = seeded(8675309);
const leaves = [];
const canopyZones = [
  [836, 230, 410, 205, 270],
  [590, 350, 270, 165, 165],
  [1080, 345, 290, 175, 170],
  [745, 440, 330, 170, 185],
  [960, 455, 310, 165, 175]
];

function makeLeafElement(leaf) {
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", "#mapleLeaf");
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
  leaf.element.setAttribute("class", `leaf ${variant}`);
  leaf.element.setAttribute("aria-label", leaf.claimed ? `Claimed leaf ${leaf.id}` : `Available leaf ${leaf.id}`);
}

let nextId = 1;
for (const [cx, cy, rx, ry, count] of canopyZones) {
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const leaf = {
      id: nextId++, x: cx + Math.cos(angle) * rx * radius, y: cy + Math.sin(angle) * ry * radius,
      size: 16 + random() * 15, rotation: Math.round(random() * 80 - 40), claimed: random() < .22,
      owner: null, message: null, element: null
    };
    if (leaf.claimed) {
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
    dialogBody.innerHTML = `<span class="leaf-card-number">LEAF #${number}</span>
      <h2>${escapeHtml(leaf.owner || "Lucky Maple Friend")}</h2>
      <div class="leaf-card-message">“${escapeHtml(leaf.message || "Planted on The Lucky Maple.")}”</div>
      <button class="button ghost full" id="copyLeafLink">Copy leaf link</button>`;
    dialogBody.querySelector("#copyLeafLink").addEventListener("click", () => navigator.clipboard?.writeText(`${location.origin}${location.pathname}#leaf-${id}`));
  } else {
    dialogBody.innerHTML = `<span class="leaf-card-number">LEAF #${number}</span>
      <h2>This leaf is available.</h2><p>Put your name and a short message on this exact leaf for $1 CAD.</p>
      <button class="button primary full" id="claimThisLeaf">Plant this leaf · $1</button>`;
    dialogBody.querySelector("#claimThisLeaf").addEventListener("click", () => { leafDialog.close(); plantDialog.showModal(); });
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
    (button.dataset.open === "plant" ? plantDialog : freeEntryDialog).showModal();
  });
});
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
});

document.getElementById("mockCheckout").addEventListener("click", event => {
  event.currentTarget.textContent = "Payment wiring comes next";
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
async function loadPublicData() {
  try {
    const statsResponse = await fetch("/api/stats", { headers: { Accept: "application/json" } });
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      updateLeafCount(stats.leavesPlanted);
      document.getElementById("fundsRaised").textContent = money(stats.helpAllocatedCents);
      document.getElementById("impactDelivered").textContent = money(stats.helpDeliveredCents).replace(" CAD", "");
    }
  } catch { /* static prototype fallback */ }

  try {
    const contestResponse = await fetch("/api/contest/current", { headers: { Accept: "application/json" } });
    if (contestResponse.ok) {
      const { contest } = await contestResponse.json();
      if (contest) {
        const amount = money(contest.prize_cents);
        document.getElementById("prizeAmount").textContent = amount;
        document.getElementById("impactPrize").textContent = amount.replace(".00 CAD", "");
      }
    }
  } catch { /* static prototype fallback */ }
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
  sessionStorage.setItem("luckyMapleIncomingVia", incomingShare.searchParams.get("via"));
  sessionStorage.setItem("luckyMapleIncomingChannel", incomingShare.searchParams.get("share") || "unknown");
}
updateShareCount(false);
