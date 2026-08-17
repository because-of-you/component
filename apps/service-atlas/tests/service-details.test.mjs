import test from "node:test";
import assert from "node:assert/strict";

import { renderServiceDetails } from "../src/service-details.mjs";

test("renders default entry, protocol endpoints, and mixed credential sources", () => {
  const markup = renderServiceDetails({
    id: "queue",
    name: "Queue",
    href: "https://queue.example.com",
    color: "#27c2ff",
    description: "Multi-protocol messaging.",
    endpoints: [
      { name: "Dashboard", protocol: "HTTPS", address: "https://queue.example.com", default: true },
      { name: "MQTT", protocol: "MQTTS", address: "mqtts://mqtt.example.com:1024" },
    ],
    credentials: [
      { name: "Dashboard", username: "admin", password: "admin" },
      { name: "Database", username: "postgres", source: "Kubernetes Secret" },
    ],
  });

  assert.match(markup, /id="service-details-title">Queue<\/h2>/);
  assert.match(markup, /href="https:\/\/queue\.example\.com"[^>]+>https:\/\/queue\.example\.com<\/a>/);
  assert.match(markup, /<code>mqtts:\/\/mqtt\.example\.com:1024<\/code>/);
  assert.match(markup, /service-details__badge--default">默认<\/span>/);
  assert.match(markup, /data-copy="admin"/);
  assert.match(markup, /Kubernetes Secret/);
  assert.match(markup, /class="service-details__open"[^>]+href="https:\/\/queue\.example\.com"/);
});

test("escapes catalogue text before inserting the detail card", () => {
  const markup = renderServiceDetails({
    name: '<script>alert("x")</script>',
    description: "<b>unsafe</b>",
    endpoints: [],
    credentials: [],
  });

  assert.doesNotMatch(markup, /<script|<b>/);
  assert.match(markup, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(markup, /&lt;b&gt;unsafe&lt;\/b&gt;/);
});
