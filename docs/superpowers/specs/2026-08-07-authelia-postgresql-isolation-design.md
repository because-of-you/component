# Authelia PostgreSQL Isolation Design

## Goal

Move Authelia tables out of the PostgreSQL maintenance database and into a
dedicated `authelia` database.

## Database Boundary

Authelia connects to `postgresql.infra.svc.cluster.local:5432` with the
existing `postgres` administrator role. It stores its tables in the `public`
schema of the dedicated `authelia` database. The database is provisioned once
by an operator because the existing PostgreSQL PVC has already been initialized;
Bitnami initialization scripts do not run again for an existing data directory.

The repository documents the required SQL but does not run it from the
Authelia deployment workflow. This design isolates Authelia objects by database,
but it intentionally does not isolate application credentials or privileges:
Authelia continues to hold the PostgreSQL administrator password.

## Secret Flow

The Authelia deployment job reuses the existing GitHub `dev` Environment secret
`POSTGRES_PASSWORD` and writes it to `storage.postgres.password.txt` in
`infra/authelia-secrets`. No additional PostgreSQL password secret is required.

The optional repository-managed Secret template keeps the existing
`autheliaSecrets.postgresPassword` value because it already represents the
application password, independent of the GitHub secret name.

## Deployment and Recovery

The operator creates the `authelia` database owned by `postgres` before
deploying the changed Authelia configuration. Authelia then creates an empty
schema through its normal startup migrations. Existing data in
`postgres.public` is not migrated.

Old objects in `postgres.public` are not deleted by Helm or CI. Cleanup is a
separate destructive operation after the new deployment is verified and after
the operator confirms that the schema contains no objects that must be kept.

For future recovery, documentation includes custom-format `pg_dump` and
`pg_restore` commands for the dedicated `authelia` database. A restore targets
an already-created database owned by the `postgres` role.

## Validation

The existing render test must assert database `authelia`, schema `public`, and
username `postgres`. It must also assert that the Authelia credential-sync step
reuses `POSTGRES_PASSWORD` and does not require an additional PostgreSQL secret.
Helm lint and rendering must remain successful.
