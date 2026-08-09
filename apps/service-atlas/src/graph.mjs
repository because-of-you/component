export function getFocusState(catalogue, serviceId) {
  if (!catalogue.services.some((service) => service.id === serviceId)) {
    throw new Error(`Unknown service ${serviceId}`);
  }

  const directNodes = new Set([serviceId]);
  const indirectNodes = new Set();
  const directRelations = new Set();
  const indirectRelations = new Set();
  const activeRelations = new Set();
  const dependencyProviders = new Set();

  catalogue.relations.forEach((relation, index) => {
    if (relation.source !== serviceId && relation.target !== serviceId) return;

    directNodes.add(relation.source);
    directNodes.add(relation.target);
    directRelations.add(index);
    activeRelations.add(index);

    if (relation.source === serviceId && relation.type !== "route") {
      dependencyProviders.add(relation.target);
    }
  });

  catalogue.relations.forEach((relation, index) => {
    if (
      !dependencyProviders.has(relation.source) ||
      relation.type === "route" ||
      directNodes.has(relation.target)
    ) return;

    indirectNodes.add(relation.target);
    indirectRelations.add(index);
    activeRelations.add(index);
  });

  return {
    directNodes,
    indirectNodes,
    directRelations,
    indirectRelations,
    activeRelations,
  };
}
