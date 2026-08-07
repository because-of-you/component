# Authelia LDAP StartTLS Design

## Goal

Encrypt the existing Authelia LDAP connection and eliminate the runtime warning that LDAP TLS is available but unused.

## Design

Keep the current `ldap://opendirectory.net` endpoint and enable StartTLS in the dev Authelia values. This preserves the existing LDAP host, port, bind DN, filters, and secret wiring while upgrading the established LDAP connection to TLS.

The alternative `ldaps://` transport is not used because it would also change the connection scheme and normally the service port. Disabling certificate verification is outside scope because it would weaken transport security.

## Files

- `environments/dev/authelia/values.yaml`: change `start_tls` from `false` to `true`.
- `charts/authelia/tests/render.sh`: assert that the rendered Authelia configuration enables StartTLS.

## Validation

Use the existing Authelia render test as a regression test. First add the StartTLS assertion and confirm it fails against the current configuration. Then enable StartTLS and confirm the render test passes. Finally render the dev release through Helmfile to verify the environment values integrate with the chart.

## Operational Notes

The LDAP server certificate must be valid for `opendirectory.net` and trusted by the Authelia container. If the runtime deployment reports a certificate validation error after this change, investigate the server certificate chain rather than disabling verification.

PostgreSQL PVC cleanup is operational guidance only and is not part of this repository change.
