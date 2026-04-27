# HireWire — Production-Readiness Design

**Date**: 2026-04-27
**Status**: Approved (pending user review of written spec)
**Authors**: Jon Gray (jon.gray@signalwire.com) + Claude
**Supersedes**: ad-hoc Sally Sales fork in the HireWire repo's initial commit

---

## 1. Purpose

HireWire is a demonstration application built and operated by SignalWire to show
prospective customers and developers how to:

1. Create virtual AI employees with the `signalwire-agents` Python SDK.
2. Dial those employees from the browser via `@signalwire/js` and the Fabric API.
3. Wire SWAIG functions, DataMap, Skills, real-time `swml_user_event` streams,
   call transfers, SMS follow-up, and a knowledge-base RAG layer into a polished
   experience.

It is both a **sales demo** (customer-facing, must look and feel polished) and a
**reference implementation** (developer-facing, code must be exemplary).

This spec captures the work to take the existing freshly-forked HireWire repo —
inherited from the Sally Sales template, with substantial Replit scaffolding
bloat — to a production-ready state at the highest polish bar.

---

## 2. Locked-in product decisions

| Decision | Value | Notes |
|---|---|---|
| Core UX | Template gallery | User picks from pre-built virtual-employee templates and lightly customizes — no freeform "describe your agent" path in v1. |
| Starting codebase | Clone of `github.com/jongray00/HireWire` | Already a fresh Replit fork of Sally Sales; one commit of history. |
| Tenancy | Multi-tenant, keyed by SignalWire **Project ID** | Login provides `space_url` + `project_id` + `api_token`; project_id scopes all data. |
| Deploy target | Replit | `.replit` workflows; stable HTTPS via `REPLIT_DEPLOYMENT_URL`; no ngrok. |
| Data model | Employees in our SQLite, SignalWire holds an Address pointing at our SWML | We are the SWML/SWAIG host, SignalWire orchestrates. |
| Polish bar | "Full polish" — tests, observability, error tracking, CI, a11y, design pass, onboarding, encrypted-at-rest creds, rate limiting, docs site | ≈ 4–6 weeks of phased work. |
| Surface area (v1) | Login, Employees, Templates, Call Logs, Resources, Knowledge Base, Phone Numbers | `demo-ivr/` legacy is cut. |
| Templates (v1) | AI Receptionist, AI SDR, AI Recruiter, AI Support Tier 1 | Each highlights a different SignalWire capability — see §2.1. |
| Approach | Phased rewrite-where-it-matters / refactor-where-it-doesn't | Five phases, each independently shippable. |

### 2.1 Template-to-capability mapping (v1)

Each template is calibrated to spotlight one headline SignalWire capability so
the gallery doubles as a capability tour. Common to every template: POM
personality, voice picker, live in-browser transcript via `swml_user_event`,
browser→agent WebRTC call.

| Template | Headline SignalWire capability |
|---|---|
| **AI Receptionist** | `connect`/`transfer` to a human, plus SMS confirmation send via `send_sms` SWAIG handler. |
| **AI Sales Development Rep (SDR)** | DataMap — declarative CRM/HubSpot-style API call from inside SWML, no webhook handler. |
| **AI Recruiter / Screener** | `native_vector_search` skill (job description + screening rubric as knowledge), plus structured data capture via `log_call_event`. |
| **AI Support Tier 1** | `datasphere` skill (RAG over a help-doc set), plus transfer-on-frustration via `transfer` SWAIG handler. |

---

## 3. System architecture

```
                         ┌──────────────────────────────────────────────────┐
                         │  Browser (React Router 7 + @signalwire/js)        │
                         │   • Login (Space + ProjectID + Token)             │
                         │   • Dashboard: Employees / Templates / Call Logs  │
                         │     / Resources / Knowledge Base / Phone Numbers  │
                         │   • In-call panel: live transcript + user-events  │
                         └────────┬───────────────────────────┬──────────────┘
                                  │ HTTPS                     │ WebRTC (Fabric)
                                  ▼                           ▼
                         ┌──────────────────┐         ┌────────────────────┐
                         │  HireWire API    │         │  SignalWire Cloud  │
                         │  (FastAPI on     │         │  • Fabric API      │
                         │   Replit, port   │         │  • Media gateway   │
                         │   8000)          │         │  • STT/TTS, AI svc │
                         │  • /api/*        │         └─────────┬──────────┘
                         │  • /api/auth/*   │                   │
                         │  • /swml/{id}    │◀──────fetch SWML──┤
                         │  • /swaig/{fn}   │◀──tool calls──────┤
                         │  • SQLite        │                   │
                         └──────────────────┘                   │
                                  ▲                             │
                                  │ Replit Secrets              │
                                  │ (encryption keys)           │
                                  └─────────────────────────────┘
```

Single Replit project running two services in parallel: web on `5000`, agent on
`8000`. The frontend talks to the agent via same-origin proxy or env-derived
`APP_DOMAIN`. SignalWire is the only external runtime dependency. Tenant
credentials are encrypted at rest (libsodium sealed boxes, key in Replit
Secrets) and never returned to the browser after login.

