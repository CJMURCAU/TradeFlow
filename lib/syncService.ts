import { supabase, Job, Client, Part, TimeEntry } from './supabase';
import {
  getPendingQueue,
  dequeue,
  clearDirtyFlag,
  seedJobs,
  seedClients,
  seedParts,
  seedTimeEntries,
  seedBusinessDetails,
  seedEmployees,
  seedJobAssignments,
} from './localDb';

export async function seedCacheFromServer(): Promise<void> {
  try {
    const [
      jobsRes,
      clientsRes,
      partsRes,
      timeRes,
      bizRes,
      empRes,
      assignRes,
    ] = await Promise.all([
      supabase.from('jobs').select('*, client:clients(*)').order('scheduled_time', { ascending: true }),
      supabase.from('clients').select('*'),
      supabase.from('parts').select('*'),
      supabase.from('time_entries').select('*'),
      supabase.from('business_details').select('*').limit(1).maybeSingle(),
      supabase.from('employees').select('*'),
      supabase.from('job_assignments').select('*'),
    ]);

    if (clientsRes.data) seedClients(clientsRes.data as Client[]);

    if (jobsRes.data) {
      const jobs = jobsRes.data.map((j: Job & { client?: Client | Client[] }) => ({
        ...j,
        client: Array.isArray(j.client) ? j.client[0] : j.client,
      }));
      seedJobs(jobs as (Job & { client?: Client })[]);
    }

    if (partsRes.data) seedParts(partsRes.data as Part[]);
    if (timeRes.data) seedTimeEntries(timeRes.data as TimeEntry[]);
    if (bizRes.data) seedBusinessDetails(bizRes.data);
    if (empRes.data) seedEmployees(empRes.data);
    if (assignRes.data) seedJobAssignments(assignRes.data);
  } catch {
    // No network — silent failure, cache stays as-is
  }
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getPendingQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const syncedIds: string[] = [];

  for (const op of queue) {
    try {
      let error: { message: string } | null = null;

      if (op.operation === 'insert') {
        const res = await supabase.from(op.table_name).upsert(op.payload);
        error = res.error;
      } else if (op.operation === 'update') {
        const { id, ...data } = op.payload;
        const res = await supabase.from(op.table_name).update(data).eq('id', id as string);
        error = res.error;
      } else if (op.operation === 'delete') {
        const res = await supabase.from(op.table_name).delete().eq('id', op.payload.id as string);
        error = res.error;
      }

      if (!error) {
        syncedIds.push(op.id);
        if (op.payload.id && op.operation !== 'delete') {
          clearDirtyFlag(op.table_name, op.payload.id as string);
        }
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  if (syncedIds.length) dequeue(syncedIds);

  // After syncing, refresh cache from server
  await seedCacheFromServer();

  return { synced, failed };
}
