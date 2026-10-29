# Conduktor Console

This chart wraps the official Conduktor Console chart. Console stores its
state in the existing PostgreSQL release and connects to the internal Kafka
Service. Cortex is enabled for the normal Console monitoring experience.

The `console-secrets` Secret must exist in the `app` namespace with the keys
documented by the upstream chart:

```text
CDK_ORGANIZATION_NAME
CDK_ADMIN_EMAIL
CDK_ADMIN_PASSWORD
CDK_DATABASE_USERNAME
CDK_DATABASE_PASSWORD
```

The development image uses the repository's OpenJ9 Console image and the
JVM memory flags from the previous component branch.