### 3.1 Key invariants

1. Every DB row scoped by `project_id`. No cross-tenant reads, ever.
2. SWML/SWAIG endpoints validate `project_id + employee_id` from the row, not
   the URL — basic-auth alone is insufficient in a multi-tenant context.
3. `APP_DOMAIN` is derived from Replit env at startup, never hardcoded.

---

## 4. Backend module structure

```
agent/
├── main.py                    # entrypoint only — wires app, runs uvicorn
├── pyproject.toml             # rebranded: name = "hirewire-agent"
├── requirements.txt
├── .env.example
│
├── hirewire/
│   ├── __init__.py
│   ├── app.py                 # FastAPI factory, middleware, exception handlers, CORS
│   ├── config.py              # pydantic-settings: APP_DOMAIN, SWML_AUTH, secret keys
│   ├── logging.py             # structured logging setup, request-id middleware
│   │
│   ├── agents/
│   │   ├── factory.py         # build VirtualEmployeeAgent from DB row
│   │   ├── base.py            # subclass of signalwire_agents.AgentBase
│   │   ├── pom_builder.py     # build POM personality from template + customizations
│   │   └── voices.py          # voice catalog (nova.luna, etc.) + validation
│   │
│   ├── routes/
│   │   ├── auth.py            # POST /api/auth/login, /api/auth/logout, /api/auth/me
│   │   ├── employees.py       # CRUD /api/employees scoped by project_id
│   │   ├── templates.py       # GET /api/templates (static catalog)
│   │   ├── call_logs.py       # GET /api/call-logs, transcript retrieval
│   │   ├── resources.py       # GET /api/resources — proxy to Fabric API
│   │   ├── knowledge_base.py  # CRUD knowledge docs per employee
│   │   ├── phone_numbers.py   # GET/assign DIDs from user's project
│   │   ├── swml.py            # GET /swml/{employee_id} — basic auth
│   │   └── swaig.py           # POST /swaig/{employee_id}/{fn} — basic auth
│   │
│   ├── swaig_handlers/
│   │   ├── transfer.py        # connect/transfer to human or another resource
│   │   ├── send_sms.py        # send SMS via SignalWire REST
│   │   ├── send_summary.py    # SendGrid email summary at end of call
│   │   ├── log_call_event.py  # write to call_logs + emit swml_user_event
│   │   └── knowledge_search.py# native_vector_search dispatch
│   │
│   ├── services/
│   │   ├── signalwire.py      # Fabric API client (subscribers, addresses, resources, DIDs)
│   │   ├── crypto.py          # encrypt/decrypt creds at rest (libsodium / PyNaCl)
│   │   ├── sendgrid.py        # email summaries
│   │   └── transcripts.py     # parse/store call transcripts
│   │
│   ├── db/
│   │   ├── connection.py      # sqlite connection mgmt, WAL mode
│   │   ├── migrations/        # versioned SQL migrations, applied at boot
│   │   └── repositories/
│   │       ├── employees.py
│   │       ├── tenants.py     # one row per project_id, encrypted creds
│   │       ├── call_logs.py
│   │       └── knowledge.py
│   │
│   └── schemas/               # pydantic models for request/response & SWML
│       ├── employee.py
│       ├── template.py
│       ├── call_log.py
│       └── auth.py
│
└── tests/
    ├── conftest.py
    ├── unit/
    ├── integration/
    ├── swaig/
    └── data_isolation/
```

### 4.1 Why this shape

- Routes stay thin: validate → repository call → serialize. Business logic lives
  in `agents/`, `services/`, `swaig_handlers/`.
- `agents/factory.py` is the heart — given an employee row + tenant creds it
  returns a fully-configured `VirtualEmployeeAgent` instance ready to emit SWML.
- `swaig_handlers/` are individually testable with `swaig-test` CLI per
  `config.md`.
- `db/repositories/` enforce `project_id` filtering at the data layer; routes
  cannot accidentally bypass it.
- `tests/data_isolation/` is a dedicated, non-skippable test category for the
  multi-tenant invariant.

---

## 5. Frontend module structure

