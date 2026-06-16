import { formatCurrency, formatHMS } from '../format';

describe('formatHMS', () => {
  it('formats seconds as HH:MM:SS', () => {
    expect(formatHMS(0)).toBe('00:00:00');
    expect(formatHMS(5400)).toBe('01:30:00');
    expect(formatHMS(3661)).toBe('01:01:01');
  });
  it('clamps negatives to zero', () => {
    expect(formatHMS(-10)).toBe('00:00:00');
  });
});

describe('formatCurrency', () => {
  it('formats GBP by default', () => {
    expect(formatCurrency(1234.5)).toBe('£1,234.50');
  });
  it('handles non-finite input as 0', () => {
    expect(formatCurrency(NaN)).toBe('£0.00');
  });
  it('supports an explicit currency', () => {
    // en-GB renders USD as US$
    expect(formatCurrency(10, 'USD')).toBe('US$10.00');
  });
});
