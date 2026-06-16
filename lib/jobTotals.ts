import type { Part, TimeEntry, Employee, JobAssignment } from './supabase';

// Single source of truth for job time/cost roll-ups (audit A-M3). Previously the
// job screen, the PDF generator and the email function each computed totals with
// slightly different rules, so the on-screen total could disagree with the
// emailed one. This pure function encodes ONE rule set:
//
//   - Owner labour: all owner entries (employee_id == null). A still-running
//     entry counts up to `now` (live ticking on screen; a snapshot in emails).
//   - Employee labour: only employees whose assignment is marked completed, and
//     only entries that have ended (no live ticking for employees).
//   - Parts: owner parts always; employee parts only once that employee's
//     assignment is completed.

export type LabourRow = { id: string; name: string; seconds: number; rate: number };

export type JobTotals = {
  ownerSeconds: number;
  employeeRows: LabourRow[];
  totalSeconds: number;
  labourCost: number;
  partsCost: number;
  total: number;
};

export type JobTotalsInput = {
  timeEntries: Pick<TimeEntry, 'employee_id' | 'start_time' | 'end_time'>[];
  parts: Pick<Part, 'employee_id' | 'cost' | 'quantity'>[];
  employees: Pick<Employee, 'id' | 'name' | 'hourly_rate'>[];
  assignments: Pick<JobAssignment, 'employee_id' | 'completed'>[];
  defaultRate: number;
  now?: number;
};

const seconds = (start: string, end: string | null, now: number): number =>
  ((end ? new Date(end).getTime() : now) - new Date(start).getTime()) / 1000;

export function computeJobTotals(input: JobTotalsInput): JobTotals {
  const now = input.now ?? Date.now();
  const completed = new Set(
    input.assignments.filter(a => a.completed).map(a => a.employee_id)
  );

  const ownerSeconds = input.timeEntries
    .filter(e => e.employee_id == null)
    .reduce((t, e) => t + seconds(e.start_time, e.end_time, now), 0);

  const rateMap = new Map(
    input.employees.map(e => [e.id, { name: e.name, rate: e.hourly_rate ?? input.defaultRate }])
  );
  const rowMap = new Map<string, LabourRow>();
  input.timeEntries
    .filter(e => e.employee_id != null && completed.has(e.employee_id) && e.end_time != null)
    .forEach(e => {
      const id = e.employee_id as string;
      const info = rateMap.get(id) ?? { name: 'Employee', rate: input.defaultRate };
      const secs = seconds(e.start_time, e.end_time, now);
      const existing = rowMap.get(id);
      if (existing) existing.seconds += secs;
      else rowMap.set(id, { id, name: info.name, seconds: secs, rate: info.rate });
    });
  const employeeRows = Array.from(rowMap.values());

  const ownerCost = (ownerSeconds / 3600) * input.defaultRate;
  const empCost = employeeRows.reduce((s, r) => s + (r.seconds / 3600) * r.rate, 0);
  const labourCost = ownerCost + empCost;

  const employeeSeconds = employeeRows.reduce((s, r) => s + r.seconds, 0);
  const totalSeconds = ownerSeconds + employeeSeconds;

  const partsCost = input.parts
    .filter(p => p.employee_id == null || completed.has(p.employee_id))
    .reduce((t, p) => t + p.cost * p.quantity, 0);

  return { ownerSeconds, employeeRows, totalSeconds, labourCost, partsCost, total: labourCost + partsCost };
}