```
web/
├── package.json              # PRUNED to ~25 deps (from ~70)
├── react-router.config.ts
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts      # NEW
│
└── src/
    ├── app/                  # React Router 7 file-based routes
    │   ├── root.tsx
    │   ├── routes.ts
    │   ├── entry.client.tsx
    │   ├── entry.server.tsx  # Hono SSR
    │   │
    │   ├── login/page.tsx
    │   ├── (dashboard)/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   ├── employees/
    │   │   │   ├── page.tsx
    │   │   │   ├── new.tsx
    │   │   │   └── $id.tsx
    │   │   ├── templates/page.tsx
    │   │   ├── call-logs/
    │   │   │   ├── page.tsx
    │   │   │   └── $id.tsx
    │   │   ├── resources/page.tsx
    │   │   ├── knowledge/$employeeId.tsx
    │   │   └── phone-numbers/page.tsx
    │   │
    │   └── api/              # Hono routes — thin proxy to FastAPI agent
    │
    ├── components/
    │   ├── ui/               # primitives — Button, Card, Input, Dialog, Sheet, etc.
    │   ├── layout/           # AppShell, Sidebar, TopBar, Breadcrumbs
    │   ├── employees/
    │   ├── templates/
    │   ├── call/             # CallPanel, TranscriptPanel, EventStream, Controls
    │   ├── call-logs/
    │   ├── resources/
    │   ├── knowledge/
    │   ├── phone-numbers/
    │   └── feedback/         # ErrorBoundary, EmptyState, LoadingState, Toast
    │
    ├── lib/
    │   ├── api/              # typed clients per resource
    │   ├── signalwire/       # @signalwire/js setup, dial helper, userInput handler
    │   ├── auth.ts
    │   └── utils.ts
    │
    ├── stores/               # Zustand
    │   ├── session.ts
    │   ├── call.ts
    │   └── theme.ts
    │
    ├── hooks/                # TanStack Query wrappers + call hooks
    ├── styles/
    └── tests/
        ├── unit/             # vitest
        └── e2e/              # playwright
```

### 5.1 Cleanup directives

- **One design system**: Tailwind + a small custom UI kit produced by
  `frontend-design:frontend-design`. Drop `@chakra-ui/react`, `@emotion/*`,
  `@lshay/ui`.
- **Strip Replit auto-gen**: `__create/`, `client-integrations/`,
  `auth/create.js`, `useUpload.js`, `useUser.js`, dev error overlay,
  hydration-recovery shims.
- **Drop dead deps**: `stripe`, `three`, `@vis.gl/react-google-maps`,
  `pdfjs-dist`, `papaparse`, `@neondatabase/serverless`, `@hono/auth-js`,
  `@auth/core`, `argon2`.
- **Keep**: `@signalwire/js`, `react-router`, `zustand`, `@tanstack/react-query`,
  `lucide-react`, `sonner`, `tailwind-merge`, `classnames`, `react-hook-form`,
  `yup`, `date-fns`, `react-day-picker`, `react-resizable-panels`, `ws`,
  `react-markdown` + `remark-gfm` (knowledge-base rendering, template
  descriptions), `recharts` (call-log analytics), `motion` (micro-interactions).
- **TypeScript everywhere** — convert remaining `.jsx` → `.tsx` in Phase 4.
- **State separation**: Zustand for client-only ephemeral state; TanStack Query
  for server-derived state. No mixing.

---

## 6. Data model and multi-tenant isolation

Single SQLite database (WAL mode). Every row owned by `project_id`. Every
repository function takes `project_id` as its first argument; no query is ever
issued without it. Schemas are Postgres-compatible if we ever outgrow SQLite.

```sql
-- Tenants: one row per SignalWire project that has logged in
CREATE TABLE tenants (
  project_id           TEXT PRIMARY KEY,
  space_url            TEXT NOT NULL,
  encrypted_api_token  BLOB NOT NULL,           -- libsodium sealed box
  display_name         TEXT,
  first_login_at       INTEGER NOT NULL,
  last_login_at        INTEGER NOT NULL
);

CREATE TABLE sessions (
  token         TEXT PRIMARY KEY,                -- random 32 bytes, base64
  project_id    TEXT NOT NULL REFERENCES tenants(project_id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);
CREATE INDEX idx_sessions_project ON sessions(project_id);

CREATE TABLE employees (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES tenants(project_id) ON DELETE CASCADE,
  template_id   TEXT NOT NULL,
  name          TEXT NOT NULL,
  voice         TEXT NOT NULL,
  personality   TEXT,
  goal          TEXT,
  instructions  TEXT,                            -- JSON array of bullets
  facts         TEXT,                            -- JSON of key/values
  skills        TEXT NOT NULL DEFAULT '[]',      -- JSON
  swaig_config  TEXT NOT NULL DEFAULT '{}',      -- JSON
  sw_address_id TEXT,
  sw_address    TEXT,
  phone_e164    TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_employees_project ON employees(project_id);
CREATE UNIQUE INDEX idx_employees_project_name ON employees(project_id, name);

CREATE TABLE knowledge_docs (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES tenants(project_id) ON DELETE CASCADE,
  employee_id       TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  source            TEXT NOT NULL,               -- 'upload' | 'url' | 'inline'
  mime_type         TEXT,
  content           TEXT NOT NULL,               -- extracted text
  vector_index_path TEXT,
  created_at        INTEGER NOT NULL
);
CREATE INDEX idx_kdocs_project_employee ON knowledge_docs(project_id, employee_id);

CREATE TABLE call_logs (
  id            TEXT PRIMARY KEY,                -- SignalWire call_id
  project_id    TEXT NOT NULL REFERENCES tenants(project_id) ON DELETE CASCADE,
  employee_id   TEXT REFERENCES employees(id) ON DELETE SET NULL,
  caller_label  TEXT,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER,
  duration_ms   INTEGER,
  outcome       TEXT,                            -- 'completed'|'transferred'|'dropped'|'error'
  sentiment     TEXT,                            -- 'positive'|'neutral'|'negative'|NULL
  rating        INTEGER,                         -- 1..5
  summary       TEXT,
  transcript    TEXT NOT NULL DEFAULT '[]',      -- JSON
  events        TEXT NOT NULL DEFAULT '[]'       -- JSON
);
CREATE INDEX idx_calls_project_started ON call_logs(project_id, started_at DESC);
CREATE INDEX idx_calls_project_employee ON call_logs(project_id, employee_id);

CREATE TABLE schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
```

