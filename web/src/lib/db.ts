/**
 * SQLite Database Module
 *
 * Initializes better-sqlite3 at web/data/sally_sales.db, creates tables,
 * and exports query helpers for all server-side code.
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { randomUUID } from 'crypto';

const DB_PATH = join(process.cwd(), 'data', 'sally_sales.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initTables(_db);
  }
  return _db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      space_url TEXT NOT NULL,
      project_id TEXT UNIQUE NOT NULL,
      api_token TEXT NOT NULL,
      subscriber_id TEXT,
      subscriber_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES users(project_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'Assistant',
      greeting TEXT,
      prompt TEXT,
      voice TEXT DEFAULT 'openai.nova',
      language TEXT DEFAULT 'en-US',
      temperature REAL DEFAULT 0.7,
      speech_hints TEXT DEFAULT '[]',
      enabled_functions TEXT DEFAULT '[]',
      transfer_number TEXT DEFAULT '',
      transfer_from TEXT DEFAULT '',
      sms_from_number TEXT DEFAULT '',
      phone_number TEXT DEFAULT '',
      video_idle_url TEXT DEFAULT '',
      video_talking_url TEXT DEFAULT '',
      resource_id TEXT,
      resource_name TEXT,
      call_fabric_address TEXT,
      webhook_url TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES users(project_id) ON DELETE SET NULL,
      employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
      employee_name TEXT,
      employee_role TEXT,
      timestamp TEXT,
      duration_sec INTEGER DEFAULT 0,
      summary TEXT,
      caller_intent TEXT,
      outcome TEXT,
      sentiment TEXT,
      topics TEXT DEFAULT '[]',
      follow_up TEXT,
      user_messages INTEGER DEFAULT 0,
      assistant_messages INTEGER DEFAULT 0,
      total_messages INTEGER DEFAULT 0,
      swaig_calls INTEGER DEFAULT 0,
      avg_latency_ms INTEGER,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      raw_payload TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sms_logs (
      id TEXT PRIMARY KEY,
      employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
      call_id TEXT,
      from_number TEXT NOT NULL,
      to_number TEXT NOT NULL,
      body TEXT,
      status TEXT DEFAULT 'sent',
      signalwire_sid TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT,
      employee_id TEXT,
      action_type TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );
  `);

  // Migrate new employee columns (safe to re-run; ignores duplicates)
  const employeeColumnsToAdd = [
    { name: 'business_hours_start', type: 'INTEGER DEFAULT 9' },
    { name: 'business_hours_end', type: 'INTEGER DEFAULT 18' },
    { name: 'business_days', type: "TEXT DEFAULT '[0,1,2,3,4]'" },
    { name: 'documents', type: "TEXT DEFAULT '[]'" },
    { name: 'email_provider', type: "TEXT DEFAULT ''" },
    { name: 'sendgrid_api_key', type: "TEXT DEFAULT ''" },
    { name: 'email_from_address', type: "TEXT DEFAULT ''" },
    { name: 'email_from_name', type: "TEXT DEFAULT ''" },
  ];

  for (const col of employeeColumnsToAdd) {
    try {
      db.exec(`ALTER TABLE employees ADD COLUMN ${col.name} ${col.type}`);
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function upsertUser(data: {
  projectId: string;
  spaceUrl: string;
  apiToken: string;
  subscriberId?: string;
  subscriberData?: any;
}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO users (id, space_url, project_id, api_token, subscriber_id, subscriber_data, updated_at)
    VALUES (@id, @spaceUrl, @projectId, @apiToken, @subscriberId, @subscriberData, datetime('now'))
    ON CONFLICT(project_id) DO UPDATE SET
      space_url = @spaceUrl,
      api_token = @apiToken,
      subscriber_id = COALESCE(@subscriberId, users.subscriber_id),
      subscriber_data = COALESCE(@subscriberData, users.subscriber_data),
      updated_at = datetime('now')
  `);
  stmt.run({
    id: data.projectId,
    spaceUrl: data.spaceUrl,
    projectId: data.projectId,
    apiToken: data.apiToken,
    subscriberId: data.subscriberId || null,
    subscriberData: data.subscriberData ? JSON.stringify(data.subscriberData) : null,
  });
}

export function getUserByProjectId(projectId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE project_id = ?').get(projectId) as any;
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export function getEmployeesByProject(projectId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM employees WHERE project_id = ? AND status = ? ORDER BY created_at DESC').all(projectId, 'active') as any[];
}

export function getAllEmployees() {
  const db = getDb();
  return db.prepare('SELECT * FROM employees WHERE status = ? ORDER BY created_at DESC').all('active') as any[];
}

export function getEmployeeById(id: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as any;
}

export function upsertEmployee(data: {
  id: string;
  projectId: string;
  name: string;
  role?: string;
  greeting?: string;
  prompt?: string;
  voice?: string;
  language?: string;
  temperature?: number;
  speechHints?: string[];
  enabledFunctions?: string[];
  transferNumber?: string;
  transferFrom?: string;
  smsFromNumber?: string;
  phoneNumber?: string;
  videoIdleUrl?: string;
  videoTalkingUrl?: string;
  resourceId?: string;
  resourceName?: string;
  callFabricAddress?: string;
  webhookUrl?: string;
  status?: string;
  businessHoursStart?: number;
  businessHoursEnd?: number;
  businessDays?: number[];
  documents?: any[];
  emailProvider?: string;
  sendgridApiKey?: string;
  emailFromAddress?: string;
  emailFromName?: string;
}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO employees (
      id, project_id, name, role, greeting, prompt, voice, language, temperature,
      speech_hints, enabled_functions, transfer_number, transfer_from,
      sms_from_number, phone_number, video_idle_url, video_talking_url,
      resource_id, resource_name, call_fabric_address, webhook_url, status,
      business_hours_start, business_hours_end, business_days, documents,
      email_provider, sendgrid_api_key, email_from_address, email_from_name,
      updated_at
    ) VALUES (
      @id, @projectId, @name, @role, @greeting, @prompt, @voice, @language, @temperature,
      @speechHints, @enabledFunctions, @transferNumber, @transferFrom,
      @smsFromNumber, @phoneNumber, @videoIdleUrl, @videoTalkingUrl,
      @resourceId, @resourceName, @callFabricAddress, @webhookUrl, @status,
      @businessHoursStart, @businessHoursEnd, @businessDays, @documents,
      @emailProvider, @sendgridApiKey, @emailFromAddress, @emailFromName,
      datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      role = @role,
      greeting = @greeting,
      prompt = @prompt,
      voice = @voice,
      language = @language,
      temperature = @temperature,
      speech_hints = @speechHints,
      enabled_functions = @enabledFunctions,
      transfer_number = @transferNumber,
      transfer_from = @transferFrom,
      sms_from_number = @smsFromNumber,
      phone_number = @phoneNumber,
      video_idle_url = @videoIdleUrl,
      video_talking_url = @videoTalkingUrl,
      resource_id = COALESCE(@resourceId, employees.resource_id),
      resource_name = COALESCE(@resourceName, employees.resource_name),
      call_fabric_address = COALESCE(@callFabricAddress, employees.call_fabric_address),
      webhook_url = COALESCE(@webhookUrl, employees.webhook_url),
      status = @status,
      business_hours_start = @businessHoursStart,
      business_hours_end = @businessHoursEnd,
      business_days = @businessDays,
      documents = @documents,
      email_provider = @emailProvider,
      sendgrid_api_key = @sendgridApiKey,
      email_from_address = @emailFromAddress,
      email_from_name = @emailFromName,
      updated_at = datetime('now')
  `);
  stmt.run({
    id: data.id,
    projectId: data.projectId,
    name: data.name,
    role: data.role || 'Assistant',
    greeting: data.greeting || null,
    prompt: data.prompt || null,
    voice: data.voice || 'openai.nova',
    language: data.language || 'en-US',
    temperature: data.temperature ?? 0.7,
    speechHints: JSON.stringify(data.speechHints || []),
    enabledFunctions: JSON.stringify(data.enabledFunctions || []),
    transferNumber: data.transferNumber || '',
    transferFrom: data.transferFrom || '',
    smsFromNumber: data.smsFromNumber || '',
    phoneNumber: data.phoneNumber || '',
    videoIdleUrl: data.videoIdleUrl || '',
    videoTalkingUrl: data.videoTalkingUrl || '',
    resourceId: data.resourceId || null,
    resourceName: data.resourceName || null,
    callFabricAddress: data.callFabricAddress || null,
    webhookUrl: data.webhookUrl || null,
    status: data.status || 'active',
    businessHoursStart: data.businessHoursStart ?? 9,
    businessHoursEnd: data.businessHoursEnd ?? 18,
    businessDays: JSON.stringify(data.businessDays || [0, 1, 2, 3, 4]),
    documents: JSON.stringify(data.documents || []),
    emailProvider: data.emailProvider || '',
    sendgridApiKey: data.sendgridApiKey || '',
    emailFromAddress: data.emailFromAddress || '',
    emailFromName: data.emailFromName || '',
  });
}

export function deleteEmployee(id: string) {
  const db = getDb();
  db.prepare('UPDATE employees SET status = ? WHERE id = ?').run('deleted', id);
}

export function updateEmployeeWebhook(id: string, webhookUrl: string) {
  const db = getDb();
  db.prepare('UPDATE employees SET webhook_url = ?, updated_at = datetime(\'now\') WHERE id = ?').run(webhookUrl, id);
}

export function updateEmployeeResource(id: string, data: {
  resourceId?: string;
  resourceName?: string;
  callFabricAddress?: string;
  webhookUrl?: string;
}) {
  const db = getDb();
  db.prepare(`
    UPDATE employees SET
      resource_id = COALESCE(?, resource_id),
      resource_name = COALESCE(?, resource_name),
      call_fabric_address = COALESCE(?, call_fabric_address),
      webhook_url = COALESCE(?, webhook_url),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(data.resourceId || null, data.resourceName || null, data.callFabricAddress || null, data.webhookUrl || null, id);
}

export function updateEmployeeDocuments(employeeId: string, documents: any[]) {
  const db = getDb();
  const stmt = db.prepare(`UPDATE employees SET documents = ?, updated_at = datetime('now') WHERE id = ?`);
  return stmt.run(JSON.stringify(documents), employeeId);
}

// ---------------------------------------------------------------------------
// Call Logs
// ---------------------------------------------------------------------------

export function insertCallLog(data: {
  id: string;
  projectId?: string;
  employeeId?: string;
  employeeName?: string;
  employeeRole?: string;
  timestamp?: string;
  durationSec?: number;
  summary?: string;
  callerIntent?: string;
  outcome?: string;
  sentiment?: string;
  topics?: string[];
  followUp?: string;
  userMessages?: number;
  assistantMessages?: number;
  totalMessages?: number;
  swaigCalls?: number;
  avgLatencyMs?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  rawPayload?: any;
}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO call_logs (
      id, project_id, employee_id, employee_name, employee_role, timestamp,
      duration_sec, summary, caller_intent, outcome, sentiment, topics,
      follow_up, user_messages, assistant_messages, total_messages,
      swaig_calls, avg_latency_ms, total_input_tokens, total_output_tokens,
      raw_payload
    ) VALUES (
      @id, @projectId, @employeeId, @employeeName, @employeeRole, @timestamp,
      @durationSec, @summary, @callerIntent, @outcome, @sentiment, @topics,
      @followUp, @userMessages, @assistantMessages, @totalMessages,
      @swaigCalls, @avgLatencyMs, @totalInputTokens, @totalOutputTokens,
      @rawPayload
    )
  `);
  stmt.run({
    id: data.id,
    projectId: data.projectId || null,
    employeeId: data.employeeId || null,
    employeeName: data.employeeName || null,
    employeeRole: data.employeeRole || null,
    timestamp: data.timestamp || new Date().toISOString(),
    durationSec: data.durationSec || 0,
    summary: data.summary || null,
    callerIntent: data.callerIntent || null,
    outcome: data.outcome || null,
    sentiment: data.sentiment || null,
    topics: JSON.stringify(data.topics || []),
    followUp: data.followUp || null,
    userMessages: data.userMessages || 0,
    assistantMessages: data.assistantMessages || 0,
    totalMessages: data.totalMessages || 0,
    swaigCalls: data.swaigCalls || 0,
    avgLatencyMs: data.avgLatencyMs || null,
    totalInputTokens: data.totalInputTokens || 0,
    totalOutputTokens: data.totalOutputTokens || 0,
    rawPayload: data.rawPayload ? JSON.stringify(data.rawPayload) : null,
  });
}

export function getCallLogs(projectId?: string) {
  const db = getDb();
  if (projectId) {
    return db.prepare('SELECT * FROM call_logs WHERE project_id = ? ORDER BY timestamp DESC').all(projectId) as any[];
  }
  return db.prepare('SELECT * FROM call_logs ORDER BY timestamp DESC').all() as any[];
}

// ---------------------------------------------------------------------------
// Call Actions
// ---------------------------------------------------------------------------

export function insertCallAction(callId: string, employeeId: string, actionType: string, data: object) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO call_actions (call_id, employee_id, action_type, data)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(callId, employeeId, actionType, JSON.stringify(data));
}

export function getCallActions(callId: string) {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM call_actions WHERE call_id = ? ORDER BY created_at ASC`);
  const rows = stmt.all(callId) as any[];
  return rows.map(row => ({
    ...row,
    data: JSON.parse(row.data || '{}'),
  }));
}

// ---------------------------------------------------------------------------
// App Settings
// ---------------------------------------------------------------------------

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as any;
  return row?.value || null;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
  `).run(key, value, value);
}

// ---------------------------------------------------------------------------
// SMS Logs
// ---------------------------------------------------------------------------

export function insertSmsLog(data: {
  employeeId?: string;
  callId?: string;
  fromNumber: string;
  toNumber: string;
  body?: string;
  status?: string;
  signalwireSid?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO sms_logs (id, employee_id, call_id, from_number, to_number, body, status, signalwire_sid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), data.employeeId || null, data.callId || null, data.fromNumber, data.toNumber, data.body || null, data.status || 'sent', data.signalwireSid || null);
}

// ---------------------------------------------------------------------------
// Helpers for serializing DB rows back to frontend-compatible JSON
// ---------------------------------------------------------------------------

export function employeeRowToJson(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    role: row.role,
    greeting: row.greeting,
    prompt: row.prompt,
    voice: row.voice,
    language: row.language,
    temperature: row.temperature,
    speech_hints: safeJsonParse(row.speech_hints, []),
    enabled_functions: safeJsonParse(row.enabled_functions, []),
    transfer_number: row.transfer_number,
    transfer_from: row.transfer_from,
    sms_from_number: row.sms_from_number,
    phone_number: row.phone_number,
    video_idle_url: row.video_idle_url,
    video_talking_url: row.video_talking_url,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    callFabricAddress: row.call_fabric_address,
    webhookUrl: row.webhook_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    businessHoursStart: row.business_hours_start ?? 9,
    businessHoursEnd: row.business_hours_end ?? 18,
    businessDays: safeJsonParse(row.business_days, [0, 1, 2, 3, 4]),
    documents: safeJsonParse(row.documents, []),
    emailProvider: row.email_provider || '',
    sendgridApiKey: row.sendgrid_api_key || '',
    emailFromAddress: row.email_from_address || '',
    emailFromName: row.email_from_name || '',
  };
}

export function callLogRowToJson(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    employeeRole: row.employee_role,
    timestamp: row.timestamp,
    durationSec: row.duration_sec,
    summary: row.summary,
    callerIntent: row.caller_intent,
    outcome: row.outcome,
    sentiment: row.sentiment,
    topics: safeJsonParse(row.topics, []),
    followUp: row.follow_up,
    userMessages: row.user_messages,
    assistantMessages: row.assistant_messages,
    totalMessages: row.total_messages,
    swaigCalls: row.swaig_calls,
    avgLatencyMs: row.avg_latency_ms,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    _raw: safeJsonParse(row.raw_payload, null),
  };
}

function safeJsonParse(str: string | null, fallback: any) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
