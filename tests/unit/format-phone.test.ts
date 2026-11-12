import { describe, it, expect } from 'vitest';
import { formatPhone } from '../../apps/web/lib/format-phone';

describe('formatPhone', () => {
  it('formats a bare 10-digit number', () => {
    expect(formatPhone('5551234567')).toBe('555-123-4567');
  });

  it('formats partial input as the user types', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone('555')).toBe('555');
    expect(formatPhone('5551')).toBe('555-1');
    expect(formatPhone('555123')).toBe('555-123');
  });

  it('keeps all ten digits when the lead leads with the country code', () => {
    // The bug: a flat 10-digit cap dropped the trailing "7".
    expect(formatPhone('15551234567')).toBe('1-555-123-4567');
    expect(formatPhone('+1 (555) 123-4567')).toBe('1-555-123-4567');
  });

  it('formats partial country-code input too', () => {
    expect(formatPhone('1')).toBe('1');
    expect(formatPhone('1555')).toBe('1-555');
    expect(formatPhone('15551')).toBe('1-555-1');
  });

  it('strips non-digits from pasted values', () => {
    expect(formatPhone('(555) 123-4567')).toBe('555-123-4567');
    expect(formatPhone('555.123.4567 ext 2')).toBe('555-123-4567');
  });

  it('drops digits past the subscriber number', () => {
    expect(formatPhone('55512345678999')).toBe('555-123-4567');
    expect(formatPhone('15551234567899')).toBe('1-555-123-4567');
  });
});