### 6.1 Multi-tenant enforcement

1. No raw `db.execute` from routes — routes only call repositories.
2. Repositories take `project_id: str` as their first parameter and add it to
   every WHERE / INSERT.
3. `project_id` is read from the session, not from the request body or path.
4. `/swml/{employee_id}` and `/swaig/{employee_id}/{fn}` look up the employee
   row and read `project_id` from it; basic-auth alone is insufficient.
5. `tests/data_isolation/` runs every endpoint twice with two tenants and
   asserts no cross-leak. This category is non-skippable.

### 6.2 Encryption at rest

- `HIREWIRE_MASTER_KEY` (32-byte libsodium key) lives in Replit Secrets.
- `services/crypto.py` uses libsodium sealed boxes (`PyNaCl`).
- Decryption only at the moment of a SignalWire API call; plaintext token never
  serialized to JSON, never logged, never returned over the API boundary.
- Custom CI lint rule: only `services/signalwire.py` and the basic-auth
  middleware for `/swml` may import `decrypt_token`.

---

## 7. Auth, sessions, and secrets

### 7.1 Login flow

1. Browser POSTs `{ space_url, project_id, api_token }` to `/api/auth/login`.
2. Server validates by calling SignalWire (e.g. `GET /api/fabric/resources`).
3. Server encrypts the token with `HIREWIRE_MASTER_KEY` and upserts the
   `tenants` row.
4. Server creates a `sessions` row and sets `Set-Cookie: hw_session=<random>;
   HttpOnly; Secure; SameSite=Lax`. Default TTL 30 days, sliding.
5. Subsequent requests: middleware reads cookie → looks up session → sets
   `request.state.project_id`.

### 7.2 Logout & revocation

- `POST /api/auth/logout` deletes the session row and clears the cookie. The
  tenant row + encrypted token persist; re-login uses them, but a fresh login
  overwrites.
- Manual "revoke" button in the dashboard wipes the tenant's encrypted token,
  forcing re-entry of credentials at next login.

### 7.3 Replit Secrets required

| Secret | Purpose |
|---|---|
| `HIREWIRE_MASTER_KEY` | 32-byte libsodium key for token encryption-at-rest. Generated once. Rotation = forces all tenants to re-login. |
| `SESSION_COOKIE_SECRET` | HMAC key for cookie signing (defense-in-depth). |
| `SWML_BASIC_AUTH_USER` / `SWML_BASIC_AUTH_PASSWORD` | basic-auth pair SignalWire uses to fetch `/swml` and call `/swaig`. Same value for all tenants. |
| `SENDGRID_API_KEY` | optional, for email-summary SWAIG handler. |
| `APP_DOMAIN` | derived from `REPLIT_DEPLOYMENT_URL` / `REPLIT_DEV_DOMAIN`; explicit override only. |
| `SENTRY_DSN` | optional; Phase 5. |

### 7.4 Things we explicitly do not build

- No password hashing / argon2 / bcrypt — there is no password.
- No OAuth provider integration — drop `@auth/core`, `@hono/auth-js`.
- No JWTs in cookies — opaque session tokens are simpler and revokable.
- No refresh tokens — sessions expire (30 days, sliding); re-login is cheap.

---

## 8. Real-time event flow

The single most "wow"-inducing demo moment: live transcript and structured
events stream into the browser as the AI talks.

```
USER speaks "I'd like to add a large pizza" in the browser
   │
   ▼
@signalwire/js → SignalWire Cloud (STT)
                         │
                         ▼
                   AI decides to call demo_order_item
                         │
                         ▼
   POST  https://hirewire.replit.app/swaig/{employee_id}/demo_order_item
         Authorization: Basic <SWML_BASIC_AUTH>
         Body: { argument: { item: "large pizza" }, call_id, … }
                         │
                         ▼
HireWire API (FastAPI)
   ├─ routes/swaig.py    → look up employee → load tenant → dispatch handler
   ├─ swaig_handlers/log_call_event.py
   │      • write transcript line + event into call_logs
   │      • return SwaigFunctionResult with .swml_user_event({...})
   ▼
{ response: "Got it, one large pizza.", swml_user_event: { type: "item_added", … } }
                         │
                         ▼
SignalWire Cloud
   ├─ TTS the response back to the caller
   └─ forwards swml_user_event to the connected browser via the Fabric WebSocket
                         │
                         ▼
Browser (call.on('userInput', …))
   ├─ stores/call.ts      → append to transcript[] and events[]
   ├─ TranscriptPanel     → renders new line with speaker label
   ├─ EventStream         → renders structured event card
   └─ Page-specific UI    → e.g. cart total updates
```

