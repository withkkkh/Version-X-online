import { config } from "./config.js";

const byId = id => document.getElementById(id);
const picks = byId("choices");
const dialog = byId("receipt");
const lift = byId("lift");
const paper = byId("paper");

const reopen = byId("reopen");
const lookup = new Map(config.options.map(option => [option.id, option]));
const storageKey = "version-x-paper-choice";
let selectedChoice = null;
let inFlight = false;
let active = null;


try {
  const saved = localStorage.getItem(storageKey);
  if (lookup.has(saved)) selectedChoice = saved;
} catch {
  // The poster still works for this page session.
}

byId("question").textContent = config.question;
byId("instruction").textContent = config.instruction;
byId("invite-title").textContent = config.invitation.title;
byId("venue").textContent = config.invitation.venue;
if (config.invitation.time) {
  byId("time").textContent = config.invitation.time;
  byId("time").hidden = false;
}
if (config.invitation.link) {
  byId("invite-link").href = config.invitation.link;
  byId("invite-link").hidden = false;
}
if (config.invitation.qrImage) {
  byId("qr").src = config.invitation.qrImage;
  byId("qr").hidden = false;
  byId("qr-placeholder").hidden = true;
}

picks.style.setProperty("--count", config.options.length);
for (const option of config.options) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "strip";
  button.dataset.choice = option.id;
  button.setAttribute("aria-label", "撕下「" + option.label + "」");

  const label = document.createElement("span");
  label.className = "strip-label";
  label.textContent = option.label;
  const arrow = document.createElement("span");
  arrow.className = "strip-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↓";
  button.append(label, arrow);
  picks.append(button);

  button.addEventListener("pointerdown", event => {
    if (selectedChoice || inFlight || active || event.button !== 0) return;
    active = { id: event.pointerId, y: event.clientY, button, distance: 0 };
    button.setPointerCapture(event.pointerId);
    button.classList.add("dragging");
  });
  button.addEventListener("pointermove", event => {
    if (active?.id !== event.pointerId || active.button !== button) return;
    active.distance = Math.max(0, event.clientY - active.y);
    const pull = Math.min(57, active.distance * .76);
    button.style.setProperty("--pull", pull + "px");
    button.style.setProperty("--curl", -Math.min(42, pull * .7) + "deg");
  });
  function finishPointer(event, release) {
    if (active?.id !== event.pointerId || active.button !== button) return;
    const distance = active.distance;
    const visual = button.getBoundingClientRect();
    active = null;
    button.classList.remove("dragging");
    button.style.removeProperty("--pull");
    button.style.removeProperty("--curl");
    if (release && distance >= 36) tear(button, visual);
  }
  button.addEventListener("pointerup", event => finishPointer(event, true));
  button.addEventListener("pointercancel", event => finishPointer(event, false));
  button.addEventListener("lostpointercapture", event => finishPointer(event, false));
  button.addEventListener("click", () => tear(button, button.getBoundingClientRect()));
}

function markChoice() {
  const tabs = [...picks.querySelectorAll(".strip")];
  const choiceIndex = tabs.findIndex(button => button.dataset.choice === selectedChoice);
  for (const button of tabs) {
    button.classList.toggle("torn", button.dataset.choice === selectedChoice);
    button.disabled = true;
  }
  const poster = byId("poster");
  poster.style.setProperty("--tear-left", (100 * choiceIndex / tabs.length) + "%");
  poster.style.setProperty("--tear-width", (100 / tabs.length) + "%");
  poster.classList.add("has-vote");
  picks.classList.add("voted");
  reopen.hidden = false;
}

async function tear(button, origin) {
  if (inFlight || selectedChoice) return;
  inFlight = true;
  const choice = button.dataset.choice;
  let animation;

  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    animation = button.animate(
      [{ transform: "translateY(0) rotateX(-9deg)" }, { transform: "translateY(18px) rotateX(-23deg) rotateZ(-5deg)" }],
      { duration: 165, fill: "forwards", easing: "cubic-bezier(.29,.72,.35,1)" }
    );
    await animation.finished.catch(() => {});
    origin = button.getBoundingClientRect();
  }

  selectedChoice = choice;
  try {
    localStorage.setItem(storageKey, choice);
  } catch {
    // Remember the choice until the current page is closed.
  }
  markChoice();
  animation?.cancel();
  inFlight = false;
  showReceipt(origin);
}

function showReceipt(origin) {
  const option = lookup.get(selectedChoice);
  byId("front-label").textContent = option.label;
  byId("your-choice").textContent = option.label;
  dialog.showModal();
  if (!origin || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    paper.style.transform = "rotateY(180deg)";
    byId("close").focus();
    return;
  }

  paper.style.transform = "rotateY(0deg)";
  const target = lift.getBoundingClientRect();
  const offsetX = origin.left + origin.width / 2 - target.left - target.width / 2;
  const offsetY = origin.top + origin.height / 2 - target.top - target.height / 2;
  const expand = lift.animate([
    { transform: `translate(${offsetX}px,${offsetY}px) scale(${origin.width / target.width},${origin.height / target.height}) rotate(-5deg)` },
    { transform: "translate(0,0) scale(1) rotate(0)" }
  ], { duration: 540, easing: "cubic-bezier(.16,.89,.3,1)", fill: "both" });
  expand.finished.then(() => {
    if (!dialog.open) return;
    expand.cancel();
    const flip = paper.animate(
      [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }],
      { duration: 600, easing: "cubic-bezier(.45,.05,.24,1)", fill: "both" }
    );
    paper.style.transform = "rotateY(180deg)";
    flip.finished.then(() => {
      flip.cancel();
      if (dialog.open) byId("close").focus();
    }).catch(() => {});
  }).catch(() => {});
}

byId("close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => {
  for (const animation of [...lift.getAnimations(), ...paper.getAnimations()]) animation.cancel();
  reopen.focus();
});
reopen.addEventListener("click", () => showReceipt());
if (selectedChoice) markChoice();
