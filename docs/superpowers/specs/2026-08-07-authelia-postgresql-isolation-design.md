# Authelia PostgreSQL Isolation Design

## Goal

Move Authelia out of the PostgreSQL maintenance database and stop giving the
application the `postgres` administrator credentials.

## Database Boundary

Authelia connects to `postgresql.infra.svc.cluster.local:5432` with the
dedicated login role `authelia`. It stores its tables in the `public` schema of
the dedicated `authelia` database. The database and role are provisioned once
by an operator because the existing PostgreSQL PVC has already been
initialized; Bitnami initialization scripts do not run again for an existing
data directory.

The repository documents the required SQL but does not run administrator SQL
from the Authelia deployment workflow. This keeps the PostgreSQL administrator
password out of the application deployment path.

## Secret Flow

The GitHub `dev` Environment gains `AUTHELIA_POSTGRES_PASSWORD`. The Authelia
deployment job validates that secret and writes it to
`storage.postgres.password.txt` in `infra/authelia-secrets`. It no longer reads
`POSTGRES_PASSWORD`; that secret remains limited to PostgreSQL administration.

The optional repository-managed Secret template keeps the existing
`autheliaSecrets.postgresPassword` value because it already represents the
application password, independent of the GitHub secret name.

## Deployment and Recovery

The operator creates the role and database before deploying the changed
Authelia configuration. Authelia then creates an empty schema through its
normal startup migrations. Existing data in `postgres.public` is not migrated.

Old objects in `postgres.public` are not deleted by Helm or CI. Cleanup is a
separate destructive operation after the new deployment is verified and after
the operator confirms that the schema contains no objects that must be kept.

For future recovery, documentation includes custom-format `pg_dump` and
`pg_restore` commands for the dedicated `authelia` database. A restore targets
an already-created database owned by the `authelia` role.

## Validation

The existing render test must assert the dedicated database and username, and
must assert that the deployment workflow consumes
`AUTHELIA_POSTGRES_PASSWORD` rather than reusing `POSTGRES_PASSWORD` in the
Authelia credential-sync step. Helm lint and rendering must remain successful.

