# cert-manager

This chart installs the cert-manager controller and CRDs. The AliDNS DNS01
webhook and the dev cluster's ACME resources are separate Helmfile releases so
they can be installed after the CRDs are registered.

The credential Secret is intentionally created by the deployment workflow and
is not stored in Git. It must exist as `cert-manager/alidns-secrets` with the
keys `access-token` and `secret-key` before the Certificate can become Ready.

The `cert-manager-resources` release creates the `traefik/acitrus-tls`
Certificate for the later Traefik cutover. Traefik continues using its existing
`leresolver` until that cutover is explicitly verified.
