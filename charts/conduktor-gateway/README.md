# Conduktor Gateway

This chart wraps the official Conduktor Gateway Helm chart and exposes one
external SNI listener through the repository's Traefik `gravitation` TCP
entrypoint.

Gateway runs in `GATEWAY_MANAGED` mode. The `gateway-secrets` Secret must be
created in the `infra` namespace before deployment and must contain at least:

```text
GATEWAY_LICENSE_KEY
GATEWAY_ADMIN_API_USERS
GATEWAY_USER_POOL_SECRET_KEY
```

The public endpoint is `kafka.tcp.acitrus.cn:1024`; DNS and the Gateway
certificate must also cover `*.kafka.tcp.acitrus.cn`.
