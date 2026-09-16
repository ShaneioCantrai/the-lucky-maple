const NS = "http://www.w3.org/2000/svg";
const viewport = document.getElementById("treeViewport");
const stage = document.getElementById("treeStage");
const leafLayer = document.getElementById("leafLayer");
const leafDialog = document.getElementById("leafDialog");
const plantDialog = document.getElementById("plantDialog");
const freeEntryDialog = document.getElementById("freeEntryDialog");
const dialogBody = document.getElementById("leafDialogBody");

const sampleOwners = ["Big Dave", "Sarah M.", "NorthernNerd", "MapleMom", "Jofeesh", "A Very Lucky Goose", "Chris from Barrie", "LeafMeAlone"];
const sampleMessages = [
  "I can't believe I bought this.",
  "For the grandkids 🍁",
  "This seemed important at 2AM.",
  "Greetings from Ontario.",
  "My permanent corner of the internet.",
  "Worth every penny. All 100 of them."
];

function seeded(seed) {
  let value = seed >>> 0;
  return () => ((value = Math.imul(1664525, value) + 1013904223 >>> 0) / 4294967296);
}
const random = seeded(8675309);
const leaves = [];
const canopy = [
  [800, 310, 390, 230, 280],
  [520, 430, 280, 190, 155],
  [1080, 420, 300, 205, 165],
  [710, 540, 340, 210, 175],
  [960, 570, 330, 205, 170]
];

function makeLeaf(id, x, y, size, claimed) {
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", "#mapleLeaf");
  use.setAttribute("x", x - size / 2);
  use.setAttribute("y", y - size / 2);
  use.setAttribute("width", size);
  use.setAttribute("height", size);
  use.setAttribute("transform", `rotate(${Math.round(random() * 70 - 35)} ${x} ${y})`);
  const variant = claimed ? `claimed-${["a", "b", "c"][id % 3]}` : "available";
  use.setAttribute("class", `leaf ${variant}`);
  use.dataset.leafId = String(id);
  use.setAttribute("tabindex", "0");
  use.setAttribute("aria-label", claimed ? `Claimed leaf ${id}` : `Available leaf ${id}`);
  leafLayer.appendChild(use);
  return use;
}

let nextId = 1;
for (const [cx, cy, rx, ry, count] of canopy) {
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const x = cx + Math.cos(angle) * rx * radius;
    const y = cy + Math.sin(angle) * ry * radius;
    const size = 27 + random() * 24;
    const claimed = random() < 0.24;
    const id = nextId++;
    const owner = claimed ? sampleOwners[id % sampleOwners.length] : null;
    const message = claimed ? sampleMessages[id % sampleMessages.length] : null;
    leaves.push({ id, claimed, owner, message });
    makeLeaf(id, x, y, size, claimed);
  }
}

document.getElementById("leafCount").textContent = leaves.filter(l => l.claimed).length.toLocaleString("en-CA");

function openLeaf(id) {
  const leaf = leaves.find(item => item.id === id);
  if (!leaf) return;
  if (leaf.claimed) {
    dialogBody.innerHTML = `
      <span class="leaf-card-number">LEAF #${String(id).padStart(6, "0")}</span>
      <h2>${leaf.owner}</h2>
      <div class="leaf-card-message">“${leaf.message}”</div>
      <p>Planted on The Lucky Maple · Ontario, Canada</p>
      <button class="button ghost full" onclick="navigator.clipboard?.writeText(location.href + '#leaf-${id}')">Copy leaf link</button>`;
  } else {
    dialogBody.innerHTML = `
      <span class="leaf-card-number">LEAF #${String(id).padStart(6, "0")}</span>
      <h2>This leaf is available.</h2>
      <p>Put your name and a short message on this exact leaf for $1 CAD.</p>
      <button class="button primary full" id="claimThisLeaf">Plant this leaf · $1</button>
      <small>No account required. Your email receipt contains the recovery link.</small>`;
    dialogBody.querySelector("#claimThisLeaf").addEventListener("click", () => {
      leafDialog.close();
      plantDialog.showModal();
    });
  }
  leafDialog.showModal();
}
leafLayer.addEventListener("click", event => {
  const target = event.target.closest?.(".leaf");
  if (target) openLeaf(Number(target.dataset.leafId));
});
leafLayer.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches?.(".leaf")) {
    event.preventDefault();
    openLeaf(Number(event.target.dataset.leafId));
  }
});

document.querySelectorAll("[data-open]").forEach(button => {
  button.addEventListener("click", event => {
    event.preventDefault();
    const target = button.dataset.open === "plant" ? plantDialog : freeEntryDialog;
    target.showModal();
  });
});
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => button.closest("dialog").close());
});
document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    const box = dialog.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    if (outside) dialog.close();
  });
});

document.getElementById("mockCheckout").addEventListener("click", event => {
  event.currentTarget.textContent = "Checkout wiring comes next";
});
document.getElementById("mockEntry").addEventListener("click", event => {
  event.currentTarget.textContent = "Entry flow wiring comes next";
});
let view = { scale: 1, x: 0, y: 0 };
let drag = null;
function renderView() {
  stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}
function setZoom(nextScale, clientX, clientY) {
  const rect = viewport.getBoundingClientRect();
  const px = (clientX ?? rect.left + rect.width / 2) - rect.left;
  const py = (clientY ?? rect.top + rect.height / 2) - rect.top;
  const oldScale = view.scale;
  const next = Math.max(1, Math.min(5, nextScale));
  view.x = px - (px - view.x) * (next / oldScale);
  view.y = py - (py - view.y) * (next / oldScale);
  view.scale = next;
  renderView();
}
viewport.addEventListener("wheel", event => {
  event.preventDefault();
  setZoom(view.scale * (event.deltaY < 0 ? 1.15 : .87), event.clientX, event.clientY);
}, { passive: false });
viewport.addEventListener("pointerdown", event => {
  if (event.target.closest?.(".leaf")) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: view.x, startY: view.y };
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add("dragging");
});
viewport.addEventListener("pointermove", event => {
  if (!drag || drag.id !== event.pointerId) return;
  view.x = drag.startX + event.clientX - drag.x;
  view.y = drag.startY + event.clientY - drag.y;
  renderView();
});
function endDrag(event) {
  if (!drag || drag.id !== event.pointerId) return;
  drag = null;
  viewport.classList.remove("dragging");
}
viewport.addEventListener("pointerup", endDrag);
viewport.addEventListener("pointercancel", endDrag);

document.getElementById("zoomIn").addEventListener("click", () => setZoom(view.scale * 1.3));
document.getElementById("zoomOut").addEventListener("click", () => setZoom(view.scale / 1.3));
document.getElementById("resetView").addEventListener("click", () => {
  view = { scale: 1, x: 0, y: 0 };
  renderView();
});

const requestedLeaf = location.hash.match(/^#leaf-(\d+)$/);
if (requestedLeaf) setTimeout(() => openLeaf(Number(requestedLeaf[1])), 150);
