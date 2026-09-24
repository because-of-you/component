# cert-manager

This wrapper installs cert-manager, the AliDNS DNS01 webhook, and the dev
cluster's ACME `ClusterIssuer` and wildcard `Certificate`.

The credential Secret is intentionally created by the deployment workflow and
is not stored in Git. It must exist as `cert-manager/alidns-secrets` with the
keys `access-token` and `secret-key` before the Certificate can become Ready.

The generated `traefik/acitrus-tls` Secret is prepared for the later Traefik
cutover. Traefik continues using its existing `leresolver` until that cutover
is explicitly verified.
