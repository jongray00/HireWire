-- migration 001: initial multi-tenant schema
PRAGMA foreign_keys = ON;

CREATE TABLE projects (
  id                   TEXT PRIMARY KEY,
  space_url            TEXT NOT NULL,
  auth_token_enc       BLOB NOT NULL,
  webhook_password_enc BLOB NOT NULL,
  display_name         TEXT,
  auth_scope           TEXT NOT NULL DEFAULT 'unknown',
  wizard_resource_id   TEXT,
  wizard_status        TEXT NOT NULL DEFAULT 'pending',
  first_seen_at        INTEGER NOT NULL,
  last_login_at        INTEGER NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE employees (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  personality       TEXT,
  goal              TEXT,
  instructions      TEXT,
  voice             TEXT,
  language          TEXT NOT NULL DEFAULT 'en-US',
  enabled_functions TEXT NOT NULL,
  config_json       TEXT,
  resource_address  TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER
);
CREATE INDEX idx_employees_project ON employees(project_id) WHERE deleted_at IS NULL;

CREATE TABLE documents (
  id           TEXT PRIMARY KEY,
  employee_id  TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  mime_type    TEXT,
  size_bytes   INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at  INTEGER NOT NULL
);
CREATE INDEX idx_documents_employee ON documents(employee_id);

CREATE TABLE calls (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id        TEXT REFERENCES employees(id) ON DELETE SET NULL,
  caller_number      TEXT,
  caller_number_hash TEXT,
  started_at         INTEGER NOT NULL,
  ended_at           INTEGER,
  duration_secs      INTEGER,
  status             TEXT NOT NULL,
  transcript_enc     BLOB,
  summary_enc        BLOB,
  outcome            TEXT
);
CREATE INDEX idx_calls_project_started ON calls(project_id, started_at DESC);
CREATE INDEX idx_calls_employee ON calls(employee_id);

CREATE TABLE customers (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phone_number TEXT,
  name_enc     BLOB,
  email_enc    BLOB,
  notes_enc    BLOB,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  UNIQUE (project_id, phone_number)
);

CREATE TABLE audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    TEXT,
  actor         TEXT NOT NULL,
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  metadata_json TEXT,
  occurred_at   INTEGER NOT NULL
);
CREATE INDEX idx_audit_project_time ON audit_log(project_id, occurred_at DESC);
CREATE INDEX idx_audit_action_time ON audit_log(action, occurred_at DESC);
