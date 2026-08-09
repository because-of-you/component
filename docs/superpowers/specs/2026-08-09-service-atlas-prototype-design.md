# Service Atlas Interactive Map Prototype Design

## Summary

Build a desktop-first interactive service atlas for the personal Kubernetes environment. The page is a navigation and memory aid, not a monitoring dashboard. It presents services as destinations in a detailed East-Asian fantasy landscape and expresses runtime relationships as different kinds of roads, waterways, passes, and relay paths.

This specification covers the first delivery: a browser prototype driven by local mock catalogue data. It deliberately excludes Kubernetes discovery and cluster deployment until the visual and interaction model has been accepted in a working browser.

## Goals

- Open directly into a full-viewport illustrated map with no logo, title, header, sidebar, search box, legend, or explanatory copy.
- Show the current services as named landmarks: Traefik, Authelia, Claude Code Hub, RustFS, LLDAP, RabbitMQ, PostgreSQL, and Redis.
- Make public Web services directly navigable from their landmarks.
- Express runtime relationships through roads that belong to the landscape rather than technical connector lines.
- Highlight a service's directly and indirectly related runtime subgraph on hover or keyboard focus.
- Allow a new service to be added by changing catalogue data rather than renderer code.
- Keep the prototype usable on mobile while optimizing the composition for desktop.

## Non-goals

- Health checks, status polling, latency, metrics, charts, or deployment tracking.
- Showing internal addresses, ports, versions, credentials, or other sensitive details.
- Inferring runtime dependencies from Kubernetes objects.
- Kubernetes deployment, Traefik exposure, container publishing, or production discovery in this phase.
- A general-purpose automatic graph-layout engine. Visual quality takes precedence over fully automatic placement.

## Product Experience

### Default view

The page contains only the landscape, service landmark names, and the dependency roads embedded in the terrain. The map fills the viewport. Mountains, rivers, terraces, bridges, forests, compounds, and mist establish depth before the dependency layer is read.

The composition follows the approved fantasy-map direction:

- Traefik is the western gate through which public traffic enters.
- Authelia is a central checkpoint and identity nexus.
- Claude Code Hub is a scholar's academy or workshop.
- RustFS is a waterside archive or granary compound.
- LLDAP is a registry pavilion or library tower.
- RabbitMQ is a courier station at a road fork.
- PostgreSQL is a foundational stone archive or vault.
- Redis is a fast waterside relay or storehouse.

These metaphors are visual roles, not visible category labels. The only persistent text is the exact service name.

### Road language

Runtime relation types select a road treatment:

| Relation | Landscape treatment | Example |
| --- | --- | --- |
| `route` | broad mineral-blue official road | Traefik to a public Web service |
| `authentication` | restrained terracotta checkpoint road | an application to Authelia |
| `data` | waterway or stone-bridge route | an application to PostgreSQL |
| `cache` | short, fine relay route | an application to Redis |
| `message` | courier road between relay destinations | an application to RabbitMQ |

Roads have no arrowheads or chevrons. Direction is conveyed by sparse pearl-like light motes moving slowly along the path. The underlying road remains stable so the page does not resemble a live operations display.

### Interaction

- Hover or keyboard focus on a landmark keeps its related runtime subgraph fully visible and gently fades unrelated landmarks and roads.
- Direct relations remain strongest; indirect relations use lower contrast.
- A landmark with an `href` opens that service in a new browser tab when clicked or activated with the keyboard.
- A landmark without an `href`, such as a non-Web infrastructure service, remains selectable for relationship exploration but does not pretend to be navigable.
- Landmark clickability is communicated by hover, focus, cursor, and subtle local contrast changes. There is no permanent arrow icon.
- The first prototype does not use pointer parallax. Route motes are its only continuous motion.
- `prefers-reduced-motion` disables moving motes while preserving the complete map and focus behavior.

### Responsive behavior

- Desktop displays the full authored composition.
- Tablet scales the same map inside a fixed aspect-ratio stage.
- Mobile starts at a readable fitted view and supports touch pan and restrained zoom.
- A first tap focuses a landmark and its relations; a second tap follows its link when present.
- Keyboard focus order follows the catalogue order rather than visual coordinates.

## Prototype Architecture

The prototype is a dependency-light static Web application under `apps/service-atlas/`. It uses browser-native ES modules, HTML, CSS, and SVG rather than a framework or graph library. This avoids introducing a container build pipeline before the experience is approved and keeps the renderer portable into the later deployment phase.

The application has three independent layers:

1. **Landscape layer** — an optimized WebP map background without service names, dependency roads, or UI chrome.
2. **Road and landmark layer** — a responsive SVG overlay whose `viewBox` matches the authored map coordinate system.
3. **Catalogue layer** — a JavaScript data module containing mock services, positions, public links, and typed runtime relations.

Suggested module boundaries:

- `catalogue.js`: mock service and relation records only.
- `validate-catalogue.js`: IDs, coordinates, URLs, target references, and relation types.
- `road-paths.js`: default curves, optional authored waypoints, and relation-to-style mapping.
- `map-renderer.js`: SVG landmarks, labels, roads, focus state, and accessible activation.
- `motion.js`: route motes and reduced-motion behavior.
- `styles.css`: map staging, typography, responsive behavior, focus, and visual states.