### 8.1 Two browser-side streams

1. **Transcript stream**: `[{role: 'agent'|'caller', ts_ms, text}, …]`. Driven by
   `userInput` events with `type === 'transcript'`. Renders in `TranscriptPanel`
   with speaker bubbles.
2. **Event stream**: `[{type, ts_ms, payload}, …]`. Driven by structured
   `userInput` events (`item_added`, `routing_decision`, `transfer_initiated`,
   `summary_sent`, `knowledge_hit`, etc.). Renders in `EventStream` as a
   chronological card list — the moment that sells the demo.

### 8.2 Server-side persistence

- Each `swml_user_event` emitted by a handler is also written to
  `call_logs.events` (JSON array). Post-hoc viewing in
  `/dashboard/call-logs/$id` shows exactly what the prospect saw live.
- Transcripts are persisted via end-of-call SignalWire callback
  (`call.completed`) to `call_logs.transcript`.
- Optional end-of-call summarization SWAIG handler produces `summary`,
  `sentiment`, `rating`, `outcome`.

### 8.3 Failure modes

| Failure | Handling |
|---|---|
| Browser disconnect mid-call | Server still receives SWAIG calls; persists events; on reconnect the existing log replays from DB to rebuild UI. |
| SWAIG handler raises | Wrap dispatch in `routes/swaig.py` — return `SwaigFunctionResult("I'm sorry, I had trouble with that")` + emit `swml_user_event({type:'error', code, message})` so the browser shows soft failure inline. Log full stack server-side. |
| Network drop on `/swaig/...` POST | SignalWire retries with exponential backoff. Handlers are **idempotent** — `call_id + function_name + sequence` is the dedupe key in `call_logs.events`. |
| `swml_user_event` payload too large | Hard cap 8 KB at the handler boundary; coerce to truncated event. Files/blobs go through a separate REST endpoint, not the event channel. |
| Browser tab closes during call | Server-side call completes normally; `call_logs` row updated; user sees it next time they open `/dashboard/call-logs`. |

### 8.4 Persist-and-replay-on-reconnect

Refreshing the page during an active call reconnects to the call and replays
transcript + events from the DB so the dashboard is consistent with what was
already shown. Approved as a polish feature.

---

## 9. Testing strategy

Test pyramid scaled to the codebase. Per `config.md`'s mandatory TDD: failing
test first, then implementation. Per `superpowers:test-driven-development`.

**Coverage targets**: ≥ 80 % server, ≥ 70 % client. Data-isolation suite at
100 %.

```
                    ┌─────────────────────────────┐
                    │  E2E (Playwright)           │   ~10 tests
                    │  golden-path demo flow      │
                    └─────────────────────────────┘
                ┌──────────────────────────────────┐
                │  Integration                     │   ~60 tests
                │  • FastAPI TestClient + sqlite   │
                │  • swaig-test CLI per handler    │
                │  • React Testing Library + msw   │
                └──────────────────────────────────┘
        ┌────────────────────────────────────────────┐
        │  Unit                                      │   ~200 tests
        │  pytest (factory, pom_builder, crypto,     │
        │  repos), vitest (hooks, stores, utils,     │
        │  components rendered in isolation)         │
        └────────────────────────────────────────────┘
```

### 9.1 Backend — pytest

| Suite | Coverage |
|---|---|
| `tests/unit/` | `agents/factory.py`, `pom_builder`, `crypto` round-trip, `voices` validation, repository methods against in-memory sqlite. Pure functions, no FastAPI. |
| `tests/integration/` | FastAPI `TestClient` against ephemeral SQLite. Every route exercised. SignalWire mocked with `responses`. Isolated DB per test. |
| `tests/swaig/` | Each handler runs through `swaig-test` CLI per `config.md`. Validates handler signature, parameter validation, return shape. |
| `tests/data_isolation/` ⭐ | Two-tenant assertions on every read/write endpoint, including the SWML endpoint and SWAIG dispatch. **Non-skippable.** |
| `tests/contract/` | Snapshot tests on SWML output for each template + skill combo. Locks down the wire format. |

### 9.2 Frontend — vitest + RTL + Playwright

| Suite | Coverage |
|---|---|
| `tests/unit/` | Stores, hooks (TanStack Query mocks), utilities, components rendered with mocked data. |
| `tests/integration/` | Whole pages with `msw` mocking the API at the network layer, user-event-driven assertions. |
| `tests/e2e/` | Real browser, Replit dev server, real SignalWire **test project**. Runs the golden path (login → template → hire → call → assert transcript + event → end → call log present). |

### 9.3 Golden-path e2e (must pass before merge)

