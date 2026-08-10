export function buildFlowSequence(catalogue, flow) {
  const forward = flow.path.slice(0, -1).map((from, index) => {
    const to = flow.path[index + 1];
    const relationIndex = catalogue.relations.findIndex((relation) =>
      (relation.source === from && relation.target === to)
      || (relation.source === to && relation.target === from));
    if (relationIndex < 0) {
      throw new Error(`Flow ${flow.id} has no relation for ${from} -> ${to}`);
    }
    const relation = catalogue.relations[relationIndex];
    return {
      relationIndex,
      from,
      to,
      roadForward: relation.source === from,
      phase: "forward",
    };
  });

  if (!flow.return) return forward;
  const returning = forward.slice().reverse().map((leg) => ({
    relationIndex: leg.relationIndex,
    from: leg.to,
    to: leg.from,
    roadForward: !leg.roadForward,
    phase: "return",
  }));
  return [...forward, ...returning];
}

export function sampleRoadProgress(road, progress, roadForward, sampleCount = 2) {
  const totalLength = road.getTotalLength();
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const count = Math.max(1, sampleCount);
  const distanceAt = (stepProgress) => totalLength * (
    roadForward ? stepProgress : 1 - stepProgress
  );
  const trace = Array.from({ length: count + 1 }, (_, index) => {
    const stepProgress = clampedProgress * (index / count);
    const point = road.getPointAtLength(distanceAt(stepProgress));
    return { x: point.x, y: point.y };
  });
  const point = road.getPointAtLength(distanceAt(clampedProgress));
  return { point: { x: point.x, y: point.y }, trace };
}

export function buildRelationParticleSpecs(relations) {
  const goldenPhase = 0.38196601125;
  return relations.flatMap((relation, relationIndex) => {
    const count = relation.particles ?? 1;
    return Array.from({ length: count }, (_, particleIndex) => ({
      relationIndex,
      particleIndex,
      phase: (relationIndex * goldenPhase + particleIndex / count) % 1,
    }));
  });
}

export function locateRelationParticle(elapsed, duration, dwell, phaseOffset = 0) {
  const cycleDuration = duration * 2 + dwell * 2;
  const cycleTime = ((elapsed + phaseOffset) % cycleDuration + cycleDuration) % cycleDuration;
  if (cycleTime < duration) {
    return {
      phase: "forward",
      progress: cycleTime / duration,
      roadForward: true,
      colorEndpoint: "source",
      pulseEndpoint: null,
    };
  }
  if (cycleTime < duration + dwell) {
    return {
      phase: "target-dwell",
      progress: 1,
      roadForward: true,
      colorEndpoint: "target",
      pulseEndpoint: "target",
    };
  }
  if (cycleTime < duration * 2 + dwell) {
    return {
      phase: "reverse",
      progress: (cycleTime - duration - dwell) / duration,
      roadForward: false,
      colorEndpoint: "target",
      pulseEndpoint: null,
    };
  }
  return {
    phase: "source-dwell",
    progress: 1,
    roadForward: false,
    colorEndpoint: "source",
    pulseEndpoint: "source",
  };
}