No module fetches service health or makes requests to the target services.

## Catalogue Contract

The prototype uses plain JavaScript data so it can run without a build step. The later production phase can serialize the same contract as JSON or YAML without changing the renderer.

```js
export const catalogue = {
  services: [
    {
      id: "claude-code-hub",
      name: "Claude Code Hub",
      href: "https://inner.coding.acitrus.cn",
      landmark: "academy",
      position: { x: 48, y: 22 },
      label: { dx: 0, dy: -4, align: "middle" },
    },
  ],
  relations: [
    {
      source: "traefik",
      target: "claude-code-hub",
      type: "route",
      waypoints: [{ x: 31, y: 44 }, { x: 39, y: 31 }],
    },
    {
      source: "claude-code-hub",
      target: "postgresql",
      type: "data",
    },
  ],
};
```

Coordinates use a normalized `0..100` map space. A new service needs only a unique ID, display name, landmark role, and position. `href` is optional. Relations need a source, target, and supported type. Waypoints are optional: the renderer creates a default cubic route when they are absent, while authored waypoints allow the road to follow terrain precisely.

This is intentionally semi-automatic. Fully automatic graph placement would gradually destroy the curated map composition. Future additions receive a usable automatic position and path first, with optional coordinate and waypoint refinement when visual quality matters.

## Initial Runtime Relations

The prototype represents runtime calls rather than Helmfile deployment order:

- Traefik routes to Authelia and each Web-facing service.
- Claude Code Hub authenticates with Authelia and uses PostgreSQL and Redis.
- RustFS authenticates with Authelia.
- LLDAP uses PostgreSQL; its public management route is protected by Authelia.
- Authelia uses LLDAP for authentication, PostgreSQL for storage, and Redis for sessions.
- RabbitMQ is shown as an independently reachable service in the initial data; no false Redis or PostgreSQL dependency is drawn.

The production phase will keep these relationships explicit. Kubernetes and Traefik can discover objects and public routes, but they cannot reliably infer application-level calls.

## Visual Asset Strategy

The approved generated image is an art-direction reference, not a production background. It contains labels and roads that must not be baked into the final asset.

The prototype needs one new terrain asset with:

- the approved pale silk, mineral pigment, mist, and East-Asian fantasy-map atmosphere;
- an authored set of landmark sites and enough open terrain for 10–30 labels;
- no service names, title, legend, route glow, arrows, or dependency lines;
- no copied franchise characters, marks, or recognizable proprietary composition;
- WebP output sized for a desktop viewport and optimized for practical loading.

Service names, relationship paths, interaction states, and animated motes always remain code-rendered overlays.

## Validation and Error Handling

- Duplicate service IDs, unsupported relation types, out-of-range coordinates, and missing relation targets fail catalogue validation before rendering.
- An invalid `href` makes that landmark non-navigable and reports a development-console error; it does not remove the landmark or break the map.
- If the map background fails to load, the SVG overlay remains usable on a neutral fallback canvas.
- A service without explicit coordinates uses the next predefined free map slot.
- Route generation falls back to a simple curved path when authored waypoints are invalid.
- Animation failure never affects labels, navigation, focus, or relationship highlighting.

## Testing and Visual Verification

### Automated checks

- Catalogue validation accepts the initial mock data.
- Duplicate IDs, missing targets, invalid coordinates, unsupported relation types, and malformed URLs are rejected.
- Relation types map to the expected road style.
- Focus traversal returns direct and indirect related services without leaking unrelated nodes.
- Services with links produce safe external navigation attributes; services without links remain focusable but non-navigable.
- Reduced-motion mode produces no animated motes.

Tests use Node's built-in test runner against dependency-free ES modules. The prototype itself needs no package installation or bundling.

### Browser checks

- Desktop reference viewport: 1440×900.
- Mobile reference viewport: 390×844.
- All eight initial landmarks are readable and do not collide.
- Roads visually belong to terrain and never resemble floating technical connectors.
- Hover, focus, click, mobile tap, pan, zoom, and reduced-motion behavior work.
- No status, monitoring, internal connection information, extra headings, logo, or explanatory text appears.

## Acceptance Criteria

- Opening the prototype immediately shows the full interactive fantasy map.
- The only persistent text is the eight service names.
- Each service is represented by a discoverable map destination.
- Runtime dependencies use the correct road styles and relationships.
- Hovering or focusing a service highlights its dependency hierarchy and fades unrelated areas.
- Linked services open directly; non-Web infrastructure services do not expose connection information.
- Animated route motes are restrained and disappear under reduced-motion preferences.
- Adding one mock service and its relations requires catalogue changes only, not renderer changes.
- Automated tests and desktop/mobile browser verification pass.

## Follow-up Phase

After the browser prototype is accepted, a separate design and plan will cover Kubernetes delivery. That phase will choose the production packaging approach, add a Helm release and public Traefik route, and merge discovered routes with manually curated names, landmark placement, and explicit runtime relations. Keeping that work separate prevents deployment mechanics from constraining the map experience prematurely.