```ts
test('demo golden path', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Project ID').fill(env.SW_TEST_PROJECT_ID)
  await page.getByLabel('API Token').fill(env.SW_TEST_TOKEN)
  await page.getByLabel('Space URL').fill(env.SW_TEST_SPACE)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await page.getByRole('link', { name: 'Templates' }).click()
  await page.getByRole('button', { name: /AI Receptionist/ }).click()
  await page.getByLabel('Name').fill('e2e-receptionist')
  await page.getByRole('button', { name: 'Hire' }).click()

  await page.getByRole('button', { name: 'Call' }).click()
  await expect(page.getByTestId('call-status')).toHaveText('Connected', { timeout: 15_000 })
  await expect(page.getByTestId('transcript')).toContainText(/.{10,}/, { timeout: 30_000 })
  await expect(page.getByTestId('event-stream')).toContainText(/greeting_sent|menu_offered/, { timeout: 30_000 })

  await page.getByRole('button', { name: 'End call' }).click()
  await page.getByRole('link', { name: 'Call Logs' }).click()
  await expect(page.getByText('e2e-receptionist').first()).toBeVisible()
})
```

### 9.4 CI gating

| Stage | Runs |
|---|---|
| Pre-merge to `main` | lint, typecheck, pytest unit + integration + data-isolation + swaig + contract, vitest unit + integration. **No e2e on PRs.** |
| Post-merge to `main` | full pyramid including e2e against a deployed Replit preview. Failure rolls back the deploy. |
| Pre-deploy to production Replit | full pyramid green + manual approval. |
| Nightly | full e2e + a soak e2e (5 sequential calls per template) with no degradation. |

### 9.5 Out of scope

- Visual regression testing (revisit in Phase 5 if design pass justifies it).
- Load testing — Replit is not a load-bearing scenario.
- Tests of `@signalwire/js` or `signalwire-agents` themselves.

---

## 10. Observability, error handling, logging

### 10.1 Structured logging

JSON to stdout in production, pretty-printed in dev. Every line carries:

```jsonc
{
  "ts": "2026-04-27T16:42:31.014Z",
  "level": "info",
  "service": "hirewire-agent",
  "request_id": "req_01HX9Z…",
  "project_id": "proj_abc123",
  "call_id": "call_xyz789",
  "employee_id": "emp_456",
  "event": "swaig.handler.completed",
  "handler": "demo_order_item",
  "duration_ms": 142,
  "msg": "demo_order_item completed"
}
```

Backend uses Python `structlog` configured in `hirewire/logging.py`. Standard
markers per `config.md`: `swaig.handler.entered/completed/failed`,
`api.request.completed`, `signalwire.api.call`, `db.query.completed`.

Frontend uses a thin `lib/log.ts` wrapper. Custom ESLint rule forbids bare
`console.*` outside `lib/log.ts` to keep logs structured.

### 10.2 Request correlation

- `X-Request-Id` on every server response (generated in middleware if absent).
- Frontend captures it from each `fetch` and attaches to follow-up logs and
  Sentry breadcrumbs.
- During a call, `call_id` is added to every log line emitted by SWAIG handlers
  so a single `call_id` reconstructs the full call narrative end-to-end.

### 10.3 Error tracking — Sentry

- Backend: `sentry-sdk[fastapi]`. PII scrubbing on; tenant token field is on the
  deny-list. Tags: `project_id`, `call_id`, `employee_id`. Spans for SWAIG
  handlers and SignalWire API calls.
- Frontend: `@sentry/react` with React Router 7 integration. Replay disabled by
  default (privacy + cost); enabled per-tenant via feature flag for sales calls.

### 10.4 React error boundaries

- App-level boundary in `app/root.tsx` with friendly fallback, "Reload" button,
  Sentry event ID for support.
- Page-level boundaries inside the dashboard layout — one broken page never
  kills the shell.
- Dedicated **Call** boundary wrapping the call panel — a mid-call crash leaves
  the dashboard usable.

### 10.5 FastAPI exception handlers

| Error | Response | Notes |
|---|---|---|
| `RequestValidationError` | 422 with `{error:'validation', details}` | |
| `TenantMismatchError` | 403, WARN log `event=security.tenant_mismatch`, **always alerts in Sentry** | Data-isolation tripwire from §6. |
| `SignalWireApiError` | 502, sanitized message; full body in logs | |
| `RateLimitedError` | 429 with `Retry-After` | |
| Unhandled | 500, full stack to Sentry, generic message to client | Never leak server internals. |

### 10.6 Health & readiness

| Endpoint | Purpose |
|---|---|
| `GET /healthz` | Liveness — process up. Used by Replit auto-restart. |
| `GET /readyz` | Readiness — DB connection, Replit Secrets loaded, SignalWire API ping. 503 on any failure. |
| `GET /version` | git sha + build time; dashboard footer reads this so SEs can confirm version mid-demo. |

### 10.7 Rate limiting

- `slowapi`, in-memory (Replit single instance).
- Per-tenant, keyed on `project_id`:
  - `/api/auth/login`: 5/min/IP
  - `/api/employees` writes: 30/min
  - `/swml/{id}` and `/swaig/{id}/{fn}`: 600/min
- Friendly 429 with `Retry-After`; hits logged at INFO with
  `event=ratelimit.exceeded`.

---

## 11. Phase plan

Five phases, each independently shippable on Replit. Cannot exit a phase until
its definition of done is fully green.

### 11.1 Phase 1 — Foundation & cleanup

