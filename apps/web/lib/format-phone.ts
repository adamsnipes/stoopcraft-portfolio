// Progressive US phone-number formatter for lead-capture inputs. Strips every
// non-digit and lays the rest out as xxx-xxx-xxxx as the user types (partial
// input formats too: "5551" -> "555-1").
//
// A leading "1" is the US country code, not part of the 10-digit number — no
// NANP area code starts with 1 — so it is kept as its own group and the ten
// subscriber digits still fit behind it: "15551234567" -> "1-555-123-4567".
// Without that, a flat 10-digit cap silently ate the last digit of every
// number a lead typed with the country code. Digits past the subscriber
// number are dropped.
export function formatPhone(value: string): string {
  const raw = value.replace(/\D/g, '');
  const hasCountryCode = raw.startsWith('1');
  const digits = (hasCountryCode ? raw.slice(1) : raw).slice(0, 10);

  const groups: string[] = [];
  if (hasCountryCode) groups.push('1');
  if (digits.length) groups.push(digits.slice(0, 3));
  if (digits.length > 3) groups.push(digits.slice(3, 6));
  if (digits.length > 6) groups.push(digits.slice(6));
  return groups.join('-');
}
