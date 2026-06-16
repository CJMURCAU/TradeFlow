// Shared job-status helpers (audit A-M2). getStatusColor was copy-pasted in
// five screens; this is the single definition. Null-safe (audit P-H4).

export type JobStatus = 'pending' | 'active' | 'completed';

export function getStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'pending': return '#F59E0B';
    case 'active': return '#3B82F6';
    case 'completed': return '#10B981';
    default: return '#6B7280';
  }
}

/** Upper-cased label, safe against null/undefined status. */
export function getStatusLabel(status: string | null | undefined): string {
  return (status ?? 'pending').toUpperCase();
}