**Goal**: HireWire-branded repo runs reliably on Replit with all dead weight
gone before any product code is touched.

**Work**

- Strip `web/src/__create/`, `web/src/client-integrations/`,
  `web/src/auth/create.js`, `useUpload.js`, `useUser.js`, dev error overlay,
  hydration shims.
- Strip `web/src/app/demo-ivr/`, `AdvancedCallControls 2.jsx`, all Sally pizza
  copy.
- Prune `package.json` (per §5.1).
- Rebrand: `pyproject.toml` → `hirewire-agent`, `agent/main.py` class names,
  `README.md`, page titles, favicon, app name.
- Delete every hardcoded `jonnykarate.ngrok.io`. New `hirewire/config.py` reads
  `APP_DOMAIN` from `REPLIT_DEPLOYMENT_URL` / `REPLIT_DEV_DOMAIN`.
- Replit Secrets list documented in `.env.example` + README; app refuses to
  boot if `HIREWIRE_MASTER_KEY` or `SWML_BASIC_AUTH_*` missing.
- CI scaffolding (GitHub Actions): lint + typecheck + (empty) test runs green.
- Replit `.replit` workflows: agent on 8000, web on 5000, both auto-restart on
  file change.
- Smoke test: `curl /healthz` returns 200 against a fresh Replit deploy.

**Definition of done**

- [ ] `npm install` and `pip install` produce no warnings about
      deprecated/removed deps.
- [ ] `git grep -i "sally"` returns zero hits.
- [ ] `git grep "jonnykarate"` returns zero hits.
- [ ] `npm run typecheck` clean; `pytest --collect-only` lists ≥ 1 placeholder
      test.
- [ ] `/healthz` and `/readyz` both return 200 on Replit.
- [ ] README walks a new SE from clone → running demo on Replit in ≤ 10
      minutes.

### 11.2 Phase 2 — Backend rebuild

**Goal**: Reference-quality `signalwire-agents` backend, fully tested,
multi-tenant-safe.

**Work**

- Split `agent/main.py` into the modules from §4.
- Implement DB schema + migrations from §6. Migrations applied on boot.
- Repositories enforce `project_id`; routes call repositories only.
- Auth routes per §7 with libsodium encryption-at-rest.
- SWML route `GET /swml/{employee_id}` (basic-auth) returning shape-correct
  SWML built from DB row + tenant credentials.
- SWAIG dispatch route `POST /swaig/{employee_id}/{fn}` (basic-auth) calling
  into `swaig_handlers/`.
- Built-in SWAIG handlers shipped: `transfer`, `send_sms`, `send_summary`,
  `log_call_event`, `knowledge_search`.
- All five backend test suites from §9 wired up.
- Structured logging from §10 in place.
- Rate limiting + FastAPI exception handlers from §10.

**Definition of done**

- [ ] `agent/main.py` is < 50 LOC (entrypoint only); no module exceeds 300 LOC.
- [ ] `pytest -q` runs ≥ 100 tests, all green, ≥ 80 % coverage on `hirewire/`.
- [ ] `tests/data_isolation/` covers every read/write endpoint; 100 % green.
- [ ] `swaig-test agent/main.py --list-tools` enumerates exactly the shipped
      handlers.
- [ ] Manual: log in via curl, create employee, fetch SWML, post SWAIG call —
      all return correct shape and log structured lines with
      `request_id`/`project_id`.
- [ ] Sentry receives a test exception when `/test-sentry` (dev-only) is hit.

### 11.3 Phase 3 — Auth, multi-tenancy, end-to-end vertical slice

**Goal**: A user can log in, create one employee from one template, and call
it. End-to-end on Replit, tenant-isolated.

**Work**

- Frontend `/login` (functional, no design polish yet). POST to
  `/api/auth/login`. Sets cookie. Redirects to dashboard.
- Frontend session middleware: 401 from any API redirects to login.
- Frontend `lib/api/` typed clients for the Phase 2 endpoints.
- Frontend `lib/signalwire/` setup: token fetch, dial, `userInput` listener
  wired to Zustand store.
- Functional dashboard shell with sidebar + working **Templates** page that
  lists 1 hard-coded template (AI Receptionist). "Hire" creates an employee +
  SignalWire Address → redirects to **Employee Detail**.
- Functional **Employee Detail** with a Call button. Successful
  browser-to-agent call. Live transcript (basic styling). Live event stream.
- Second built-in template (AI Recruiter) — proves the system isn't accidentally
  hard-coded.
- Full data-isolation test pass against the real API.

**Definition of done**

- [ ] Two SignalWire test projects can log in concurrently; each sees only its
      own employees.
- [ ] Playwright golden-path test from §9.3 passes against Replit.
- [ ] Manual: refreshing the page during an active call replays the existing
      transcript (per §8.4).
- [ ] No plaintext `api_token` ever appears in browser DevTools network tab
      after login.

### 11.4 Phase 4 — Frontend rebuild + the seven pages

**Goal**: Polished, distinctive, accessible UI across the full surface area.

**Work**

- Invoke `frontend-design:frontend-design` for the design pass — produces
  `components/ui/` primitives and a coherent visual language.
