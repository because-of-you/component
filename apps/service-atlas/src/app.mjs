import { loadCatalogue } from "./config.mjs";
import { createFlowPlayer } from "./flow-player.mjs";
import { getFocusState } from "./graph.mjs";
import { renderAtlas } from "./render-atlas.mjs";
import { renderServiceDetails } from "./service-details.mjs";

const overlay = document.querySelector("#atlas-overlay");
const error = document.querySelector("#atlas-error");
const details = document.querySelector("#service-details");
const stage = document.querySelector(".atlas-stage");
const coarsePointer = window.matchMedia("(pointer: coarse)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let selectedId = null;
let rootSvg = null;
let catalogue = null;
let flowPlayer = null;
let clearTimer = null;

function syncAnimations() {
  flowPlayer?.sync();
}

function cancelClearFocus() {
  if (clearTimer === null) return;
  window.clearTimeout(clearTimer);
  clearTimer = null;
}

function hideDetails() {
  if (!details) return;
  details.hidden = true;
  details.replaceChildren();
}

function positionDetails(landmark) {
  if (!details || !stage || !landmark) return;

  const stageRect = stage.getBoundingClientRect();
  const landmarkRect = landmark.getBoundingClientRect();
  const gap = 14;
  const edge = 16;
  let left = landmarkRect.right - stageRect.left + gap;
  let top = landmarkRect.top - stageRect.top + (landmarkRect.height - details.offsetHeight) / 2;

  if (left + details.offsetWidth > stage.clientWidth - edge) {
    left = landmarkRect.left - stageRect.left - details.offsetWidth - gap;
  }
  left = Math.max(edge, Math.min(left, stage.clientWidth - details.offsetWidth - edge));
  top = Math.max(edge, Math.min(top, stage.clientHeight - details.offsetHeight - edge));

  details.style.left = `${Math.round(left)}px`;
  details.style.top = `${Math.round(top)}px`;
}

function showDetails(serviceId) {
  if (!details) return;
  const service = catalogue?.services.find(({ id }) => id === serviceId);
  const landmark = overlay?.querySelector(`[data-service-id="${CSS.escape(serviceId)}"]`);
  if (!service || !landmark) return;

  details.innerHTML = renderServiceDetails(service);
  details.hidden = false;
  positionDetails(landmark);
}

function clearFocus() {
  if (!overlay) return;

  cancelClearFocus();

  overlay
    .querySelectorAll(".is-active, .is-direct, .is-indirect, .is-muted, .is-selected")
    .forEach((node) => {
      node.classList.remove("is-active", "is-direct", "is-indirect", "is-muted", "is-selected");
    });
  selectedId = null;
  hideDetails();
}

function scheduleClearFocus() {
  cancelClearFocus();
  clearTimer = window.setTimeout(() => {
    clearTimer = null;
    clearFocus();
  }, 180);
}

function applyFocus(serviceId) {
  if (!overlay || !serviceId) return false;

  cancelClearFocus();

  let state;
  try {
    state = getFocusState(catalogue, serviceId);
  } catch {
    return false;
  }

  clearFocus();
  selectedId = serviceId;
  const activeLayers = new Set();

  overlay.querySelectorAll("[data-service-id]").forEach((landmark) => {
    const id = landmark.dataset.serviceId;
    const isRelated = id === serviceId || state.directNodes.has(id) || state.indirectNodes.has(id);
    if (id === serviceId) landmark.classList.add("is-selected", "is-direct");
    else if (state.directNodes.has(id)) landmark.classList.add("is-direct");
    else if (state.indirectNodes.has(id)) landmark.classList.add("is-indirect");
    else landmark.classList.add("is-muted");
    if (isRelated && landmark.dataset.layer != null) activeLayers.add(landmark.dataset.layer);
  });

  overlay.querySelectorAll(".layer-guide[data-layer]").forEach((guide) => {
    if (activeLayers.has(guide.dataset.layer)) guide.classList.add("is-active");
    else guide.classList.add("is-muted");
  });

  overlay
    .querySelectorAll(".road-group[data-relation-index]")
    .forEach((relationGroup) => {
      const index = Number.parseInt(relationGroup.dataset.relationIndex ?? "", 10);
      if (state.directRelations.has(index)) relationGroup.classList.add("is-direct");
      else if (state.indirectRelations.has(index)) relationGroup.classList.add("is-indirect");
      else relationGroup.classList.add("is-muted");
    });

  showDetails(serviceId);

  return true;
}

function previewFocus(serviceId) {
  const rememberedId = selectedId;
  const applied = applyFocus(serviceId);
  selectedId = rememberedId;
  return applied;
}

function getLandmark(target) {
  if (!(target instanceof Element)) return null;
  const landmark = target.closest("[data-service-id]");
  return landmark && overlay?.contains(landmark) ? landmark : null;
}

function getLandmarkId(target) {
  return getLandmark(target)?.dataset.serviceId ?? null;
}

try {
  if (!overlay) throw new Error("Missing atlas overlay mount point");
  catalogue = await loadCatalogue();
  overlay.innerHTML = await renderAtlas(catalogue);
  rootSvg = overlay.querySelector(".atlas-overlay");
  flowPlayer = createFlowPlayer({ svg: rootSvg, catalogue, reducedMotion });
  document.addEventListener("visibilitychange", syncAnimations);
  reducedMotion.addEventListener?.("change", syncAnimations);
  syncAnimations();

  overlay.addEventListener("pointerover", (event) => {
    if (coarsePointer.matches) return;
    const serviceId = getLandmarkId(event.target);
    if (serviceId) applyFocus(serviceId);
    else scheduleClearFocus();
  });

  overlay.addEventListener("focusin", (event) => {
    const serviceId = getLandmarkId(event.target);
    if (!serviceId) return;

    // Touch browsers can focus a link immediately before dispatching click.
    // Preserve the last deliberate tap so the first tap still previews.
    if (coarsePointer.matches) previewFocus(serviceId);
    else applyFocus(serviceId);
  });

  overlay.addEventListener("pointerleave", (event) => {
    if (details?.contains(event.relatedTarget)) return;
    if (!coarsePointer.matches) scheduleClearFocus();
  });

  overlay.addEventListener("focusout", (event) => {
    if (coarsePointer.matches || overlay.contains(event.relatedTarget) || details?.contains(event.relatedTarget)) return;
    scheduleClearFocus();
  });

  overlay.addEventListener("click", (event) => {
    if (!coarsePointer.matches) return;
    if (event.detail === 0) return;

    const landmark = getLandmark(event.target);
    const serviceId = landmark?.dataset.serviceId;
    if (!landmark || !serviceId) return;

    if (landmark.matches("a[href]") && selectedId === serviceId) return;

    event.preventDefault();
    applyFocus(serviceId);
  });

  overlay.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const landmark = getLandmark(event.target);
    if (!landmark?.matches('g[role="button"]')) return;

    event.preventDefault();
    applyFocus(landmark.dataset.serviceId);
  });

  details?.addEventListener("pointerenter", cancelClearFocus);
  details?.addEventListener("pointerleave", (event) => {
    if (overlay.contains(event.relatedTarget)) return;
    if (!coarsePointer.matches) scheduleClearFocus();
  });
  details?.addEventListener("focusout", (event) => {
    if (details.contains(event.relatedTarget) || overlay.contains(event.relatedTarget)) return;
    scheduleClearFocus();
  });
  details?.addEventListener("click", async (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-copy]") : null;
    if (!(button instanceof HTMLButtonElement)) return;

    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? "");
      button.textContent = "已复制";
    } catch {
      button.textContent = "复制失败";
    }
  });
} catch (cause) {
  console.error("Unable to render service atlas", cause);
  if (error) error.hidden = false;
}
