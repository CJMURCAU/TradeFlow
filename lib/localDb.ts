import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
type BindValue = string | number | null | boolean | Uint8Array;
import { Job, Client, Part, TimeEntry, BusinessDetails, Employee, JobAssignment } from './supabase';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (Platform.OS === 'web') throw new Error('SQLite not supported on web');
  if (!db) {
    db = SQLite.openDatabaseSync('tradepro_offline.db');
  }
  return db;
}

export function initLocalDb() {
  if (Platform.OS === 'web') return;
  const database = getDb();
  database.execSync(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      title TEXT,
      purchase_order_number TEXT,
      description TEXT,
      status TEXT,
      scheduled_time TEXT,
      job_card_number INTEGER,
      email_sent INTEGER DEFAULT 0,
      created_at TEXT,
      _dirty INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      company_name TEXT,
      name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS parts (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      name TEXT,
      cost REAL,
      quantity INTEGER,
      employee_id TEXT,
      created_at TEXT,
      _dirty INTEGER DEFAULT 0,
      _deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      employee_id TEXT,
      start_time TEXT,
      end_time TEXT,
      is_running INTEGER DEFAULT 0,
      created_at TEXT,
      _dirty INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS business_details (
      id TEXT PRIMARY KEY,
      company_name TEXT,
      tradesman_name TEXT,
      job_email TEXT,
      default_hourly_rate REAL,
      job_card_number_start INTEGER,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      employee_user_id TEXT,
      name TEXT,
      email TEXT,
      status TEXT,
      calendar_access INTEGER DEFAULT 0,
      hourly_rate REAL,
      invite_token TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS job_assignments (
      id TEXT PRIMARY KEY,
      job_id TEXT,
      employee_id TEXT,
      assigned_by TEXT,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_queue (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

// ─── Seed helpers ────────────────────────────────────────────────────────────

function upsertRows(table: string, rows: Record<string, unknown>[], boolFields: string[] = []) {
  if (Platform.OS === 'web') return;
  const database = getDb();
  if (!rows.length) return;
  for (const row of rows) {
    const converted: Record<string, unknown> = { ...row };
    for (const f of boolFields) {
      if (f in converted) converted[f] = converted[f] ? 1 : 0;
    }
    const keys = Object.keys(converted);
    const placeholders = keys.map(() => '?').join(', ');
    const updateClause = keys.filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => converted[k] as BindValue);
    const updateValues = keys.filter(k => k !== 'id').map(k => converted[k] as BindValue);
    database.runSync(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${updateClause}`,
      [...values, ...updateValues]
    );
  }
}

export function seedJobs(rows: (Job & { client?: Client })[]) {
  upsertRows('jobs', rows.map(({ client: _c, ...r }) => r), ['email_sent']);
}

export function seedClients(rows: Client[]) {
  upsertRows('clients', rows as unknown as Record<string, unknown>[]);
}

export function seedParts(rows: Part[]) {
  upsertRows('parts', rows as unknown as Record<string, unknown>[]);
}

export function seedTimeEntries(rows: TimeEntry[]) {
  upsertRows('time_entries', rows as unknown as Record<string, unknown>[], ['is_running']);
}

export function seedBusinessDetails(row: BusinessDetails) {
  upsertRows('business_details', [row as unknown as Record<string, unknown>]);
}

export function seedEmployees(rows: Employee[]) {
  upsertRows('employees', rows as unknown as Record<string, unknown>[], ['calendar_access']);
}

export function seedJobAssignments(rows: JobAssignment[]) {
  upsertRows('job_assignments', rows as unknown as Record<string, unknown>[], ['completed']);
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

export function getLocalJobs(): (Job & { client?: Client })[] {
  if (Platform.OS === 'web') return [];
  const database = getDb();
  const jobs = database.getAllSync<Job>('SELECT * FROM jobs ORDER BY scheduled_time ASC');
  const clients = database.getAllSync<Client>('SELECT * FROM clients');
  const clientMap = new Map(clients.map(c => [c.id, c]));
  return jobs.map(j => ({
    ...j,
    email_sent: Boolean(j.email_sent),
    client: j.client_id ? clientMap.get(j.client_id) : undefined,
  }));
}

export function getLocalJob(id: string): (Job & { client?: Client }) | null {
  if (Platform.OS === 'web') return null;
  const database = getDb();
  const job = database.getFirstSync<Job>('SELECT * FROM jobs WHERE id = ?', [id]);
  if (!job) return null;
  const client = job.client_id
    ? database.getFirstSync<Client>('SELECT * FROM clients WHERE id = ?', [job.client_id]) ?? undefined
    : undefined;
  return { ...job, email_sent: Boolean(job.email_sent), client };
}

export function getLocalParts(jobId: string): Part[] {
  if (Platform.OS === 'web') return [];
  const database = getDb();
  return database.getAllSync<Part>(
    'SELECT * FROM parts WHERE job_id = ? AND _deleted = 0',
    [jobId]
  );
}

export function getLocalTimeEntries(jobId: string): TimeEntry[] {
  if (Platform.OS === 'web') return [];
  const database = getDb();
  const rows = database.getAllSync<TimeEntry>(
    'SELECT * FROM time_entries WHERE job_id = ? ORDER BY start_time DESC',
    [jobId]
  );
  return rows.map(r => ({ ...r, is_running: Boolean(r.is_running) }));
}

export function getLocalBusinessDetails(): BusinessDetails | null {
  if (Platform.OS === 'web') return null;
  const database = getDb();
  return database.getFirstSync<BusinessDetails>('SELECT * FROM business_details LIMIT 1') ?? null;
}

export function getLocalEmployees(userId: string): Employee[] {
  if (Platform.OS === 'web') return [];
  const database = getDb();
  const rows = database.getAllSync<Employee>(
    "SELECT * FROM employees WHERE user_id = ? AND status = 'active'",
    [userId]
  );
  return rows.map(r => ({ ...r, calendar_access: Boolean(r.calendar_access) }));
}

export function getLocalJobAssignments(jobId: string): JobAssignment[] {
  if (Platform.OS === 'web') return [];
  const database = getDb();
  const rows = database.getAllSync<JobAssignment>(
    'SELECT * FROM job_assignments WHERE job_id = ?',
    [jobId]
  );
  return rows.map(r => ({ ...r, completed: Boolean(r.completed) }));
}

export function getLocalClients(): Client[] {
  if (Platform.OS === 'web') return [];
  const database = getDb();
  return database.getAllSync<Client>('SELECT * FROM clients ORDER BY name ASC');
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export function updateLocalJob(id: string, data: Partial<Job>) {
  if (Platform.OS === 'web') return;
  const database = getDb();
  const keys = Object.keys(data);
  if (!keys.length) return;
  const clause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => (data as Record<string, unknown>)[k] as BindValue);
  database.runSync(`UPDATE jobs SET ${clause}, _dirty = 1 WHERE id = ?`, [...values, id]);
}

export function insertLocalTimeEntry(entry: TimeEntry) {
  if (Platform.OS === 'web') return;
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO time_entries
      (id, job_id, employee_id, start_time, end_time, is_running, created_at, _dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      entry.id,
      entry.job_id,
      entry.employee_id ?? null,
      entry.start_time,
      entry.end_time ?? null,
      entry.is_running ? 1 : 0,
      entry.created_at ?? new Date().toISOString(),
    ]
  );
}

export function updateLocalTimeEntry(id: string, data: Partial<TimeEntry>) {
  if (Platform.OS === 'web') return;
  const database = getDb();
  const keys = Object.keys(data);
  if (!keys.length) return;
  const converted: Record<string, BindValue> = {};
  for (const k of keys) {
    const v = (data as Record<string, unknown>)[k];
    converted[k] = k === 'is_running' ? (v ? 1 : 0) : (v as BindValue);
  }
  const clause = Object.keys(converted).map(k => `${k} = ?`).join(', ');
  const values = Object.keys(converted).map(k => converted[k]);
  database.runSync(`UPDATE time_entries SET ${clause}, _dirty = 1 WHERE id = ?`, [...values, id]);
}

export function insertLocalPart(part: Part) {
  if (Platform.OS === 'web') return;
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO parts
      (id, job_id, name, cost, quantity, employee_id, created_at, _dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      part.id,
      part.job_id,
      part.name,
      part.cost,
      part.quantity,
      part.employee_id ?? null,
      part.created_at ?? new Date().toISOString(),
    ]
  );
}

export function deleteLocalPart(id: string) {
  if (Platform.OS === 'web') return;
  const database = getDb();
  database.runSync('UPDATE parts SET _deleted = 1, _dirty = 1 WHERE id = ?', [id]);
}

// ─── Queue helpers ────────────────────────────────────────────────────────────

export type QueuedOperation = {
  id: string;
  table_name: string;
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  created_at: string;
};

export function enqueue(op: Omit<QueuedOperation, 'id' | 'created_at'>) {
  if (Platform.OS === 'web') return;
  const database = getDb();
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  database.runSync(
    'INSERT INTO pending_queue (id, table_name, operation, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, op.table_name, op.operation, JSON.stringify(op.payload), new Date().toISOString()]
  );
}

export function getPendingQueue(): QueuedOperation[] {
  if (Platform.OS === 'web') return [];
  const database = getDb();
  return database
    .getAllSync<{ id: string; table_name: string; operation: string; payload: string; created_at: string }>(
      'SELECT * FROM pending_queue ORDER BY created_at ASC'
    )
    .map(row => ({ ...row, payload: JSON.parse(row.payload) } as QueuedOperation));
}

export function dequeue(ids: string[]) {
  if (Platform.OS === 'web' || !ids.length) return;
  const database = getDb();
  const placeholders = ids.map(() => '?').join(', ');
  database.runSync(`DELETE FROM pending_queue WHERE id IN (${placeholders})`, ids);
}

export function clearDirtyFlag(table: string, id: string) {
  if (Platform.OS === 'web') return;
  const database = getDb();
  database.runSync(`UPDATE ${table} SET _dirty = 0 WHERE id = ?`, [id]);
}
