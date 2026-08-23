# Dibayar UX Implementation Security Review

Date opened: 2026-08-04
Branch: `hermes/ux-phase-0`
Status: **IN PROGRESS — T-00 accepted; T-01–T-27 reviews pending**

## 1. Scope

This review tracks dependency security, tenant isolation, fixture-target safety, authentication-sensitive browser evidence, public invoice token behavior, secret handling, and deployment/database gates for T-00–T-27.

## 2. Dependency remediation

Approved minimal remediation applied:

- Next.js 16.3.0;
- NextAuth 5.0.0-beta.32;
- `@auth/prisma-adapter` 2.11.3;
- Prisma CLI/client/adapter/generated client aligned at 7.9.1;
- non-forced transitive security fixes only.

Verified evidence:

- `npm audit`: 0 vulnerabilities;
- focused auth, ownership, token, owner/public PDF tests: 152/152 passed;
- full Vitest suite: 447/447 passed;
- Prisma validate/generate, lint, typecheck, and production build passed.

## 3. Docker-group request and refusal

- Hermes proposed adding `kenji` to the host `docker` group as a way to run a disposable local PostgreSQL Compose service.
- Live inspection showed `/var/run/docker.sock` owned by `root:docker`, mode `0660`; `kenji` was not a member and `docker info` failed.
- Chris explicitly refused this approach on 2026-08-04: **do not use the Docker group**.
- No Docker-group membership change was made by Hermes.
- The approved replacement is an externally managed local PostgreSQL instance. Hermes does not start, stop, configure, or otherwise control its lifecycle.

Security rationale: Docker-group membership is effectively root-equivalent on the host. Refusal avoids broadening local privilege solely for test infrastructure.

## 4. Approved local T-00 database target

Database mutation is allowlisted only for:

- host: `127.0.0.1`;
- port: `55432`;
- database: `dibayar_test`;
- lifecycle owner: external to Hermes;
- purpose: migrations, deterministic T-00 fixtures, authenticated captures, PDF parity, and cleanup read-back.

The fixture runner enforces the exact host, port, and database plus `UX_FIXTURE_CONFIRM=non-production`. `localhost` is normalized to `127.0.0.1`. Only `postgres:`/`postgresql:` URLs are accepted, and query parameters capable of overriding host, port, or database are rejected before connection. Destructive operations match only the three exact fixed fixture user IDs. The manifest path is pinned under `.hermes-runtime/ux-fixtures/`, written mode `0600`, and removed after cleanup. Credentials are read directly from `/home/kenji/code/dibayar-testdb/.env.test`; its value must not be committed, logged, or sent through chat.

Exact-delete proof: a temporary `ux-t00-unrelated` user matching the former broad prefix survived fixture cleanup while the three exact fixture IDs remained absent; the decoy was then explicitly removed.

Browser evidence is local-only: Playwright has no external base-URL override, does not reuse an existing server, and writes generated artifacts only under ignored `test-results/` paths. Promotion into `docs/ux-implementation/evidence/baseline/` is an explicit checksummed step.

Normalized identity:

- target: `127.0.0.1|55432|dibayar_test`;
- SHA-256 fingerprint: `e598e921b265388cb3c36c8d3070b63bd8c2810e9ea3685277e9d82f6967e368`.

The target accepts TCP connections, and the protected handoff URL matches this identity. After the externally controlled container was restarted, authenticated read-only inspection succeeded. Hermes did not manage the server lifecycle.

**Server-version DECISION:** PostgreSQL `17.10` (`server_version_num=170010`), verified on 2026-08-06 before migration or fixture writes and recorded in `IMPLEMENTATION_LOG.md`.

## 5. Vercel Preview isolation prohibition

- Chris confirmed Vercel Preview is non-isolated.
- Earlier normalized Preview and Production database fingerprints matched.
- No migration, fixture seed, or capture may run against Vercel Preview.
- Isolation remediation is a separate work track.
- **Phase 2 is blocked until normalized Preview and Production fingerprints differ.**

## 6. Parent-deal integrity decision

- The detached-parent invoice assumption was incorrect and the fixture is removed.
- Preserve required `Invoice.dealId`, the required relation, and `ON DELETE RESTRICT`.
- Do not add nullable parent IDs, `SET NULL`, or an invoice snapshot workaround in T-17/T-22.
- The user-facing deal-deletion-with-invoices gap is deferred work.

## 7. Tenant and token evidence

Automated unit/API evidence passes for owner scoping, second-owner denial, public token lookup, expiry, owner PDF, and public PDF paths. T-00 fixture-backed browser evidence also passes against the approved local PostgreSQL target.

Accepted T-00 browser evidence:

- populated and zero-state owner surfaces captured;
- two-way cross-owner 404 behavior passed;
- active token returned 200; expired and invalid tokens returned 404;
- owner/public PDF routes returned A4 PDFs through separate authorization paths; the public request used an isolated cookie-free API context;
- independently extracted PDF source labels and canonical HTML/PDF values/order matched for number, billed-to, due date, scope, tax, and total;
- extracted owner/public PDF text matched;
- cleanup read-back confirmed zero exact fixture users and removed the secret manifest.

## 8. Secret handling

- Database URLs, passwords, Auth secrets, OAuth credentials, fixture session tokens, and public fixture tokens are excluded from this document.
- Fixture manifest is written with mode `0600` under ignored `.hermes-runtime/` and removed by cleanup.
- Vercel environment inspection reports names/scopes and normalized fingerprints only, never full values.
- **External helper finding:** `/home/kenji/code/dibayar-testdb/compose.yml` is mode `0644` and contains the test database password directly. The value is not reproduced here. This is outside Hermes lifecycle control; the separate infrastructure track should move it to the protected handoff/environment mechanism and keep Compose declarative only.

## 9. Current gate

T-00 is accepted. Subsequent fixture work may use the verified local target only and must repeat cleanup/read-back. No Production, public deployment, Vercel Preview mutation, Docker lifecycle action, or Docker privilege change is authorized. Phase 2 remains blocked until Preview and Production fingerprints differ.
