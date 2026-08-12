import {
  buildRelationParticleSpecs,
  locateRelationParticle,
  sampleRoadProgress,
} from "./flow.mjs";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const FALLBACK_COLOR = "#3478f6";
const ENDPOINT_DWELL = 240;
const MIN_TRAVEL_DURATION = 2600;
const MAX_TRAVEL_DURATION = 6400;
const MILLISECONDS_PER_ROAD_UNIT = 57;
const PULSE_THROTTLE = 900;
const PULSE_DURATION = 540;

export function createFlowPlayer({ svg, catalogue, reducedMotion, documentRef = document }) {
  const overlay = svg.querySelector(".flow-overlay");
  if (!overlay || !catalogue.relations?.length) return { start() {}, stop() {}, sync() {} };

  const services = new Map(catalogue.services.map((service) => [service.id, service]));
  const particleSpecs = buildRelationParticleSpecs(catalogue.relations);
  const particles = particleSpecs.map((spec) => {
    const relation = catalogue.relations[spec.relationIndex];
    const road = svg.querySelector(`#road-${spec.relationIndex}`);
    if (!road) throw new Error(`Missing rendered road ${spec.relationIndex}`);
    const length = road.getTotalLength();
    const duration = Math.min(
      MAX_TRAVEL_DURATION,
      Math.max(MIN_TRAVEL_DURATION, length * MILLISECONDS_PER_ROAD_UNIT),
    );
    const cycleDuration = duration * 2 + ENDPOINT_DWELL * 2;
    return {
      ...spec,
      relation,
      road,
      duration,
      phaseOffset: spec.phase * cycleDuration,
      element: createParticle(documentRef, overlay),
      previousPhase: null,
    };
  });
  const lastPulseAt = new Map();
  const pulseExpiresAt = new Map();
  let timelineElapsed = 0;
  let previousTimestamp = null;
  let animationFrame = null;
  let running = false;

  function serviceColor(serviceId) {
    return services.get(serviceId)?.color ?? FALLBACK_COLOR;
  }

  function pulse(serviceId) {
    const previous = lastPulseAt.get(serviceId) ?? Number.NEGATIVE_INFINITY;
    if (timelineElapsed - previous < PULSE_THROTTLE) return;
    const landmark = [...svg.querySelectorAll("[data-service-id]")]
      .find((node) => node.dataset.serviceId === serviceId);
    if (!landmark) return;
    landmark.classList.remove("is-flow-pulse");
    void landmark.getBoundingClientRect();
    landmark.classList.add("is-flow-pulse");
    lastPulseAt.set(serviceId, timelineElapsed);
    pulseExpiresAt.set(landmark, timelineElapsed + PULSE_DURATION);
  }

  function expirePulses() {
    pulseExpiresAt.forEach((expiresAt, landmark) => {
      if (timelineElapsed < expiresAt) return;
      landmark.classList.remove("is-flow-pulse");
      pulseExpiresAt.delete(landmark);
    });
  }

  function updateParticle(particle) {
    const state = locateRelationParticle(
      timelineElapsed,
      particle.duration,
      ENDPOINT_DWELL,
      particle.phaseOffset,
    );
    const sample = sampleRoadProgress(particle.road, state.progress, state.roadForward, 1);
    const colorServiceId = particle.relation[state.colorEndpoint];
    particle.element.style.setProperty("--flow-color", serviceColor(colorServiceId));
    particle.element.setAttribute("transform", `translate(${sample.point.x} ${sample.point.y})`);

    if (state.pulseEndpoint && state.phase !== particle.previousPhase) {
      pulse(particle.relation[state.pulseEndpoint]);
    }
    particle.previousPhase = state.phase;
  }

  function scheduleFrame() {
    animationFrame = requestAnimationFrame(update);
  }

  function update(timestamp) {
    if (!running) return;
    if (documentRef.hidden || reducedMotion.matches) {
      previousTimestamp = null;
      scheduleFrame();
      return;
    }
    if (previousTimestamp !== null) {
      timelineElapsed += Math.min(timestamp - previousTimestamp, 50);
    }
    previousTimestamp = timestamp;
    expirePulses();
    particles.forEach(updateParticle);
    scheduleFrame();
  }

  function start() {
    if (running || reducedMotion.matches) return;
    running = true;
    previousTimestamp = null;
    particles.forEach((particle) => particle.element.classList.add("is-visible"));
    scheduleFrame();
  }

  function stop() {
    running = false;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    previousTimestamp = null;
    particles.forEach((particle) => particle.element.classList.remove("is-visible"));
    pulseExpiresAt.forEach((_, landmark) => landmark.classList.remove("is-flow-pulse"));
    pulseExpiresAt.clear();
  }

  function sync() {
    if (reducedMotion.matches) stop();
    else if (!documentRef.hidden) start();
    else previousTimestamp = null;
  }

  return { start, stop, sync };
}

function createParticle(documentRef, overlay) {
  const element = documentRef.createElementNS(SVG_NAMESPACE, "g");
  element.setAttribute("class", "flow-particle");
  const halo = documentRef.createElementNS(SVG_NAMESPACE, "circle");
  halo.setAttribute("class", "flow-particle-halo");
  halo.setAttribute("r", "0.52");
  const core = documentRef.createElementNS(SVG_NAMESPACE, "circle");
  core.setAttribute("class", "flow-particle-core");
  core.setAttribute("r", "0.24");
  element.append(halo, core);
  overlay.append(element);
  return element;
}
