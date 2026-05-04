# HireWire Phase 3 Refactor — Deferred (Brainstorm Required)

## Status

**Deferred** — explicitly out of scope for the multi-tenant auth + Phase 4
hardening track that landed 2026-04-28 / 2026-04-29. This document captures
what is left so the follow-up brainstorm has clean inputs.

## Why deferred

Phase 3 changes the shape of two large surfaces (a 1,260-line monolithic
`agent/main.py` and a duplicate web-side schema in `web/data/sally_sales.db`)
and would be risky to attempt in the same session as auth + provisioning.
Splitting it lets the multi-tenant auth land cleanly and gives time to write
proper tests for the refactored pieces before they get used.

## What still needs to be done

### 1. Refactor `agent/main.py` into modules

The file currently mixes:

- the `VirtualEmployeeAgent` class (~600 lines)
- the FastAPI app + middleware + startup hook
- employee CRUD HTTP routes
- the in-memory employee dict + agent-instance cache (single-tenant globals)
- DataSphere validation helpers
- ngrok auto-detection
- a write-side credentials-file dump for the dashboard

Target structure (mirrors Sally Phase 3):

```
agent/
├── app.py                       # already exists — stays the entry point
├── main.py                      # SHRINK to a thin compatibility shim or remove
├── agents/
│   ├── virtual_employee_agent.py    # extracted class
│   ├── factory.py                   # build agent for a given employee config
│   └── lru_cache.py                 # bounded cache (replaces unbounded dict)
├── repositories/
│   ├── employees_repo.py            # CRUD over `employees` table (project-scoped)
│   ├── calls_repo.py                # CRUD over `calls` table
│   └── customers_repo.py
├── routes/
│   ├── auth.py                      # already exists
│   ├── employees.py                 # /api/list-employees, /api/employee/{id}
│   └── webhooks.py                  # /swml/{employee_id}, /swaig/{...}, /post-prompt/{...}
└── services/
    └── datasphere.py                # extracted validation helper
```

### 2. Migrate web's legacy DB to the multi-tenant schema

The web app currently runs two data layers in parallel:

- `web/data/sally_sales.db` (legacy, owned by `web/src/lib/db.ts`)
  - `users` table — unencrypted SignalWire credentials
  - `employees` table — HireWire-specific config (different schema from agent's)
  - `call_logs`, `app_settings`, `sms_logs`, `call_actions`
- `${DATA_DIR}/hirewire.db` (multi-tenant, shared with agent)
  - `projects` table — encrypted creds
  - migration-managed `employees`/`calls`/`customers`/`audit_log`

Phase 3 must:

1. **Migrate `users` rows → `projects` rows.** Encrypt the `api_token` field
   into `auth_token_enc`. Generate a `webhook_password_enc` for each. Map
   `users.project_id` → `projects.id`.
2. **Migrate `employees`/`call_logs` schemas.** Bridge HireWire-specific
   columns (`role`, `greeting`, `voice`, `speech_hints`, `enabled_functions`,
   etc.) into the agent's `employees.config_json` field, or extend the
   agent migration to add these columns directly. Decide between extension
   vs. config_json blob.
3. **Update existing API routes** in `web/src/app/api/**` to read from
   `multi-tenant-db` + `projects-repo` + the migrated tables instead of
   `web/src/lib/db.ts` helpers.
4. **Update the dashboard layout's session check** to require the JWT cookie
   (call `/api/auth/me`), not just localStorage. localStorage becomes a UI
   convenience layer for the credentials, not the source of truth.
5. **Delete `web/src/lib/db.ts` and `web/data/sally_sales.db`** once nothing
   references them.

### 3. Delete legacy single-tenant codepaths

- `agent/main.py` startup hook that writes `web/agent-credentials.json`.
- `web/src/app/api/credentials/route.js` (reads that file).
- `web/src/app/api/signalwire/connect/route.js` (replaced by `/api/auth/login`).
- `agent/_detect_ngrok_url()` — covered by `PUBLIC_BASE_URL_AGENT` now.

## Risk areas

1. **Schema shape mismatch.** Sally's migration `employees` table has
   columns optimized for a sales agent (`enabled_functions`, `language`,
   `voice`, `personality`, `goal`, `instructions`, `config_json`). HireWire's
   legacy schema has 20+ employee columns that don't directly map. Either
   extend the migration with HireWire-specific columns or stuff everything
   into `config_json`. Both are reasonable; pick one in brainstorm.
2. **Existing data.** If any production deployment has rows in
   `web/data/sally_sales.db`, the migration is irreversible. Need a clear
   rollback story.
3. **Tests.** The dashboard's API routes have no test coverage today. Phase 3
   needs to add tests as it goes — TDD per `superpowers:test-driven-development`.

## When to start

Open a fresh brainstorming session targeting this spec. Likely candidates
for the brainstorm questions:

1. Extend the `employees` migration with HireWire-specific columns vs. stuff
   into `config_json`?
2. One PR or multiple PRs (per route, per repository, per agent module)?
3. Keep the legacy DB readable during a transition window, or atomic cutover?
4. Do we delete `agent/main.py` entirely, or leave it as a thin shim that
   imports from the new modules for backward compat?
