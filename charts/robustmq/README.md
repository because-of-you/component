# RobustMQ

This project-native chart deploys the official RobustMQ `v0.4.11` image as a
single-node `StatefulSet`. The upstream Kubernetes Operator is still described
as early-stage and does not currently provide a versioned Helm release and a
verifiable versioned Operator image, so this chart follows the repository's
existing deployment conventions directly.

## Development environment

- Admin endpoint: `https://mq.acitrus.cn`
- MQTT endpoint: `mqtts://mqtt.tcp.acitrus.cn:1024` (development only)
- AMQP endpoint: `amqps://amqp.tcp.acitrus.cn:1024/default` (experimental,
  development only)
- Dashboard API origin: `https://mq.acitrus.cn`, supplied at runtime through
  `/robustmq/dist/config.js` so browser requests remain on the public HTTPS origin
- Authentication: Traefik ForwardAuth through Authelia
- Persistent data: a 10 Gi `local-path` volume mounted at `/robustmq/data`
- Storage engine: `/robustmq/data/engine` is explicitly configured in the
  generated `server.toml`; the upstream minimal image config leaves this list empty
- Internal service: `robustmq.infra.svc.cluster.local`
- Mirrored image: `registry.cn-shenzhen.aliyuncs.com/gravitation/robustmq:v0.4.11`

The service exposes the upstream admin, MQTT, MQTT TLS, MQTT WebSocket, Kafka,
gRPC, AMQP and NATS ports inside the cluster. The development environment also
publishes MQTT over TLS at `mqtts://mqtt.tcp.acitrus.cn:1024`: Traefik selects
the route by SNI, terminates TLS, and forwards plaintext MQTT to service port
1883. It currently uses the upstream development credentials and must not be
copied to a production environment. Before production use, mount a
Secret-backed custom `server.toml` and rotate both the admin and protocol
credentials.

The development environment also exposes the upstream experimental AMQP 0.9.1
implementation at `amqps://amqp.tcp.acitrus.cn:1024/default`. It uses the same
development user database as MQTT. Client compatibility and advanced AMQP
features are not considered production-ready in RobustMQ `v0.4.11`.

The Dashboard API origin is controlled by `dashboard.apiBaseUrl`. This runtime
override avoids rebuilding the upstream image and remains independent of the
image tag. When upgrading RobustMQ, the render test verifies that the override
is still mounted; also confirm that the upstream image continues to load
`/robustmq/dist/config.js` during the release smoke test.

## Render

```bash
helm template robustmq ./charts/robustmq \
  --namespace infra \
  -f ./environments/dev/robustmq/values.yaml
```
