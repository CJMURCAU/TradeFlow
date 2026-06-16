import { isValidEmail, isValidPhone } from '../validation';

describe('isValidEmail', () => {
  it('accepts well-formed addresses', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('  jane.doe@example.co.uk ')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidPhone', () => {
  it('treats empty as valid (optional field)', () => {
    expect(isValidPhone('')).toBe(true);
    expect(isValidPhone('   ')).toBe(true);
  });
  it('accepts common formats', () => {
    expect(isValidPhone('+44 7700 900123')).toBe(true);
    expect(isValidPhone('(555) 123-4567')).toBe(true);
  });
  it('rejects junk', () => {
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone('12')).toBe(false);
  });
});
