# Integration tests

- **Docker** must be running (Docker Desktop, Colima, Rancher Desktop, or Linux daemon). Tests use [Testcontainers](https://testcontainers.com/) to start PostgreSQL and run `yarn prisma migrate deploy`.
- **Commands:** `yarn test:integration`, or `yarn test` (runs unit tests first, then integration).
- **Without Docker:** run `yarn test:unit` only, or start a local Docker-compatible engine before `yarn test`.
