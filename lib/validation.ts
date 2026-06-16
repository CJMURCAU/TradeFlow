// Small shared validators (audit: form validation). Pure + unit-tested.

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Accepts digits, spaces and + ( ) - . of a reasonable length. */
export function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (trimmed === '') return true; // optional
  return /^[+]?[\d\s()\-.]{6,20}$/.test(trimmed);
}
