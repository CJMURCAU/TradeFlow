import { computeJobTotals } from '../jobTotals';

const NOW = Date.UTC(2026, 0, 1, 12, 0, 0); // fixed clock for deterministic tests
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 1, h, m, 0)).toISOString();

describe('computeJobTotals', () => {
  it('counts owner labour, including a still-running entry up to now', () => {
    const totals = computeJobTotals({
      timeEntries: [
        { employee_id: null, start_time: at(10), end_time: at(11) }, // 1h ended
        { employee_id: null, start_time: at(11, 30), end_time: null }, // 30m running -> now=12:00
      ],
      parts: [],
      employees: [],
      assignments: [],
      defaultRate: 60,
      now: NOW,
    });
    expect(totals.ownerSeconds).toBe(5400); // 1h + 0.5h
    expect(totals.labourCost).toBeCloseTo(90); // 1.5h * 60
    expect(totals.total).toBeCloseTo(90);
  });

  it('only counts employee labour for completed assignments and ended entries', () => {
    const base = {
      parts: [],
      employees: [
        { id: 'e1', name: 'Alice', hourly_rate: 40 },
        { id: 'e2', name: 'Bob', hourly_rate: 50 },
      ],
      defaultRate: 60,
      now: NOW,
    };
    const timeEntries = [
      { employee_id: 'e1', start_time: at(9), end_time: at(11) }, // 2h, completed
      { employee_id: 'e2', start_time: at(9), end_time: at(10) }, // 1h, NOT completed
      { employee_id: 'e1', start_time: at(11), end_time: null }, // running -> ignored for employees
    ];
    const totals = computeJobTotals({
      ...base,
      timeEntries,
      assignments: [
        { employee_id: 'e1', completed: true },
        { employee_id: 'e2', completed: false },
      ],
    });
    // Only Alice's 2h ended entry counts.
    expect(totals.employeeRows).toHaveLength(1);
    expect(totals.employeeRows[0]).toMatchObject({ id: 'e1', seconds: 7200, rate: 40 });
    expect(totals.labourCost).toBeCloseTo(80); // 2h * 40
    expect(totals.totalSeconds).toBe(7200);
  });

  it('includes employee parts only once their assignment is completed', () => {
    const totals = computeJobTotals({
      timeEntries: [],
      parts: [
        { employee_id: null, cost: 10, quantity: 2 }, // owner: always -> 20
        { employee_id: 'e1', cost: 5, quantity: 3 }, // completed -> 15
        { employee_id: 'e2', cost: 100, quantity: 1 }, // not completed -> excluded
      ],
      employees: [],
      assignments: [
        { employee_id: 'e1', completed: true },
        { employee_id: 'e2', completed: false },
      ],
      defaultRate: 0,
      now: NOW,
    });
    expect(totals.partsCost).toBe(35);
    expect(totals.total).toBe(35);
  });

  it('falls back to the default rate when an employee has no rate', () => {
    const totals = computeJobTotals({
      timeEntries: [{ employee_id: 'e1', start_time: at(9), end_time: at(10) }],
      parts: [],
      employees: [{ id: 'e1', name: 'Carol', hourly_rate: null }],
      assignments: [{ employee_id: 'e1', completed: true }],
      defaultRate: 30,
      now: NOW,
    });
    expect(totals.labourCost).toBeCloseTo(30); // 1h * default 30
  });
});
