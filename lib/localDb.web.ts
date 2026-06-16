// Web stub — SQLite offline cache is not available on web.
// All functions are no-ops that return safe empty values.

import { Job, Client, Part, TimeEntry, BusinessDetails, Employee, JobAssignment } from './supabase';

export function getDb(): never { throw new Error('SQLite not available on web'); }
export function initLocalDb() {}

export function seedJobs(_rows: (Job & { client?: Client })[]) {}
export function seedClients(_rows: Client[]) {}
export function seedParts(_rows: Part[]) {}
export function seedTimeEntries(_rows: TimeEntry[]) {}
export function seedBusinessDetails(_row: BusinessDetails) {}
export function seedEmployees(_rows: Employee[]) {}
export function seedJobAssignments(_rows: JobAssignment[]) {}

export function getLocalJobs(): (Job & { client?: Client })[] { return []; }
export function getLocalJob(_id: string): (Job & { client?: Client }) | null { return null; }
export function getLocalParts(_jobId: string): Part[] { return []; }
export function getLocalTimeEntries(_jobId: string): TimeEntry[] { return []; }
export function getLocalBusinessDetails(): BusinessDetails | null { return null; }
export function getLocalEmployees(_userId: string): Employee[] { return []; }
export function getLocalJobAssignments(_jobId: string): JobAssignment[] { return []; }
export function getLocalClients(): Client[] { return []; }

export function updateLocalJob(_id: string, _data: Partial<Job>) {}
export function insertLocalTimeEntry(_entry: TimeEntry) {}
export function updateLocalTimeEntry(_id: string, _data: Partial<TimeEntry>) {}
export function insertLocalPart(_part: Part) {}
export function deleteLocalPart(_id: string) {}

export type QueuedOperation = {
  id: string;
  table_name: string;
  operation: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  created_at: string;
};

export function enqueue(_op: Omit<QueuedOperation, 'id' | 'created_at'>) {}
export function getPendingQueue(): QueuedOperation[] { return []; }
export function dequeue(_ids: string[]) {}
export function clearDirtyFlag(_table: string, _id: string) {}
