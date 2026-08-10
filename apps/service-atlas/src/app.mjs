import { catalogue } from "./catalogue.mjs";
import { getFocusState } from "./graph.mjs";
import { renderAtlas } from "./render-atlas.mjs";

const overlay = document.querySelector("#atlas-overlay");
const error = document.querySelector("#atlas-error");
const coarsePointer = window.matchMedia("(pointer: coarse)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let selectedId = null;
let rootSvg = null;

function syncAnimations() {
  if (!rootSvg) return;
  const shouldPause = document.hidden || reducedMotion.matches;
  if (shouldPause && typeof rootSvg.pauseAnimations === "function") {
    rootSvg.pauseAnimations();
  } else if (!shouldPause && typeof rootSvg.unpauseAnimations === "function") {
    rootSvg.unpauseAnimations();
  }
}

function clearFocus() {
  if (!overlay) return;

  overlay
    .querySelectorAll(".is-active, .is-direct, .is-indirect, .is-muted, .is-selected")
    .forEach((node) => {
      node.classList.remove("is-active", "is-direct", "is-indirect", "is-muted", "is-selected");
    });
  selectedId = null;
}

function applyFocus(serviceId) {
  if (!overlay || !serviceId) return false;

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
    .querySelectorAll(".road-group[data-relation-index], .traffic-group[data-relation-index]")
    .forEach((relationGroup) => {
      const index = Number.parseInt(relationGroup.dataset.relationIndex ?? "", 10);
      if (state.directRelations.has(index)) relationGroup.classList.add("is-direct");
      else if (state.indirectRelations.has(index)) relationGroup.classList.add("is-indirect");
      else relationGroup.classList.add("is-muted");
    });

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
  overlay.innerHTML = renderAtlas(catalogue);
  rootSvg = overlay.querySelector(".atlas-overlay");
  document.addEventListener("visibilitychange", syncAnimations);
  reducedMotion.addEventListener?.("change", syncAnimations);
  syncAnimations();

  overlay.addEventListener("pointerover", (event) => {
    if (coarsePointer.matches) return;
    const serviceId = getLandmarkId(event.target);
    if (serviceId) applyFocus(serviceId);
    else clearFocus();
  });

  overlay.addEventListener("focusin", (event) => {
    const serviceId = getLandmarkId(event.target);
    if (!serviceId) return;

    // Touch browsers can focus a link immediately before dispatching click.
    // Preserve the last deliberate tap so the first tap still previews.
    if (coarsePointer.matches) previewFocus(serviceId);
    else applyFocus(serviceId);
  });

  overlay.addEventListener("pointerleave", () => {
    if (!coarsePointer.matches) clearFocus();
  });

  overlay.addEventListener("focusout", (event) => {
    if (coarsePointer.matches || overlay.contains(event.relatedTarget)) return;
    clearFocus();
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
} catch (cause) {
  console.error("Unable to render service atlas", cause);
  if (error) error.hidden = false;
}
