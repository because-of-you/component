# RobustMQ

This project-native chart deploys the official RobustMQ `v0.4.11` image as a
single-node `StatefulSet`. The upstream Kubernetes Operator is still described
as early-stage and does not currently provide a versioned Helm release and a
verifiable versioned Operator image, so this chart follows the repository's
existing deployment conventions directly.

## Development environment

- Admin endpoint: `https://mq.acitrus.cn`
- Authentication: Traefik ForwardAuth through Authelia
- Persistent data: a 10 Gi `local-path` volume mounted at `/robustmq/data`
- Storage engine: `/robustmq/data/engine` is explicitly configured in the
  generated `server.toml`; the upstream minimal image config leaves this list empty
- Internal service: `robustmq.infra.svc.cluster.local`
- Mirrored image: `registry.cn-shenzhen.aliyuncs.com/gravitation/robustmq:v0.4.11`

The service exposes the upstream admin, MQTT, MQTT TLS, MQTT WebSocket, Kafka,
gRPC, AMQP and NATS ports inside the cluster. The public MQTT TCP route is
intentionally disabled because the upstream default configuration contains
development credentials. Before enabling it, mount a Secret-backed custom
`server.toml` and rotate both the admin and protocol credentials.

## Render

```bash
helm template robustmq ./charts/robustmq \
  --namespace infra \
  -f ./environments/dev/robustmq/values.yaml
```