- All seven pages built to spec: Login, Dashboard home, Employees (list +
  detail + new-from-template), Templates, Call Logs (list + detail), Resources
  (read-only Fabric API view), Knowledge Base (per-employee), Phone Numbers
  (assign DID).
- All four templates shipped: AI Receptionist, AI SDR, AI Recruiter, AI Support
  Tier 1. Each demonstrably exercises its headline capability when called.
- Knowledge Base page wires to `native_vector_search` skill in the agent.
- Phone Numbers page wires to SignalWire DID lookup/assignment via Fabric API.
- Loading / empty / error states everywhere.
- React error boundaries (app, page, call) per §10.4.
- A11y pass: semantic HTML, ARIA, focus, keyboard nav, contrast ≥ AA, tap
  targets ≥ 44 px (per `chrome-devtools-mcp:a11y-debugging`).
- Responsive: 1440 × 900, 1024 × 768, tablet portrait.
- All `.jsx` → `.tsx`. No `any`.
- Vitest + RTL + Playwright suites cover every page's primary interactions.

**Definition of done**

- [ ] Lighthouse a11y ≥ 95 on every page.
- [ ] Lighthouse performance ≥ 90 on dashboard home over a Replit-hosted
      preview.
- [ ] All four templates pass their per-template smoke test.
- [ ] Frontend coverage ≥ 70 %; e2e Playwright suite green on Replit preview.
- [ ] Visual review with stakeholder; ship-or-iterate decision.

### 11.5 Phase 5 — Observability, polish, docs

**Goal**: Production-grade ops + onboarding so a stranger can deploy and demo
this without help.

**Work**

- Sentry wired front + back per §10; alerts configured for
  `TenantMismatchError`, 5xx-rate spikes, `swaig.handler.failed` rate.
- Final pass on structured logging.
- `GET /version`, `/healthz`, `/readyz` production-tuned.
- Rate limits tuned against actual traffic shape.
- In-app first-run onboarding: tour modal on first dashboard visit;
  "Hire your first employee in 60 seconds" guided path.
- Docs site in `docs/` (VitePress or Astro Starlight): Quickstart, Architecture,
  Templates, Adding a Template, SWAIG Handlers, Multi-tenancy model, Security,
  Deploying to Replit, Deploying elsewhere, FAQ.
- Architecture diagrams as SVG (drawn from the ASCII in this design).
- Final design pass — micro-interactions, motion, typographic refinement,
  loading shimmer, empty-state illustrations.
- Soak test: 10 sequential calls per template, no degradation.
- Full README rewrite. CONTRIBUTING.md. SECURITY.md. LICENSE confirmed.

**Definition of done**

- [ ] Stranger-test: hand the repo URL + a SignalWire test project to someone
      who has never seen it. They reach a working Replit deploy in ≤ 30
      minutes following only `README.md`.
- [ ] All test suites green; full pyramid in CI under 12 minutes.
- [ ] Sentry shows zero unresolved issues after a 24-hour soak.
- [ ] Onboarding flow taken end-to-end works without errors.
- [ ] Docs site builds and deploys (Replit static or GitHub Pages).
- [ ] Stakeholder sign-off: "This is the demo we want to put in front of
      customers."

---

## 12. Cross-phase invariants

- `main` is always green. PRs that fail CI do not merge.
- Every PR includes a passing test for its change (TDD per `config.md`).
- Every PR ends with `/simplify` review per `CLAUDE.md`.
- Code-review subagent runs against major changes per
  `superpowers:requesting-code-review`.
- No commits with hardcoded credentials, even in tests (use SW test project +
  GitHub secrets).

---

## 13. Open questions / future work

These are deliberately deferred — not blocking v1 ship.

- Visual regression testing (Chromatic / Percy) — revisit at end of Phase 5 if
  the design refresh justifies it.
- Postgres migration path — schemas above are Postgres-compatible; SQLite is
  fine for Replit demo concurrency.
- Public freeform "describe your agent" path (Question 2 option A) — punted to
  v2.
- Replit-Postgres integration for higher concurrency — punted.
- Per-tenant analytics rollups — call_logs are sufficient for v1.

---

## 14. Glossary

- **SWML** — SignalWire Markup Language. JSON/YAML document the SignalWire
  cloud fetches to drive a call.
- **SWAIG** — SignalWire AI Gateway. The function-calling protocol the AI uses
  during a call; we expose handlers at `POST /swaig/{employee_id}/{fn}`.
- **POM** — Prompt Object Model. Structured prompt sections (Personality, Goal,
  Instructions, …) the `signalwire-agents` SDK assembles into the AI prompt.
- **DataMap** — Declarative SignalWire feature for calling external APIs from
  inside SWML without a webhook handler.
- **Fabric API** — SignalWire's resource/address/subscriber API; how we create
  the per-employee Address that points at our `/swml/{id}` endpoint.
- **`swml_user_event`** — the mechanism for sending structured events from a
  SWAIG handler to the connected browser via the Fabric WebSocket. The demo's
  primary "wow" channel.
