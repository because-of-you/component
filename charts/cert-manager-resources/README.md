# cert-manager resources

This chart creates the dev cluster's `ClusterIssuer` and wildcard `Certificate`.
It is deployed after the cert-manager controller and AliDNS webhook so that the
cert-manager CRDs and webhook are already available.
